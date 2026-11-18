-- =============================================================================
-- 002_enhancements.sql — equipamentos para obras e reformas Credit Limit & Invoiced 28 DDL Payment Method
-- =============================================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12,2) NOT NULL DEFAULT 15000.00 CHECK (credit_limit >= 0);

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE rentals
  ADD COLUMN IF NOT EXISTS delivery_time_slot TEXT;

UPDATE clients
SET credit_limit = 50000.00
WHERE cnpj = '11222333000181';

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_payment_method_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method IN ('PIX', 'CREDIT_CARD', 'BOLETO', 'INVOICED'));
