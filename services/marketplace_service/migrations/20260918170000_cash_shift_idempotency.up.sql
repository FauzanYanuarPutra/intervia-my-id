ALTER TABLE business_cash_shifts
  ADD COLUMN IF NOT EXISTS open_idempotency_key UUID,
  ADD COLUMN IF NOT EXISTS open_request_hash TEXT,
  ADD COLUMN IF NOT EXISTS close_idempotency_key UUID,
  ADD COLUMN IF NOT EXISTS close_request_hash TEXT;

ALTER TABLE business_cash_shifts
  ADD CONSTRAINT chk_cash_shift_open_idempotency_pair
  CHECK ((open_idempotency_key IS NULL) = (open_request_hash IS NULL));

ALTER TABLE business_cash_shifts
  ADD CONSTRAINT chk_cash_shift_close_idempotency_pair
  CHECK ((close_idempotency_key IS NULL) = (close_request_hash IS NULL));

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_cash_shift_open_idempotency
  ON business_cash_shifts (business_id, open_idempotency_key)
  WHERE open_idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_cash_shift_close_idempotency
  ON business_cash_shifts (business_id, close_idempotency_key)
  WHERE close_idempotency_key IS NOT NULL;
