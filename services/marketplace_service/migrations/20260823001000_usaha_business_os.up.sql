ALTER TABLE umkm_stores
  ADD COLUMN IF NOT EXISTS organization_id UUID NULL;

CREATE INDEX IF NOT EXISTS idx_umkm_stores_organization_id
  ON umkm_stores (organization_id)
  WHERE organization_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS business_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES umkm_stores(id) ON DELETE CASCADE,
  organization_id UUID NULL,
  name TEXT NOT NULL,
  location_type TEXT NOT NULL DEFAULT 'physical'
    CHECK (location_type IN ('physical', 'service_area', 'online')),
  address TEXT NOT NULL DEFAULT '',
  province TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  district TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  lat DOUBLE PRECISION NULL CHECK (lat IS NULL OR (lat BETWEEN -90 AND 90)),
  lng DOUBLE PRECISION NULL CHECK (lng IS NULL OR (lng BETWEEN -180 AND 180)),
  phone TEXT NULL,
  whatsapp TEXT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  business_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  special_hours JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'temporarily_closed', 'closed')),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  public_visibility BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_locations_store_id ON business_locations(store_id);
CREATE INDEX IF NOT EXISTS idx_business_locations_organization_id ON business_locations(organization_id) WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_business_locations_primary_store ON business_locations(store_id) WHERE is_primary;
CREATE INDEX IF NOT EXISTS idx_business_locations_public_geo ON business_locations(city, public_visibility, status);

INSERT INTO business_locations (
  store_id, organization_id, name, address, city, lat, lng, phone, whatsapp,
  is_primary, public_visibility, metadata
)
SELECT
  s.id,
  s.organization_id,
  'Lokasi utama',
  COALESCE(s.address, ''),
  COALESCE(s.city, ''),
  s.lat,
  s.lng,
  s.phone,
  s.phone,
  TRUE,
  TRUE,
  jsonb_build_object('source', 'umkm_stores_backfill')
FROM umkm_stores s
WHERE NOT EXISTS (
  SELECT 1 FROM business_locations l WHERE l.store_id = s.id
);
