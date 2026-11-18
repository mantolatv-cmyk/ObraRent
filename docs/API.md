# RentalOps API v1 — Contract

Base URL: `http://localhost:4000/api/v1` (frontend reads `NEXT_PUBLIC_API_URL`).

## Conventions

- JSON everywhere, `camelCase` keys in responses and request bodies.
- Exception: query params of the availability endpoint use `snake_case` (`start_date`, `end_date`, `category_id`).
- Dates are ISO calendar dates `YYYY-MM-DD` (rental periods are **inclusive**: 20→22 = 3 days).
- Money: JSON `number` in BRL with 2 decimals (e.g. `1234.5` = R$ 1.234,50).
- Success envelope: `{ "data": <payload> }`
- Error envelope (any 4xx/5xx):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Human readable (pt-BR)", "details": [{ "path": "items.0.quantity", "message": "..." }] } }
```

Error codes: `VALIDATION_ERROR` (400), `INVALID_CNPJ` (400), `NOT_FOUND` (404), `CLIENT_BLOCKED` (403),
`INSUFFICIENT_AVAILABILITY` (409, `details: [{ categoryId, categoryName, requested, available }]`),
`INVALID_STATE_TRANSITION` (409), `UNAUTHORIZED` (401), `UPSTREAM_ERROR` (502), `INTERNAL_ERROR` (500).

---

## Shared types (TypeScript)

```ts
type CreditStatus = 'PREPAID' | 'APPROVED' | 'BLOCKED';
type EquipmentStatus = 'AVAILABLE' | 'RENTED' | 'MAINTENANCE' | 'RETIRED';
type RentalStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'INVOICED';
type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

interface Category {
  id: string;            // uuid
  slug: string;          // e.g. "compactador-de-solo"
  name: string;
  description: string;
  baseDailyRate: number;
  replacementCost: number;
  imageUrl: string | null;
  totalUnits: number;        // non-retired physical items
  operationalUnits: number;  // items not in MAINTENANCE/RETIRED
}

interface DeliveryAddress {
  cep: string;          // 8 digits, no mask
  street: string;
  number: string;
  complement?: string;
  district: string;
  city: string;
  state: string;        // UF, 2 letters
  reference?: string;
  latitude?: number;
  longitude?: number;
}

interface QuoteLine {
  categoryId: string;
  categoryName: string;
  quantity: number;
  baseDailyRate: number;
  discountPct: number;      // long-period discount applied (0, 10, 20)
  agreedDailyRate: number;  // per unit, after discount
  subtotal: number;         // agreedDailyRate * quantity * days
}

interface Freight {
  amount: number;
  distanceKm: number | null; // null when estimated by CEP zone
  zone: 'URBAN' | 'METRO' | 'REGIONAL' | 'EXTENDED';
}

interface Quote {
  startDate: string;
  endDate: string;
  days: number;
  lines: QuoteLine[];
  subtotal: number;
  freight: Freight;
  totalAmount: number;
}

interface PaymentInfo {
  id: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  gatewayTxId: string;
  pixCopyPaste: string | null;      // EMV "Pix Copia e Cola"
  pixQrCodeImage: string | null;    // data:image/png;base64,...
  invoiceUrl: string | null;        // card / boleto checkout URL
  expiresAt: string | null;         // ISO datetime
  paidAt: string | null;
}

interface RentalSummary extends Quote {
  id: string;
  code: string;             // short human code, e.g. "LOC-7F3A2C"
  status: RentalStatus;
  channel: 'WEB' | 'WHATSAPP';
  client: { id: string; cnpj: string; companyName: string; tradeName: string | null };
  deliveryAddress: DeliveryAddress;
  items: { id: string; categoryId: string; categoryName: string; assetTag: string; agreedDailyRate: number }[];
  payment: PaymentInfo | null;  // latest payment
  createdAt: string;
}
```

---

## Endpoints

### `GET /health` (outside `/api/v1`) → `{ status: "ok", db: "up" }`

### `GET /equipment/categories` → `{ data: Category[] }`

### `GET /equipment/availability?start_date&end_date[&category_id]`

```ts
{ data: {
  startDate: string; endDate: string; days: number;
  categories: {
    categoryId: string; categoryName: string; dailyRate: number;
    availableCount: number;
    availableItems: { id: string; assetTag: string; serialNumber: string | null }[];
  }[];
} }
```

### `POST /rentals/quote`

Body: `{ startDate, endDate, items: { categoryId, quantity }[], deliveryAddress?: Partial<DeliveryAddress> }` → `{ data: Quote }`
(freight uses CEP/coordinates when present; otherwise `URBAN` zone).

### `POST /rentals` → `201 { data: RentalSummary }`

```ts
{
  client: { cnpj: string; companyName?: string; tradeName?: string; email?: string; phone?: string };
  startDate: string; endDate: string;
  items: { categoryId: string; quantity: number }[];   // 1..10 lines, quantity 1..50
  deliveryAddress: DeliveryAddress;
  paymentMethod: PaymentMethod;
  channel?: 'WEB' | 'WHATSAPP';
}
```

Client is auto-registered when the CNPJ is unknown (Receita lookup fills names). Rental starts as
`PENDING_PAYMENT` and holds the allocated physical assets for `PAYMENT_HOLD_MINUTES` (default 30).

### `GET /rentals/:id` → `{ data: RentalSummary }` (poll this to detect `CONFIRMED`)

### `POST /rentals/:id/cancel` → `{ data: RentalSummary }`
### `POST /rentals/:id/dispatch` → `{ data: RentalSummary }` (CONFIRMED → ACTIVE; assets → RENTED)
### `POST /rentals/:id/return` body `{ maintenanceAssetTags?: string[] }` → (ACTIVE → COMPLETED; assets → AVAILABLE/MAINTENANCE)
### `POST /rentals/:id/extend` body `{ additionalDays: number }` → `{ data: RentalSummary }` (extends `end_date` for CONFIRMED/ACTIVE rentals, checking asset availability)
### `GET /rentals` query `?status=&cnpj=&limit=` → `{ data: { rentals: RentalSummary[]; countsByStatus: Record<RentalStatus, number> } }`
### `GET /rentals/:id/contract` → `{ data: ContractDocument }` (full Pessoa Física e Jurídica contract + romaneio with `serialNumber`, `replacementCost`, total patrimonial risk, and lessor/lessee details)

### `GET /equipment/fleet` query `?category_id=&status=` → `{ data: { items: FleetItem[]; summary: { total: number; available: number; rented: number; maintenance: number; retired: number } } }`
### `PATCH /equipment/items/:id/status` body `{ status: 'AVAILABLE' | 'MAINTENANCE' | 'RETIRED' }` → `{ data: FleetItem }`

### `GET /clients/cnpj/:cnpj` (CNPJ with or without mask)

```ts
{ data: {
  cnpj: string; registered: boolean; source: 'DATABASE' | 'RECEITA' | 'NONE';
  companyName: string | null; tradeName: string | null; email: string | null; phone: string | null;
  creditStatus: CreditStatus | null; active: boolean | null; // active = situação cadastral ATIVA (Receita)
  creditLimit: number; creditUsed: number; creditAvailable: number;
} }
```

### `GET /clients/cnpj/:cnpj/rentals` → `{ data: { client: CnpjLookupResult; rentals: RentalSummary[] } }`
### `PATCH /clients/cnpj/:cnpj/credit` body `{ creditStatus: CreditStatus; creditLimit?: number }` → `{ data: CnpjLookupResult }`

### `POST /clients` body `{ cnpj, companyName?, tradeName?, email?, phone? }` → `201 { data: Client }`

### `GET /geo/cep/:cep` → `{ data: { cep, street, district, city, state } }`

### Webhooks & WhatsApp Simulator

- `GET  /webhooks/whatsapp` — Meta verification (`hub.mode`, `hub.verify_token`, `hub.challenge`).
- `POST /webhooks/whatsapp` — Evolution API (`messages.upsert`), Meta Cloud API, or direct `{ phone, text, pushName }` payloads.
- `GET  /webhooks/whatsapp/session/:phone` — returns `{ data: { session: WhatsappSession; outbox: OutboundWhatsappMessage[] } }`.
- `POST /webhooks/whatsapp/reset` — body `{ phone: string }` resets the WhatsApp session to `IDLE`.
- `POST /webhooks/gateway` — Asaas (`PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED`) or Pagar.me (`order.paid`/`charge.paid`) payloads; authenticated by `asaas-access-token` / `x-webhook-token` header.

### Dev only (`NODE_ENV !== 'production'`)

- `POST /dev/rentals/:id/simulate-payment` → runs the same code path as a real gateway approval. Returns `{ data: RentalSummary }`.
