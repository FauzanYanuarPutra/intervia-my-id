DROP INDEX IF EXISTS idx_orders_business_source_created_at;
DROP INDEX IF EXISTS idx_orders_business_created_at;

ALTER TABLE orders
  DROP COLUMN IF EXISTS source_surface,
  DROP COLUMN IF EXISTS source_type,
  DROP COLUMN IF EXISTS business_id;
