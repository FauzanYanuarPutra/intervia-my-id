CREATE INDEX IF NOT EXISTS idx_umkm_stores_reference_map_location
  ON umkm_stores (lat, lng, updated_at DESC, id)
  WHERE is_active = TRUE
    AND lower(COALESCE(metadata->>'is_transactional', 'true')) = 'false'
    AND lower(COALESCE(metadata->>'record_kind', '')) LIKE '%reference%';

CREATE INDEX IF NOT EXISTS idx_umkm_stores_reference_source
  ON umkm_stores (
    (metadata->>'source_id'),
    (metadata->>'source_record_id')
  )
  WHERE lower(COALESCE(metadata->>'record_kind', '')) LIKE '%reference%';
