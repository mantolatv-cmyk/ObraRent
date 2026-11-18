/**
 * Embedded SQL schema and catalog seed so serverless deployments (e.g. Vercel)
 * never fail with ENOENT looking for `../../../database/*.sql` outside the
 * backend service root directory.
 */

export const INIT_SQL = `
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS clients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj           VARCHAR(14) NOT NULL UNIQUE CHECK (cnpj ~ '^[0-9]{11,14}$'),
  company_name   TEXT        NOT NULL CHECK (length(trim(company_name)) > 0),
  trade_name     TEXT,
  email          TEXT,
  phone          TEXT        CHECK (phone IS NULL OR phone ~ '^[0-9]{10,13}$'),
  password_hash  TEXT,
  credit_limit   NUMERIC(12,2) NOT NULL DEFAULT 15000.00 CHECK (credit_limit >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients (phone) WHERE phone IS NOT NULL;
DROP TRIGGER IF EXISTS trg_clients_updated_at ON clients;
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS equipment_categories (
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
CREATE INDEX IF NOT EXISTS idx_categories_active ON equipment_categories (is_active, sort_order);

CREATE TABLE IF NOT EXISTS equipment_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id    UUID        NOT NULL REFERENCES equipment_categories (id) ON DELETE RESTRICT,
  asset_tag      TEXT        NOT NULL UNIQUE,
  serial_number  TEXT,
  status         TEXT        NOT NULL DEFAULT 'AVAILABLE'
                 CHECK (status IN ('AVAILABLE', 'RENTED', 'MAINTENANCE', 'RETIRED')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_items_category_status ON equipment_items (category_id, status);
DROP TRIGGER IF EXISTS trg_items_updated_at ON equipment_items;
CREATE TRIGGER trg_items_updated_at BEFORE UPDATE ON equipment_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS rentals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code               TEXT          NOT NULL UNIQUE,
  client_id          UUID          NOT NULL REFERENCES clients (id) ON DELETE RESTRICT,
  start_date         DATE          NOT NULL,
  end_date           DATE          NOT NULL,
  subtotal_amount    NUMERIC(12,2) NOT NULL CHECK (subtotal_amount >= 0),
  freight_amount     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (freight_amount >= 0),
  total_amount       NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  status             TEXT          NOT NULL DEFAULT 'PENDING_PAYMENT'
                     CHECK (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
  channel            TEXT          NOT NULL DEFAULT 'WEB' CHECK (channel IN ('WEB', 'WHATSAPP')),
  delivery_time_slot TEXT,
  delivery_address   JSONB         NOT NULL,
  freight_details    JSONB         NOT NULL DEFAULT '{}'::jsonb,
  contact_phone      TEXT,
  payment_due_at     TIMESTAMPTZ,
  confirmed_at       TIMESTAMPTZ,
  dispatched_at      TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  cancelled_at       TIMESTAMPTZ,
  cancel_reason      TEXT,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT chk_rental_period CHECK (end_date >= start_date),
  CONSTRAINT chk_delivery_address CHECK (jsonb_typeof(delivery_address) = 'object')
);
CREATE INDEX IF NOT EXISTS idx_rentals_client ON rentals (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rentals_status_period ON rentals (status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_rentals_pending_due ON rentals (payment_due_at) WHERE status = 'PENDING_PAYMENT';
DROP TRIGGER IF EXISTS trg_rentals_updated_at ON rentals;
CREATE TRIGGER trg_rentals_updated_at BEFORE UPDATE ON rentals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS rental_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id          UUID          NOT NULL REFERENCES rentals (id) ON DELETE CASCADE,
  equipment_item_id  UUID          NOT NULL REFERENCES equipment_items (id) ON DELETE RESTRICT,
  category_id        UUID          NOT NULL REFERENCES equipment_categories (id) ON DELETE RESTRICT,
  agreed_daily_rate  NUMERIC(12,2) NOT NULL CHECK (agreed_daily_rate >= 0),
  rental_period      DATERANGE     NOT NULL,
  blocks_inventory   BOOLEAN       NOT NULL DEFAULT TRUE,
  assigned_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT uq_rental_item UNIQUE (rental_id, equipment_item_id),
  CONSTRAINT excl_asset_double_booking EXCLUDE USING gist (
    equipment_item_id WITH =,
    rental_period     WITH &&
  ) WHERE (blocks_inventory)
);
CREATE INDEX IF NOT EXISTS idx_rental_items_rental ON rental_items (rental_id);
CREATE INDEX IF NOT EXISTS idx_rental_items_item ON rental_items (equipment_item_id) WHERE blocks_inventory;

CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id       UUID          NOT NULL REFERENCES rentals (id) ON DELETE RESTRICT,
  gateway         TEXT          NOT NULL,
  gateway_tx_id   TEXT          NOT NULL,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method  TEXT          NOT NULL CHECK (payment_method IN ('PIX', 'CREDIT_CARD', 'BOLETO', 'INVOICED')),
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
CREATE INDEX IF NOT EXISTS idx_payments_rental ON payments (rental_id, created_at DESC);
DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway      TEXT        NOT NULL,
  event_id     TEXT        NOT NULL,
  event_type   TEXT        NOT NULL,
  payload      JSONB       NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_webhook_event UNIQUE (gateway, event_id)
);

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  phone_number   TEXT PRIMARY KEY CHECK (phone_number ~ '^[0-9]{10,15}$'),
  client_id      UUID        REFERENCES clients (id) ON DELETE SET NULL,
  current_state  TEXT        NOT NULL DEFAULT 'IDLE'
                 CHECK (current_state IN ('IDLE', 'AWAITING_CNPJ', 'AWAITING_CATEGORY', 'AWAITING_DATES',
                                          'AWAITING_ADDRESS', 'AWAITING_PAYMENT')),
  context_data   JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_sessions_client ON whatsapp_sessions (client_id);
`;

export const SEED_SQL = `
INSERT INTO equipment_categories (slug, name, description, base_daily_rate, replacement_cost, sort_order, image_url) VALUES
  ('compactador-de-solo',  'Compactador de Solo (Sapo)',        'Compactador a percussão 4T, ideal para valas, aterros e bases de piso.',        180.00, 14500.00, 10, '/images/equipment/compactador-de-solo.jpg'),
  ('placa-vibratoria',     'Placa Vibratória',                  'Placa reversível para compactação de bloquetes, brita e solo granular.',        150.00,  9800.00, 20, '/images/equipment/placa-vibratoria.jpg'),
  ('martelete-rompedor',   'Martelete Rompedor 10kg',           'Rompedor elétrico SDS-Max para demolição de concreto e alvenaria.',             120.00,  6500.00, 30, '/images/equipment/martelete-rompedor.jpg'),
  ('alisadora-de-concreto','Alisadora de Concreto (Bambolê)',   'Acabadora a gasolina 36" para desempeno e alisamento de lajes e pisos.',        160.00, 11000.00, 40, '/images/equipment/alisadora-de-concreto.jpg'),
  ('cortadora-de-piso',    'Cortadora de Piso e Asfalto',       'Serra com disco diamantado 14", corte a úmido até 12 cm de profundidade.',      190.00, 13500.00, 50, '/images/equipment/cortadora-de-piso.jpg'),
  ('andaime-tubular',      'Andaime Tubular (módulo 1,5 m)',    'Módulo com 2 painéis, travessas e sapatas. Diária por módulo.',                  12.00,   650.00, 60, '/images/equipment/andaime-tubular.jpg'),
  ('escora-metalica',      'Escora Metálica Regulável',         'Escora 2,0 a 3,5 m para escoramento de lajes e vigas. Diária por peça.',          3.50,   180.00, 70, '/images/equipment/escora-metalica.jpg')
ON CONFLICT (slug) DO UPDATE SET
  image_url = EXCLUDED.image_url;

WITH fleet(slug, prefix, units, in_maintenance) AS (
  VALUES
    ('compactador-de-solo',   'CMP',   6, 1),
    ('placa-vibratoria',      'PLV',   6, 0),
    ('martelete-rompedor',    'MRT',  10, 1),
    ('alisadora-de-concreto', 'ALS',   4, 0),
    ('cortadora-de-piso',     'CTP',   4, 1),
    ('andaime-tubular',       'AND',  60, 0),
    ('escora-metalica',       'ESC', 200, 0)
)
INSERT INTO equipment_items (category_id, asset_tag, serial_number, status)
SELECT c.id,
       f.prefix || '-' || lpad(n::text, 4, '0'),
       'SN' || upper(substr(md5(f.prefix || n::text), 1, 10)),
       CASE WHEN n > f.units - f.in_maintenance THEN 'MAINTENANCE' ELSE 'AVAILABLE' END
FROM fleet f
JOIN equipment_categories c ON c.slug = f.slug
CROSS JOIN LATERAL generate_series(1, f.units) AS n
ON CONFLICT (asset_tag) DO NOTHING;

INSERT INTO clients (cnpj, company_name, trade_name, email, phone, credit_limit) VALUES
  ('11222333000181', 'Construtora Exemplo Ltda', 'Exemplo Obras', 'compras@exemplo-obras.com.br', '5511987654321', 50000.00)
ON CONFLICT (cnpj) DO UPDATE SET
  credit_limit = EXCLUDED.credit_limit;
`;
