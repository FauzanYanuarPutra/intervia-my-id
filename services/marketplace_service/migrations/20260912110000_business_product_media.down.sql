ALTER TABLE business_products
  DROP CONSTRAINT IF EXISTS ck_business_products_image_dimensions,
  DROP CONSTRAINT IF EXISTS ck_business_products_image_mime_type,
  DROP CONSTRAINT IF EXISTS ck_business_products_image_url,
  DROP CONSTRAINT IF EXISTS ck_business_products_image_complete,
  DROP COLUMN IF EXISTS image_height,
  DROP COLUMN IF EXISTS image_width,
  DROP COLUMN IF EXISTS image_mime_type,
  DROP COLUMN IF EXISTS image_url;
