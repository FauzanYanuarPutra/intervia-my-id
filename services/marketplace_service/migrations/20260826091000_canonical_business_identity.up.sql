CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  capability_key TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'archived')),
  created_by_user_id UUID NOT NULL,
  idempotency_key UUID NOT NULL,
  provisioning_request_hash CHAR(64) NOT NULL,
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (created_by_user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_businesses_organization_status
  ON businesses (organization_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS business_store_links (
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES umkm_stores(id) ON DELETE RESTRICT,
  link_type TEXT NOT NULL DEFAULT 'primary'
    CHECK (link_type IN ('primary', 'outlet')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (business_id, store_id),
  UNIQUE (store_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_store_links_primary
  ON business_store_links (business_id)
  WHERE link_type = 'primary';

ALTER TABLE business_locations
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_business_locations_business_active
  ON business_locations (business_id, is_primary, updated_at DESC)
  WHERE business_id IS NOT NULL AND status = 'active';
