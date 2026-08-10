CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_umkm_stores_active_lat_lng
  ON umkm_stores (lat, lng, updated_at DESC)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_umkm_stores_active_updated
  ON umkm_stores (updated_at DESC, id)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_umkm_stores_name_trgm
  ON umkm_stores USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_umkm_stores_city_trgm
  ON umkm_stores USING GIN (city gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_umkm_stores_search_text_trgm
  ON umkm_stores USING GIN ((COALESCE(metadata->>'search_text', '')) gin_trgm_ops);
