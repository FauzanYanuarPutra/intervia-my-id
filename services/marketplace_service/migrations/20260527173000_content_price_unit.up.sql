ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS price_unit TEXT;

DO $$
BEGIN
  ALTER TABLE content_items DROP CONSTRAINT IF EXISTS chk_content_items_price_unit_format;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE content_items
    ADD CONSTRAINT chk_content_items_price_unit_format
    CHECK (
      price_unit IS NULL OR
      (
        length(price_unit) BETWEEN 1 AND 40 AND
        price_unit ~ '^[a-z0-9][a-z0-9_-]*$'
      )
    )
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

UPDATE content_items
SET price_unit = CASE
  WHEN COALESCE(metadata->>'price_unit', metadata->>'unit', metadata->>'unit_label', metadata->>'price_basis', '') ~* '(pcs|piece|buah|item)' THEN 'pcs'
  WHEN COALESCE(metadata->>'price_unit', metadata->>'unit', metadata->>'unit_label', metadata->>'price_basis', '') ~* '(unit)' THEN 'unit'
  WHEN COALESCE(metadata->>'price_unit', metadata->>'unit', metadata->>'unit_label', metadata->>'price_basis', '') ~* '(paket|pack|bundle)' THEN 'pack'
  WHEN COALESCE(metadata->>'price_unit', metadata->>'unit', metadata->>'unit_label', metadata->>'price_basis', '') ~* '(bal|bale)' THEN 'bal'
  WHEN COALESCE(metadata->>'price_unit', metadata->>'unit', metadata->>'unit_label', metadata->>'price_basis', '') ~* '(karton|carton)' THEN 'carton'
  WHEN COALESCE(metadata->>'price_unit', metadata->>'unit', metadata->>'unit_label', metadata->>'price_basis', '') ~* '(box|dus)' THEN 'box'
  WHEN COALESCE(metadata->>'price_unit', metadata->>'unit', metadata->>'unit_label', metadata->>'price_basis', '') ~* '(kg|kilogram)' THEN 'kg'
  WHEN COALESCE(metadata->>'price_unit', metadata->>'unit', metadata->>'unit_label', metadata->>'price_basis', '') ~* '(liter|litre|ltr)' THEN 'liter'
  WHEN COALESCE(metadata->>'price_unit', metadata->>'unit', metadata->>'unit_label', metadata->>'price_basis', '') ~* '(m2|sqm|square meter)' THEN 'sqm'
  WHEN COALESCE(metadata->>'price_unit', metadata->>'unit', metadata->>'unit_label', metadata->>'price_basis', '') ~* '(jam|hour|hourly)' THEN 'hour'
  WHEN COALESCE(metadata->>'price_unit', metadata->>'unit', metadata->>'unit_label', metadata->>'price_basis', '') ~* '(hari|day|daily)' THEN 'day'
  WHEN COALESCE(metadata->>'price_unit', metadata->>'unit', metadata->>'unit_label', metadata->>'price_basis', '') ~* '(minggu|week|weekly)' THEN 'week'
  WHEN COALESCE(metadata->>'price_unit', metadata->>'unit', metadata->>'unit_label', metadata->>'price_basis', '') ~* '(bulan|month|monthly)' THEN 'month'
  WHEN COALESCE(metadata->>'price_unit', metadata->>'unit', metadata->>'unit_label', metadata->>'price_basis', '') ~* '(tahun|year|annual)' THEN 'year'
  WHEN COALESCE(metadata->>'price_unit', metadata->>'unit', metadata->>'unit_label', metadata->>'price_basis', '') ~* '(sesi|session|meeting)' THEN 'session'
  WHEN COALESCE(metadata->>'price_unit', metadata->>'unit', metadata->>'unit_label', metadata->>'price_basis', '') ~* '(proyek|project|brief)' THEN 'project'
  WHEN COALESCE(metadata->>'price_unit', metadata->>'unit', metadata->>'unit_label', metadata->>'price_basis', '') ~* '(pengiriman|shipment|delivery|kirim)' THEN 'shipment'
  WHEN COALESCE(metadata->>'price_unit', metadata->>'unit', metadata->>'unit_label', metadata->>'price_basis', '') ~* '(event|acara)' THEN 'event'
  WHEN COALESCE(metadata->>'price_unit', metadata->>'unit', metadata->>'unit_label', metadata->>'price_basis', '') ~* '(deal|handover|oper usaha|transfer)' THEN 'deal'
  WHEN COALESCE(metadata->>'rate_type', '') ~* '(bulan|month|monthly)' THEN 'month'
  WHEN COALESCE(metadata->>'rate_type', '') ~* '(minggu|week|weekly)' THEN 'week'
  WHEN COALESCE(metadata->>'rate_type', '') ~* '(hari|day|daily)' THEN 'day'
  WHEN COALESCE(metadata->>'rate_type', '') ~* '(jam|hour|hourly)' THEN 'hour'
  WHEN COALESCE(metadata->>'rental_rate_type', metadata->>'rental_period', '') ~* '(bulan|month|monthly)' THEN 'month'
  WHEN COALESCE(metadata->>'rental_rate_type', metadata->>'rental_period', '') ~* '(minggu|week|weekly)' THEN 'week'
  WHEN COALESCE(metadata->>'rental_rate_type', metadata->>'rental_period', '') ~* '(hari|day|daily)' THEN 'day'
  WHEN COALESCE(metadata->>'lease_term', '') ~* '(tahun|year|annual)' THEN 'year'
  WHEN COALESCE(metadata->>'lease_term', '') ~* '(hari|day|event)' THEN 'day'
  WHEN COALESCE(metadata->>'lease_term', '') ~* '(bulan|month|monthly)' THEN 'month'
  WHEN COALESCE(metadata->>'compensation_period', '') ~* '(hari|day|shift)' THEN 'day'
  WHEN COALESCE(metadata->>'compensation_period', '') ~* '(jam|hour)' THEN 'hour'
  WHEN COALESCE(metadata->>'compensation_period', '') ~* '(bulan|month|monthly)' THEN 'month'
  WHEN COALESCE(metadata->>'minimum_order', '') ~* '(bal|bale)' THEN 'bal'
  WHEN COALESCE(metadata->>'minimum_order', '') ~* '(karton|carton)' THEN 'carton'
  WHEN COALESCE(metadata->>'minimum_order', '') ~* '(box|dus)' THEN 'box'
  WHEN COALESCE(metadata->>'minimum_order', '') ~* '(kg|kilogram)' THEN 'kg'
  WHEN COALESCE(metadata->>'minimum_order', '') ~* '(paket|pack)' THEN 'pack'
  WHEN content_type = 'property' THEN 'month'
  WHEN content_type = 'tool_rental' THEN 'day'
  WHEN content_type = 'job' THEN 'month'
  WHEN content_type = 'freelancer' THEN 'project'
  WHEN content_type = 'service' THEN 'project'
  WHEN content_type = 'business_transfer' THEN 'deal'
  WHEN content_type = 'product' THEN 'pcs'
  ELSE NULL
END
WHERE price_unit IS NULL;

UPDATE content_items
SET price_unit = NULL
WHERE price_unit IS NOT NULL
  AND NOT (
    length(price_unit) BETWEEN 1 AND 40 AND
    price_unit ~ '^[a-z0-9][a-z0-9_-]*$'
  );

UPDATE content_items
SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{price_unit}', to_jsonb(price_unit), true)
WHERE price_unit IS NOT NULL;

ALTER TABLE content_items
  VALIDATE CONSTRAINT chk_content_items_price_unit_format;

CREATE INDEX IF NOT EXISTS idx_content_price_unit ON content_items(price_unit);
