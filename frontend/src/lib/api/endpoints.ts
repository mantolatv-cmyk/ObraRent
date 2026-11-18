import { request } from '@/lib/api/client';
import { onlyDigits } from '@/lib/format';
import type {
  AuthResponse,
  Availability,
  Category,
  CepLookup,
  ClientUser,
  CnpjLookup,
  CnpjLookupResult,
  ContractDocument,
  CreateRentalRequest,
  EquipmentStatus,
  FleetItem,
  LoginPayload,
  Quote,
  QuoteRequest,
  RegisterPayload,
  RentalStatus,
  RentalSummary,
  TimeSlotsResult,
} from '@/lib/types';

type Opts = { signal?: AbortSignal };

export const listRentals = (
  params?: { status?: RentalStatus; cnpj?: string; limit?: number },
  opts: Opts = {},
) =>
  request<{ rentals: RentalSummary[]; countsByStatus: Record<RentalStatus, number> }>('/rentals', {
    ...opts,
    query: {
      status: params?.status,
      cnpj: params?.cnpj ? onlyDigits(params.cnpj) : undefined,
      limit: params?.limit,
    },
  });

export const dispatchRental = (id: string, opts: Opts = {}) =>
  request<RentalSummary>(`/rentals/${encodeURIComponent(id)}/dispatch`, { ...opts, method: 'POST' });

export const returnRental = (id: string, maintenanceAssetTags?: string[], opts: Opts = {}) =>
  request<RentalSummary>(`/rentals/${encodeURIComponent(id)}/return`, {
    ...opts,
    method: 'POST',
    body: { maintenanceAssetTags },
  });

export const cancelRental = (id: string, opts: Opts = {}) =>
  request<RentalSummary>(`/rentals/${encodeURIComponent(id)}/cancel`, { ...opts, method: 'POST' });

export const extendRental = (id: string, additionalDays: number, opts: Opts = {}) =>
  request<RentalSummary>(`/rentals/${encodeURIComponent(id)}/extend`, {
    ...opts,
    method: 'POST',
    body: { additionalDays },
  });

export const getRentalContract = (id: string, opts: Opts = {}) =>
  request<ContractDocument>(`/rentals/${encodeURIComponent(id)}/contract`, opts);

export const getFleet = (
  params?: { categoryId?: string; status?: EquipmentStatus },
  opts: Opts = {},
) =>
  request<{
    items: FleetItem[];
    summary: { total: number; available: number; rented: number; maintenance: number; retired: number };
  }>('/equipment/fleet', {
    ...opts,
    query: { category_id: params?.categoryId, status: params?.status },
  });

export const updateEquipmentItemStatus = (
  id: string,
  status: 'AVAILABLE' | 'MAINTENANCE' | 'RETIRED',
  opts: Opts = {},
) =>
  request<FleetItem>(`/equipment/items/${encodeURIComponent(id)}/status`, {
    ...opts,
    method: 'PATCH',
    body: { status },
  });

export const getClientRentalsByCnpj = (cnpj: string, opts: Opts = {}) => {
  const digits = onlyDigits(cnpj);
  return request<{ client: CnpjLookupResult; rentals: RentalSummary[] }>(
    `/clients/cnpj/${encodeURIComponent(digits)}/rentals`,
    opts,
  );
};

export const sendWhatsappBotMessage = (
  payload: { phone: string; text: string; pushName?: string },
  opts: Opts = {},
) =>
  request<{
    processedCount: number;
    replies: {
      phoneNumber: string;
      previousState: string;
      nextState: string;
      replyText: string;
      rentalId?: string;
    }[];
  }>('/webhooks/whatsapp', {
    ...opts,
    method: 'POST',
    body: payload,
  });

export const getWhatsappSession = (phone: string, opts: Opts = {}) => {
  const digits = onlyDigits(phone);
  return request<{
    session: {
      phoneNumber: string;
      currentState: string;
      contextData: Record<string, unknown>;
      updatedAt: string;
    };
    outbox: { to: string; text: string; sentAt: string; provider: string }[];
  }>(`/webhooks/whatsapp/session/${encodeURIComponent(digits)}`, opts);
};

export const resetWhatsappSession = (phone: string, opts: Opts = {}) =>
  request<{ session: { phoneNumber: string; currentState: string; contextData: Record<string, unknown>; updatedAt: string } }>(
    '/webhooks/whatsapp/reset',
    {
      ...opts,
      method: 'POST',
      body: { phone },
    },
  );

export const simulatePayment = (id: string, opts: Opts = {}) =>
  request<RentalSummary>(`/dev/rentals/${encodeURIComponent(id)}/simulate-payment`, { ...opts, method: 'POST' });

export const login = (body: LoginPayload, opts: Opts = {}) =>
  request<AuthResponse>('/auth/login', { ...opts, method: 'POST', body });

export const register = (body: RegisterPayload, opts: Opts = {}) =>
  request<AuthResponse>('/auth/register', { ...opts, method: 'POST', body });

export const getMe = (opts: Opts = {}) =>
  request<ClientUser>('/auth/me', opts);

export const getTimeSlots = (
  params: { date: string; categoryIds?: string[]; quantities?: number[] },
  opts: Opts = {},
) =>
  request<TimeSlotsResult>('/equipment/time-slots', {
    ...opts,
    query: {
      date: params.date,
      category_ids: params.categoryIds && params.categoryIds.length > 0 ? params.categoryIds.join(',') : undefined,
      quantities: params.quantities && params.quantities.length > 0 ? params.quantities.join(',') : undefined,
    },
  });

export const api = {
  categories: (opts: Opts = {}) => request<Category[]>('/equipment/categories', opts),

  timeSlots: getTimeSlots,
  getTimeSlots,

  availability: (
    params: { startDate: string; endDate: string; categoryId?: string },
    opts: Opts = {},
  ) =>
    request<Availability>('/equipment/availability', {
      ...opts,
      query: { start_date: params.startDate, end_date: params.endDate, category_id: params.categoryId },
    }),

  quote: (body: QuoteRequest, opts: Opts = {}) => request<Quote>('/rentals/quote', { ...opts, method: 'POST', body }),

  createRental: (body: CreateRentalRequest, opts: Opts = {}) =>
    request<RentalSummary>('/rentals', { ...opts, method: 'POST', body }),

  rental: (id: string, opts: Opts = {}) => request<RentalSummary>(`/rentals/${encodeURIComponent(id)}`, opts),

  cnpj: (cnpj: string, opts: Opts = {}) => request<CnpjLookup>(`/clients/cnpj/${encodeURIComponent(cnpj)}`, opts),

  cep: (cep: string, opts: Opts = {}) => request<CepLookup>(`/geo/cep/${encodeURIComponent(cep)}`, opts),

  login,
  register,
  getMe,
  simulatePayment,
  listRentals,
  dispatchRental,
  returnRental,
  cancelRental,
  extendRental,
  getRentalContract,
  getFleet,
  updateEquipmentItemStatus,
  getClientRentalsByCnpj,
  sendWhatsappBotMessage,
  getWhatsappSession,
  resetWhatsappSession,
};
