-- =============================================================================
-- 003_remove_credit.sql — Exclusão da parte de crédito e limite equipamentos para obras e reformas
-- =============================================================================

ALTER TABLE clients
  DROP COLUMN IF EXISTS credit_status,
  DROP COLUMN IF EXISTS credit_limit;

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_payment_method_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method IN ('PIX', 'CREDIT_CARD', 'BOLETO'));
