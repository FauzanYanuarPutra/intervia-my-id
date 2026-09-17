ALTER TABLE business_products
  ADD COLUMN image_url TEXT NULL,
  ADD COLUMN image_mime_type TEXT NULL,
  ADD COLUMN image_width INTEGER NULL,
  ADD COLUMN image_height INTEGER NULL;

ALTER TABLE business_products
  ADD CONSTRAINT ck_business_products_image_complete CHECK (
    (image_url IS NULL AND image_mime_type IS NULL AND image_width IS NULL AND image_height IS NULL)
    OR
    (image_url IS NOT NULL AND image_mime_type IS NOT NULL AND image_width IS NOT NULL AND image_height IS NOT NULL)
  ),
  ADD CONSTRAINT ck_business_products_image_url CHECK (
    image_url IS NULL OR (
      LENGTH(image_url) <= 500
      AND image_url ~ '^/api/forum/media/[A-Za-z0-9][A-Za-z0-9._-]{0,199}$'
    )
  ),
  ADD CONSTRAINT ck_business_products_image_mime_type CHECK (
    image_mime_type IS NULL OR image_mime_type IN ('image/webp', 'image/jpeg', 'image/png')
  ),
  ADD CONSTRAINT ck_business_products_image_dimensions CHECK (
    image_width IS NULL OR (
      image_width BETWEEN 320 AND 4096
      AND image_height BETWEEN 320 AND 4096
      AND image_width = image_height
    )
  );
