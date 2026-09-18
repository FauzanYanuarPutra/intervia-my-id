ALTER TABLE business_recurring_obligations
  ADD COLUMN IF NOT EXISTS idempotency_key UUID;

UPDATE business_recurring_obligations
SET idempotency_key = id
WHERE idempotency_key IS NULL;

ALTER TABLE business_recurring_obligations
  ALTER COLUMN idempotency_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_obligations_business_idempotency
  ON business_recurring_obligations (business_id, idempotency_key);

ALTER TABLE business_material_yield_observations
  ADD COLUMN IF NOT EXISTS idempotency_key UUID;

UPDATE business_material_yield_observations
SET idempotency_key = id
WHERE idempotency_key IS NULL;

ALTER TABLE business_material_yield_observations
  ALTER COLUMN idempotency_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_yield_observations_business_idempotency
  ON business_material_yield_observations (business_id, idempotency_key);
