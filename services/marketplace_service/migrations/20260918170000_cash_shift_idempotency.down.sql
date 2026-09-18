DROP INDEX IF EXISTS uq_business_cash_shift_close_idempotency;
DROP INDEX IF EXISTS uq_business_cash_shift_open_idempotency;

ALTER TABLE business_cash_shifts
  DROP CONSTRAINT IF EXISTS chk_cash_shift_close_idempotency_pair,
  DROP CONSTRAINT IF EXISTS chk_cash_shift_open_idempotency_pair,
  DROP COLUMN IF EXISTS close_request_hash,
  DROP COLUMN IF EXISTS close_idempotency_key,
  DROP COLUMN IF EXISTS open_request_hash,
  DROP COLUMN IF EXISTS open_idempotency_key;
