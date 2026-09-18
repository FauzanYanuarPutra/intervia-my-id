ALTER TABLE business_material_yield_observations
  DROP COLUMN IF EXISTS request_hash;

ALTER TABLE business_purchases
  DROP COLUMN IF EXISTS request_hash;

ALTER TABLE business_obligation_payments
  DROP COLUMN IF EXISTS request_hash;

ALTER TABLE business_recurring_obligations
  DROP COLUMN IF EXISTS request_hash;

ALTER TABLE business_settlements
  DROP COLUMN IF EXISTS request_hash;
