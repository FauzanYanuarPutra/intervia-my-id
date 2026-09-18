DROP INDEX IF EXISTS uq_business_yield_observations_business_idempotency;
ALTER TABLE business_material_yield_observations
  DROP COLUMN IF EXISTS idempotency_key;

DROP INDEX IF EXISTS uq_business_obligations_business_idempotency;
ALTER TABLE business_recurring_obligations
  DROP COLUMN IF EXISTS idempotency_key;
