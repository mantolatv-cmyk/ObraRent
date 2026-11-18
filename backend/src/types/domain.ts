export type EquipmentStatus = 'AVAILABLE' | 'RENTED' | 'MAINTENANCE' | 'RETIRED';
export type RentalStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type PaymentMethod = 'PIX' | 'CASH' | 'CREDIT_CARD' | 'BOLETO';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
export type RentalChannel = 'WEB' | 'WHATSAPP';

export type WhatsappSessionState =
  | 'IDLE'
  | 'AWAITING_CATEGORY'
  | 'AWAITING_DATES'
  | 'AWAITING_ADDRESS'
  | 'AWAITING_PAYMENT';

export interface Client {
  id: string;
  cnpj: string;
  companyName: string;
  tradeName: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
}

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

export interface EquipmentItem {
  id: string;
  categoryId: string;
  assetTag: string;
  serialNumber: string | null;
  status: EquipmentStatus;
  createdAt: string;
}

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

export interface FleetSummary {
  total: number;
  available: number;
  rented: number;
  maintenance: number;
  retired: number;
}

export interface AvailableEquipmentItem {
  id: string;
  assetTag: string;
  serialNumber: string | null;
}

export interface CategoryAvailability {
  categoryId: string;
  categoryName: string;
  dailyRate: number;
  availableCount: number;
  availableItems: AvailableEquipmentItem[];
}

export interface AvailabilityResult {
  startDate: string;
  endDate: string;
  days: number;
  categories: CategoryAvailability[];
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

export type FreightZone = 'URBAN' | 'METRO' | 'REGIONAL' | 'EXTENDED';

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

export interface RentalAllocatedItem {
  id: string;
  categoryId: string;
  categoryName: string;
  assetTag: string;
  agreedDailyRate: number;
}

export interface RentalSummary extends Quote {
  id: string;
  code: string;
  status: RentalStatus;
  channel: RentalChannel;
  client: {
    id: string;
    cnpj: string;
    companyName: string;
    tradeName: string | null;
  };
  deliveryAddress: DeliveryAddress;
  items: RentalAllocatedItem[];
  payment: PaymentInfo | null;
  deliveryTimeSlot?: string | null;
  createdAt: string;
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

export interface WhatsappMenuCategory {
  index: number;
  id: string;
  name: string;
  dailyRate: number;
}

export interface WhatsappContextData {
  menuCategories?: WhatsappMenuCategory[];
  selectedCategoryId?: string;
  selectedCategoryName?: string;
  selectedQuantity?: number;
  dailyRate?: number;
  startDate?: string;
  endDate?: string;
  days?: number;
  deliveryAddress?: DeliveryAddress;
  cnpj?: string;
  companyName?: string;
  lastRentalId?: string;
  lastRentalCode?: string;
}

export interface WhatsappSession {
  phoneNumber: string;
  clientId: string | null;
  currentState: WhatsappSessionState;
  contextData: WhatsappContextData;
  updatedAt: string;
}
