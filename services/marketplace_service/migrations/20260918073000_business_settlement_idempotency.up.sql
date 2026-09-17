ALTER TABLE business_settlements
  ADD COLUMN IF NOT EXISTS idempotency_key UUID;

UPDATE business_settlements
SET idempotency_key = id
WHERE idempotency_key IS NULL;

ALTER TABLE business_settlements
  ALTER COLUMN idempotency_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_settlements_business_idempotency
  ON business_settlements (business_id, idempotency_key);
