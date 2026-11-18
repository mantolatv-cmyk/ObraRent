// Mirrors docs/API.md (RentalOps API v1) exactly.

export type EquipmentStatus = 'AVAILABLE' | 'RENTED' | 'MAINTENANCE' | 'RETIRED';
export type RentalStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type PaymentMethod = 'PIX' | 'CASH' | 'CREDIT_CARD' | 'BOLETO';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
export type RentalChannel = 'WEB' | 'WHATSAPP';
export type FreightZone = 'URBAN' | 'METRO' | 'REGIONAL' | 'EXTENDED';

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  baseDailyRate: number;
  replacementCost: number;
  imageUrl: string | null;
  totalUnits: number;
  operationalUnits: number;
}

export interface DeliveryAddress {
  cep: string;
  street: string;
  number: string;
  complement?: string;
  district: string;
  city: string;
  state: string;
  reference?: string;
  latitude?: number;
  longitude?: number;
}

export interface QuoteLine {
  categoryId: string;
  categoryName: string;
  quantity: number;
  baseDailyRate: number;
  discountPct: number;
  agreedDailyRate: number;
  subtotal: number;
}

export interface Freight {
  amount: number;
  distanceKm: number | null;
  zone: FreightZone;
}

export interface Quote {
  startDate: string;
  endDate: string;
  days: number;
  lines: QuoteLine[];
  subtotal: number;
  cashDiscountPct?: number;
  cashDiscountAmount?: number;
  freight: Freight;
  totalAmount: number;
}

export interface PaymentInfo {
  id: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  gatewayTxId: string;
  pixCopyPaste: string | null;
  pixQrCodeImage: string | null;
  pixKey?: string | null;
  pixMerchantName?: string | null;
  pixMerchantCity?: string | null;
  invoiceUrl: string | null;
  expiresAt: string | null;
  paidAt: string | null;
}

export interface RentalItem {
  id: string;
  categoryId: string;
  categoryName: string;
  assetTag: string;
  agreedDailyRate: number;
}

export interface RentalClientRef {
  id: string;
  cnpj: string;
  companyName: string;
  tradeName: string | null;
}

export interface RentalSummary extends Quote {
  id: string;
  code: string;
  status: RentalStatus;
  channel: RentalChannel;
  client: RentalClientRef;
  deliveryAddress: DeliveryAddress;
  items: RentalItem[];
  payment: PaymentInfo | null;
  deliveryTimeSlot?: string | null;
  createdAt: string;
}

export interface AvailableItem {
  id: string;
  assetTag: string;
  serialNumber: string | null;
}

export interface CategoryAvailability {
  categoryId: string;
  categoryName: string;
  dailyRate: number;
  availableCount: number;
  availableItems: AvailableItem[];
}

export interface Availability {
  startDate: string;
  endDate: string;
  days: number;
  categories: CategoryAvailability[];
}

export interface RentalItemInput {
  categoryId: string;
  quantity: number;
}

export interface QuoteRequest {
  startDate: string;
  endDate: string;
  items: RentalItemInput[];
  deliveryAddress?: Partial<DeliveryAddress>;
  paymentMethod?: PaymentMethod;
}

export interface ClientInput {
  cnpj: string;
  companyName?: string;
  tradeName?: string;
  email?: string;
  phone?: string;
}

export interface CreateRentalRequest {
  client: ClientInput;
  startDate: string;
  endDate: string;
  items: RentalItemInput[];
  deliveryAddress: DeliveryAddress;
  paymentMethod: PaymentMethod;
  channel?: RentalChannel;
  deliveryTimeSlot?: string;
}

export interface CategorySlotCapacity {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  operationalUnits: number;
  slotCapacity: number;
  bookedUnits: number;
  availableUnits: number;
  isAvailable: boolean;
}

export interface TimeSlotAvailability {
  slot: string;
  label: string;
  period: 'MANHA' | 'TARDE';
  periodLabel: string;
  available: boolean;
  reason?: string | null;
  categories: CategorySlotCapacity[];
}

export interface TimeSlotsResult {
  date: string;
  slots: TimeSlotAvailability[];
}

export interface CnpjLookup {
  cnpj: string;
  registered: boolean;
  source?: 'DATABASE' | 'NONE';
  companyName: string | null;
  tradeName: string | null;
  email: string | null;
  phone: string | null;
  active?: boolean | null;
}

export type CnpjLookupResult = CnpjLookup;

export interface FleetItem {
  id: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  assetTag: string;
  serialNumber: string | null;
  status: EquipmentStatus;
  baseDailyRate: number;
  replacementCost: number;
  activeRentalId: string | null;
  activeRentalCode: string | null;
  currentEndDate: string | null;
}

export interface ContractDocument {
  rental: RentalSummary;
  issuedAt: string;
  documentNumber: string;
  lessor: {
    companyName: string;
    tradeName: string;
    cnpj: string;
    address: string;
    phone: string;
    email: string;
  };
  lessee: {
    id: string;
    cnpj: string;
    companyName: string;
    tradeName: string | null;
    email: string | null;
    phone: string | null;
  };
  assets: {
    id: string;
    assetTag: string;
    serialNumber: string | null;
    categoryId: string;
    categoryName: string;
    agreedDailyRate: number;
    replacementCost: number;
  }[];
  totalReplacementValue: number;
}

export interface CepLookup {
  cep: string;
  street: string;
  district: string;
  city: string;
  state: string;
}

// ---- Errors ----

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CNPJ'
  | 'NOT_FOUND'
  | 'CLIENT_BLOCKED'
  | 'INSUFFICIENT_AVAILABILITY'
  | 'INVALID_STATE_TRANSITION'
  | 'UNAUTHORIZED'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL_ERROR'
  // client-side only codes
  | 'NETWORK_ERROR'
  | 'ABORTED'
  | 'BAD_RESPONSE';

export interface ValidationErrorDetail {
  path: string;
  message: string;
}

export interface InsufficientAvailabilityDetail {
  categoryId: string;
  categoryName: string;
  requested: number;
  available: number;
}

export type ApiErrorDetail = ValidationErrorDetail | InsufficientAvailabilityDetail | Record<string, unknown>;

export interface ApiErrorBody {
  code: ApiErrorCode | string;
  message: string;
  details?: ApiErrorDetail[];
}

export interface ClientUser {
  id: string;
  cnpj: string;
  companyName: string;
  tradeName: string | null;
  email: string | null;
  phone: string | null;
  createdAt?: string;
}

export interface AuthResponse {
  client: ClientUser;
  token: string;
}

export interface LoginPayload {
  identifier: string;
  password: string;
}

export interface RegisterPayload {
  cnpj: string;
  companyName: string;
  tradeName?: string;
  email: string;
  phone?: string;
  password: string;
}
