ALTER TABLE content_items
  DROP COLUMN IF EXISTS minimum_order;

ALTER TABLE content_items
  DROP COLUMN IF EXISTS seller_type;
