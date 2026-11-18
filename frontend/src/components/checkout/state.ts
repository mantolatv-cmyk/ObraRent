import { addDaysISO, inclusiveDays, onlyDigits, todayISO } from '@/lib/format';
import {
  isValidCep,
  isValidCpfOrCnpj,
  isValidEmail,
  isValidPhoneBR,
  isValidUF,
} from '@/lib/validation';
import type {
  Category,
  InsufficientAvailabilityDetail,
  PaymentMethod,
  RentalSummary,
} from '@/lib/types';

export type CheckoutStep = 0 | 1 | 2 | 3;

export const STEP_LABELS = ['Equipamento', 'Datas', 'Cliente & Entrega', 'Pagamento'] as const;

export const STORAGE_KEY = 'obra-rent:checkout:v1';

export interface ClientFormState {
  cnpj: string;
  companyName: string;
  tradeName: string;
  email: string;
  phone: string;
}

export interface AddressFormState {
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  reference: string;
}

export interface CheckoutState {
  step: CheckoutStep;
  quantities: Record<string, number>;
  startDate: string;
  endDate: string;
  deliveryTimeSlot: string;
  client: ClientFormState;
  address: AddressFormState;
  paymentMethod: PaymentMethod;
  createdRental: RentalSummary | null;
  shortfalls: InsufficientAvailabilityDetail[];
}

export type CheckoutAction =
  | { type: 'HYDRATE'; state: Partial<CheckoutState> }
  | { type: 'SET_STEP'; step: CheckoutStep }
  | { type: 'SET_QUANTITY'; categoryId: string; quantity: number }
  | { type: 'CLEAR_QUANTITIES' }
  | { type: 'SET_DATES'; startDate: string; endDate: string }
  | { type: 'SET_DELIVERY_TIME_SLOT'; slot: string }
  | { type: 'PATCH_CLIENT'; patch: Partial<ClientFormState> }
  | { type: 'PATCH_ADDRESS'; patch: Partial<AddressFormState> }
  | { type: 'SET_PAYMENT_METHOD'; method: PaymentMethod }
  | { type: 'RENTAL_CREATED'; rental: RentalSummary }
  | { type: 'RENTAL_UPDATED'; rental: RentalSummary }
  | { type: 'AVAILABILITY_SHORTFALL'; shortfalls: InsufficientAvailabilityDetail[] }
  | { type: 'RESET' };

export function createInitialCheckoutState(): CheckoutState {
  const tomorrow = addDaysISO(todayISO(), 1);
  const defaultEnd = addDaysISO(tomorrow, 2); // 3 inclusive days
  return {
    step: 0,
    quantities: {},
    startDate: tomorrow,
    endDate: defaultEnd,
    deliveryTimeSlot: '',
    client: {
      cnpj: '',
      companyName: '',
      tradeName: '',
      email: '',
      phone: '',
    },
    address: {
      cep: '',
      street: '',
      number: '',
      complement: '',
      district: '',
      city: '',
      state: 'SP',
      reference: '',
    },
    paymentMethod: 'PIX',
    createdRental: null,
    shortfalls: [],
  };
}

export function checkoutReducer(state: CheckoutState, action: CheckoutAction): CheckoutState {
  switch (action.type) {
    case 'HYDRATE': {
      const today = todayISO();
      const s = action.state;
      const startDate = s.startDate && s.startDate >= today ? s.startDate : state.startDate;
      const endDate = s.endDate && s.endDate >= startDate ? s.endDate : addDaysISO(startDate, 2);
      return {
        ...state,
        ...s,
        startDate,
        endDate,
        deliveryTimeSlot: s.deliveryTimeSlot ?? state.deliveryTimeSlot ?? '',
        client: { ...state.client, ...(s.client ?? {}) },
        address: { ...state.address, ...(s.address ?? {}) },
        shortfalls: [],
      };
    }

    case 'SET_STEP':
      return { ...state, step: action.step };

    case 'SET_DELIVERY_TIME_SLOT':
      return { ...state, deliveryTimeSlot: action.slot };

    case 'SET_QUANTITY': {
      const next = { ...state.quantities };
      const q = Math.max(0, Math.min(50, Math.floor(action.quantity)));
      if (q <= 0) {
        delete next[action.categoryId];
      } else {
        next[action.categoryId] = q;
      }
      return {
        ...state,
        quantities: next,
        shortfalls: state.shortfalls.filter((s) => s.categoryId !== action.categoryId),
      };
    }

    case 'CLEAR_QUANTITIES':
      return { ...state, quantities: {}, shortfalls: [] };

    case 'SET_DATES': {
      const startDate = action.startDate;
      const endDate = action.endDate < startDate ? startDate : action.endDate;
      const deliveryTimeSlot = action.startDate !== state.startDate ? '' : state.deliveryTimeSlot;
      return { ...state, startDate, endDate, deliveryTimeSlot, shortfalls: [] };
    }

    case 'PATCH_CLIENT':
      return { ...state, client: { ...state.client, ...action.patch } };

    case 'PATCH_ADDRESS':
      return { ...state, address: { ...state.address, ...action.patch } };

    case 'SET_PAYMENT_METHOD':
      return { ...state, paymentMethod: action.method };

    case 'RENTAL_CREATED':
      return { ...state, createdRental: action.rental, step: 3, shortfalls: [] };

    case 'RENTAL_UPDATED':
      return { ...state, createdRental: action.rental };

    case 'AVAILABILITY_SHORTFALL':
      return { ...state, step: 1, shortfalls: action.shortfalls };

    case 'RESET':
      return createInitialCheckoutState();
  }
}

export function discountPctForDays(days: number): number {
  if (days >= 30) return 20;
  if (days >= 7) return 10;
  return 0;
}

export interface EstimatedLine {
  category: Category;
  quantity: number;
  baseDailyRate: number;
  discountPct: number;
  agreedDailyRate: number;
  subtotal: number;
}

export function computeLocalEstimate(
  categories: Category[],
  quantities: Record<string, number>,
  startDate: string,
  endDate: string,
): {
  days: number;
  discountPct: number;
  lines: EstimatedLine[];
  subtotal: number;
  totalUnits: number;
} {
  const days = Math.max(1, inclusiveDays(startDate, endDate));
  const discountPct = discountPctForDays(days);
  const factor = (100 - discountPct) / 100;
  const lines: EstimatedLine[] = [];
  let subtotal = 0;
  let totalUnits = 0;

  for (const cat of categories) {
    const qty = quantities[cat.id] ?? 0;
    if (qty <= 0) continue;
    const agreedDailyRate = Math.round(cat.baseDailyRate * factor * 100) / 100;
    const lineSubtotal = Math.round(agreedDailyRate * qty * days * 100) / 100;
    lines.push({
      category: cat,
      quantity: qty,
      baseDailyRate: cat.baseDailyRate,
      discountPct,
      agreedDailyRate,
      subtotal: lineSubtotal,
    });
    subtotal += lineSubtotal;
    totalUnits += qty;
  }

  return {
    days,
    discountPct,
    lines,
    subtotal: Math.round(subtotal * 100) / 100,
    totalUnits,
  };
}

export type Step3Errors = Partial<
  Record<
    | 'cnpj'
    | 'companyName'
    | 'email'
    | 'phone'
    | 'cep'
    | 'street'
    | 'number'
    | 'district'
    | 'city'
    | 'state',
    string
  >
>;

export function validateStep3(client: ClientFormState, address: AddressFormState): Step3Errors {
  const errors: Step3Errors = {};

  if (!onlyDigits(client.cnpj)) {
    errors.cnpj = 'Informe seu CPF ou CNPJ.';
  } else if (!isValidCpfOrCnpj(client.cnpj)) {
    errors.cnpj = 'Documento inválido. Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.';
  }

  if (!client.companyName.trim() || client.companyName.trim().length < 2) {
    errors.companyName = 'Informe seu nome completo ou razão social.';
  }

  if (!client.email.trim()) {
    errors.email = 'Informe o e-mail para envio do contrato e NF.';
  } else if (!isValidEmail(client.email)) {
    errors.email = 'Informe um e-mail válido.';
  }

  if (!onlyDigits(client.phone)) {
    errors.phone = 'Informe o telefone/WhatsApp do responsável.';
  } else if (!isValidPhoneBR(client.phone)) {
    errors.phone = 'Informe um telefone válido com DDD (ex.: 11 98765-4321).';
  }

  if (!onlyDigits(address.cep)) {
    errors.cep = 'Informe o CEP da obra.';
  } else if (!isValidCep(address.cep)) {
    errors.cep = 'CEP inválido (8 dígitos).';
  }

  if (!address.street.trim()) {
    errors.street = 'Informe o logradouro da obra.';
  }

  if (!address.number.trim()) {
    errors.number = 'Informe o número ou lote.';
  }

  if (!address.district.trim()) {
    errors.district = 'Informe o bairro.';
  }

  if (!address.city.trim()) {
    errors.city = 'Informe a cidade.';
  }

  if (!address.state.trim() || !isValidUF(address.state)) {
    errors.state = 'Selecione a UF.';
  }

  return errors;
}
