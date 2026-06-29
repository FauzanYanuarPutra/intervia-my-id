ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS seller_type TEXT;

ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS minimum_order TEXT;
