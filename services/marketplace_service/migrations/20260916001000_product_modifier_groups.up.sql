ALTER TABLE business_products
  ADD COLUMN IF NOT EXISTS modifier_groups JSONB NOT NULL DEFAULT '[]'::JSONB;

CREATE INDEX IF NOT EXISTS idx_business_products_modifier_groups_gin
  ON business_products USING GIN (modifier_groups);
