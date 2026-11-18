-- =============================================================================
-- Mantovani — construction equipment rental (Pessoa Física e Jurídica)
-- 001_init.sql — core relational schema (PostgreSQL 14+)
-- =============================================================================
-- Design notes
--  * UUID primary keys (gen_random_uuid() is built in since PG 13).
--  * Status columns use TEXT + CHECK constraints (easier to evolve than ENUM).
--  * Overbooking is prevented at TWO levels:
--      1. Application: allocations run inside a transaction holding a per-category
--         advisory lock (see rental.repository.ts).
--      2. Database: an EXCLUDE constraint on rental_items guarantees that the same
--         physical asset can never hold two overlapping blocking reservations,
--         even if application code is bypassed.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Keeps updated_at fresh -------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. clients ---------------------------------------------------------------------
CREATE TABLE clients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj           VARCHAR(14) NOT NULL UNIQUE CHECK (cnpj ~ '^[0-9]{11,14}$'),
  company_name   TEXT        NOT NULL CHECK (length(trim(company_name)) > 0),
  trade_name     TEXT,
  email          TEXT,
  phone          TEXT        CHECK (phone IS NULL OR phone ~ '^[0-9]{10,13}$'),
  password_hash  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clients_phone ON clients (phone) WHERE phone IS NOT NULL;
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. equipment_categories ----------------------------------------------------------
CREATE TABLE equipment_categories (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT          NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  name              TEXT          NOT NULL,
  description       TEXT          NOT NULL DEFAULT '',
  base_daily_rate   NUMERIC(12,2) NOT NULL CHECK (base_daily_rate > 0),
  replacement_cost  NUMERIC(12,2) NOT NULL CHECK (replacement_cost >= 0),
  image_url         TEXT,
  sort_order        INT           NOT NULL DEFAULT 0,
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_categories_active ON equipment_categories (is_active, sort_order);

-- 3. equipment_items (physical assets) ---------------------------------------------
CREATE TABLE equipment_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id    UUID        NOT NULL REFERENCES equipment_categories (id) ON DELETE RESTRICT,
  asset_tag      TEXT        NOT NULL UNIQUE,          -- code engraved on the iron
  serial_number  TEXT,
  status         TEXT        NOT NULL DEFAULT 'AVAILABLE'
                 CHECK (status IN ('AVAILABLE', 'RENTED', 'MAINTENANCE', 'RETIRED')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_items_category_status ON equipment_items (category_id, status);
CREATE TRIGGER trg_items_updated_at BEFORE UPDATE ON equipment_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. rentals (contracts) -----------------------------------------------------------
CREATE TABLE rentals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT          NOT NULL UNIQUE,     -- human friendly, e.g. LOC-7F3A2C
  client_id         UUID          NOT NULL REFERENCES clients (id) ON DELETE RESTRICT,
  start_date        DATE          NOT NULL,
  end_date          DATE          NOT NULL,
  subtotal_amount   NUMERIC(12,2) NOT NULL CHECK (subtotal_amount >= 0),
  freight_amount    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (freight_amount >= 0),
  total_amount      NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  status            TEXT          NOT NULL DEFAULT 'PENDING_PAYMENT'
                    CHECK (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
  channel           TEXT          NOT NULL DEFAULT 'WEB' CHECK (channel IN ('WEB', 'WHATSAPP')),
  delivery_time_slot TEXT,
  delivery_address  JSONB         NOT NULL,
  freight_details   JSONB         NOT NULL DEFAULT '{}'::jsonb,
  contact_phone     TEXT,
  payment_due_at    TIMESTAMPTZ,                       -- reservation hold expiry
  confirmed_at      TIMESTAMPTZ,
  dispatched_at     TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  cancel_reason     TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT chk_rental_period CHECK (end_date >= start_date),
  CONSTRAINT chk_delivery_address CHECK (jsonb_typeof(delivery_address) = 'object')
);
CREATE INDEX idx_rentals_client ON rentals (client_id, created_at DESC);
CREATE INDEX idx_rentals_status_period ON rentals (status, start_date, end_date);
CREATE INDEX idx_rentals_pending_due ON rentals (payment_due_at) WHERE status = 'PENDING_PAYMENT';
CREATE TRIGGER trg_rentals_updated_at BEFORE UPDATE ON rentals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. rental_items --------------------------------------------------------------------
-- rental_period / blocks_inventory are denormalised from rentals so the EXCLUDE
-- constraint can guarantee "one asset, one contract per day" at the storage level.
CREATE TABLE rental_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id          UUID          NOT NULL REFERENCES rentals (id) ON DELETE CASCADE,
  equipment_item_id  UUID          NOT NULL REFERENCES equipment_items (id) ON DELETE RESTRICT,
  category_id        UUID          NOT NULL REFERENCES equipment_categories (id) ON DELETE RESTRICT,
  agreed_daily_rate  NUMERIC(12,2) NOT NULL CHECK (agreed_daily_rate >= 0),
  rental_period      DATERANGE     NOT NULL,
  blocks_inventory   BOOLEAN       NOT NULL DEFAULT TRUE,
  assigned_at        TIMESTAMPTZ,                       -- set when payment confirms the contract
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT uq_rental_item UNIQUE (rental_id, equipment_item_id),
  CONSTRAINT excl_asset_double_booking EXCLUDE USING gist (
    equipment_item_id WITH =,
    rental_period     WITH &&
  ) WHERE (blocks_inventory)
);
CREATE INDEX idx_rental_items_rental ON rental_items (rental_id);
CREATE INDEX idx_rental_items_item ON rental_items (equipment_item_id) WHERE blocks_inventory;

-- 6. payments ------------------------------------------------------------------------
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id       UUID          NOT NULL REFERENCES rentals (id) ON DELETE RESTRICT,
  gateway         TEXT          NOT NULL,              -- mock | asaas | pagarme
  gateway_tx_id   TEXT          NOT NULL,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method  TEXT          NOT NULL CHECK (payment_method IN ('PIX', 'CASH', 'CREDIT_CARD', 'BOLETO')),
  status          TEXT          NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
  pix_copy_paste  TEXT,
  invoice_url     TEXT,
  expires_at      TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT uq_payment_gateway_tx UNIQUE (gateway, gateway_tx_id)
);
CREATE INDEX idx_payments_rental ON payments (rental_id, created_at DESC);
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Webhook inbox: idempotency + audit trail for gateway callbacks
CREATE TABLE payment_webhook_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway      TEXT        NOT NULL,
  event_id     TEXT        NOT NULL,
  event_type   TEXT        NOT NULL,
  payload      JSONB       NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_webhook_event UNIQUE (gateway, event_id)
);

-- 7. whatsapp_sessions ---------------------------------------------------------------
CREATE TABLE whatsapp_sessions (
  phone_number   TEXT PRIMARY KEY CHECK (phone_number ~ '^[0-9]{10,15}$'),
  client_id      UUID        REFERENCES clients (id) ON DELETE SET NULL,
  current_state  TEXT        NOT NULL DEFAULT 'IDLE'
                 CHECK (current_state IN ('IDLE', 'AWAITING_CNPJ', 'AWAITING_CATEGORY', 'AWAITING_DATES',
                                          'AWAITING_ADDRESS', 'AWAITING_PAYMENT')),
  context_data   JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wa_sessions_client ON whatsapp_sessions (client_id);
