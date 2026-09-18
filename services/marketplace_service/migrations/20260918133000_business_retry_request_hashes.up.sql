ALTER TABLE business_settlements
  ADD COLUMN IF NOT EXISTS request_hash TEXT
  CHECK (request_hash IS NULL OR char_length(request_hash) = 64);

ALTER TABLE business_recurring_obligations
  ADD COLUMN IF NOT EXISTS request_hash TEXT
  CHECK (request_hash IS NULL OR char_length(request_hash) = 64);

ALTER TABLE business_obligation_payments
  ADD COLUMN IF NOT EXISTS request_hash TEXT
  CHECK (request_hash IS NULL OR char_length(request_hash) = 64);

ALTER TABLE business_purchases
  ADD COLUMN IF NOT EXISTS request_hash TEXT
  CHECK (request_hash IS NULL OR char_length(request_hash) = 64);

ALTER TABLE business_material_yield_observations
  ADD COLUMN IF NOT EXISTS request_hash TEXT
  CHECK (request_hash IS NULL OR char_length(request_hash) = 64);
