DROP INDEX IF EXISTS uq_business_settlements_business_idempotency;

ALTER TABLE business_settlements
  DROP COLUMN IF EXISTS idempotency_key;
