ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS business_id UUID NULL,
  ADD COLUMN IF NOT EXISTS source_type TEXT NULL,
  ADD COLUMN IF NOT EXISTS source_surface TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_business_created_at
  ON orders (business_id, created_at DESC)
  WHERE business_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_business_source_created_at
  ON orders (business_id, source_type, created_at DESC)
  WHERE business_id IS NOT NULL;
