DROP INDEX IF EXISTS idx_content_price_unit;

ALTER TABLE content_items
  DROP CONSTRAINT IF EXISTS chk_content_items_price_unit_format;

ALTER TABLE content_items
  DROP COLUMN IF EXISTS price_unit;
