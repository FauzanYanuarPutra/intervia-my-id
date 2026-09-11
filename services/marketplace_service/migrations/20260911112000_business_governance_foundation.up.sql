-- Business OS V3 Wave 2B.2
-- Rights/governance foundation layered on the existing canonical business model.
-- `organization_id` remains the workspace/tenant boundary.

CREATE UNIQUE INDEX IF NOT EXISTS uq_businesses_id_organization
  ON businesses (id, organization_id);

-- Reconcile canonical business ownership onto legacy locations before projecting
-- them as branches. The store link is the canonical existing business<->store link.
UPDATE business_locations l
SET
  business_id = link.business_id,
  organization_id = b.organization_id,
  updated_at = NOW()
FROM business_store_links link
JOIN businesses b ON b.id = link.business_id
WHERE l.store_id = link.store_id
  AND (
    l.business_id IS DISTINCT FROM link.business_id
    OR l.organization_id IS DISTINCT FROM b.organization_id
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_locations_tenant_identity
  ON business_locations (id, business_id, organization_id);

-- A branch is governance/operational identity layered over an existing canonical
-- business location. Existing storefront/order code can continue using stores and
-- business_locations while later waves adopt branch identity incrementally.
CREATE TABLE IF NOT EXISTS business_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  location_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'temporarily_closed', 'closed')),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_business_branches_effective_period
    CHECK (effective_until IS NULL OR effective_until > effective_from),
  CONSTRAINT fk_business_branches_business_tenant
    FOREIGN KEY (business_id, organization_id)
    REFERENCES businesses (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_business_branches_location_tenant
    FOREIGN KEY (location_id, business_id, organization_id)
    REFERENCES business_locations (id, business_id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT uq_business_branches_location UNIQUE (location_id),
  CONSTRAINT uq_business_branches_code UNIQUE (business_id, code)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_branches_tenant_identity
  ON business_branches (id, business_id, organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_business_branches_primary
  ON business_branches (business_id)
  WHERE is_primary AND effective_until IS NULL;
CREATE INDEX IF NOT EXISTS idx_business_branches_tenant_status
  ON business_branches (organization_id, business_id, status, updated_at DESC);

INSERT INTO business_branches (
  business_id, organization_id, location_id, code, name, status,
  is_primary, timezone, effective_from, metadata
)
SELECT
  l.business_id,
  l.organization_id,
  l.id,
  CASE
    WHEN link.link_type = 'primary' AND l.is_primary THEN 'main'
    ELSE 'branch-' || replace(l.id::text, '-', '')
  END,
  l.name,
  l.status,
  link.link_type = 'primary' AND l.is_primary,
  l.timezone,
  l.created_at,
  jsonb_build_object(
    'source', 'business_location_backfill',
    'store_link_type', link.link_type
  )
FROM business_locations l
JOIN business_store_links link
  ON link.business_id = l.business_id
 AND link.store_id = l.store_id
WHERE l.business_id IS NOT NULL
  AND l.organization_id IS NOT NULL
ON CONFLICT (location_id) DO NOTHING;

-- Real-world relationship is deliberately separate from application access.
CREATE TABLE IF NOT EXISTS business_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  subject_kind TEXT NOT NULL
    CHECK (subject_kind IN ('user', 'organization', 'external_person', 'external_organization')),
  subject_id UUID NOT NULL,
  relationship_type TEXT NOT NULL
    CHECK (relationship_type IN (
      'owner', 'manager', 'employee', 'contractor', 'supplier',
      'partner', 'customer', 'other'
    )),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'ended')),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_until TIMESTAMPTZ NULL,
  terms_version TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_business_relationships_effective_period
    CHECK (effective_until IS NULL OR effective_until > effective_from),
  CONSTRAINT fk_business_relationships_business_tenant
    FOREIGN KEY (business_id, organization_id)
    REFERENCES businesses (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT uq_business_relationships_effective_identity
    UNIQUE (business_id, subject_kind, subject_id, relationship_type, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_business_relationships_subject_active
  ON business_relationships (subject_kind, subject_id, business_id, effective_from DESC)
  WHERE effective_until IS NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_business_relationships_tenant
  ON business_relationships (organization_id, business_id, relationship_type, status);

-- Explicit permission catalog and system roles. Unknown roles fail closed through
-- the foreign key from access grants.
CREATE TABLE IF NOT EXISTS business_permissions (
  permission_key TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_roles (
  role_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_business_roles_key
    CHECK (role_key ~ '^[a-z][a-z0-9_]*$')
);

CREATE TABLE IF NOT EXISTS business_role_permissions (
  role_key TEXT NOT NULL REFERENCES business_roles(role_key) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES business_permissions(permission_key) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_key, permission_key)
);

INSERT INTO business_permissions (permission_key, description) VALUES
  ('business.view', 'View business profile and operational context'),
  ('business.update', 'Update business profile and settings'),
  ('branch.view', 'View branches'),
  ('branch.manage', 'Create and manage branches'),
  ('catalog.view', 'View catalog'),
  ('catalog.manage', 'Manage catalog'),
  ('order.view', 'View orders'),
  ('order.create', 'Create orders'),
  ('order.update', 'Update order workflow'),
  ('order.cancel', 'Cancel orders subject to policy'),
  ('inventory.view', 'View inventory'),
  ('inventory.manage', 'Manage inventory movements and counts'),
  ('payment.view', 'View payments and reconciliation'),
  ('payment.refund', 'Initiate refunds subject to policy'),
  ('employee.view', 'View workforce records permitted by policy'),
  ('employee.manage', 'Manage workforce records permitted by policy'),
  ('finance.view', 'View finance reports'),
  ('finance.manage', 'Manage finance records'),
  ('compliance.view', 'View compliance records'),
  ('compliance.manage', 'Manage compliance records'),
  ('member.manage', 'Manage business access grants')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO business_roles (role_key, display_name) VALUES
  ('owner', 'Owner'),
  ('manager', 'Manager'),
  ('cashier', 'Cashier'),
  ('inventory', 'Inventory'),
  ('finance', 'Finance'),
  ('staff', 'Staff')
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO business_role_permissions (role_key, permission_key)
SELECT 'owner', permission_key FROM business_permissions
ON CONFLICT DO NOTHING;

INSERT INTO business_role_permissions (role_key, permission_key) VALUES
  ('manager', 'business.view'),
  ('manager', 'business.update'),
  ('manager', 'branch.view'),
  ('manager', 'branch.manage'),
  ('manager', 'catalog.view'),
  ('manager', 'catalog.manage'),
  ('manager', 'order.view'),
  ('manager', 'order.create'),
  ('manager', 'order.update'),
  ('manager', 'order.cancel'),
  ('manager', 'inventory.view'),
  ('manager', 'inventory.manage'),
  ('manager', 'payment.view'),
  ('manager', 'employee.view'),
  ('manager', 'finance.view'),
  ('manager', 'compliance.view'),
  ('cashier', 'business.view'),
  ('cashier', 'branch.view'),
  ('cashier', 'catalog.view'),
  ('cashier', 'order.view'),
  ('cashier', 'order.create'),
  ('cashier', 'order.update'),
  ('cashier', 'order.cancel'),
  ('cashier', 'payment.view'),
  ('inventory', 'business.view'),
  ('inventory', 'branch.view'),
  ('inventory', 'catalog.view'),
  ('inventory', 'inventory.view'),
  ('inventory', 'inventory.manage'),
  ('finance', 'business.view'),
  ('finance', 'payment.view'),
  ('finance', 'payment.refund'),
  ('finance', 'finance.view'),
  ('finance', 'finance.manage'),
  ('staff', 'business.view'),
  ('staff', 'branch.view'),
  ('staff', 'catalog.view'),
  ('staff', 'order.view')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS business_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role_key TEXT NOT NULL REFERENCES business_roles(role_key) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'expired')),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_until TIMESTAMPTZ NULL,
  granted_by_user_id UUID NOT NULL,
  reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_business_access_grants_effective_period
    CHECK (effective_until IS NULL OR effective_until > effective_from),
  CONSTRAINT fk_business_access_grants_business_tenant
    FOREIGN KEY (business_id, organization_id)
    REFERENCES businesses (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT uq_business_access_grants_effective_identity
    UNIQUE (business_id, user_id, role_key, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_business_access_grants_user_active
  ON business_access_grants (user_id, business_id, role_key, effective_from DESC)
  WHERE effective_until IS NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_business_access_grants_tenant
  ON business_access_grants (organization_id, business_id, status);

-- Preserve current creator ownership explicitly instead of relying on implicit
-- creator semantics after the governance model lands.
INSERT INTO business_relationships (
  business_id, organization_id, subject_kind, subject_id,
  relationship_type, effective_from, created_by_user_id, metadata
)
SELECT
  b.id,
  b.organization_id,
  'user',
  b.created_by_user_id,
  'owner',
  b.created_at,
  b.created_by_user_id,
  jsonb_build_object('source', 'business_creator_backfill')
FROM businesses b
ON CONFLICT DO NOTHING;

INSERT INTO business_access_grants (
  business_id, organization_id, user_id, role_key,
  effective_from, granted_by_user_id, reason
)
SELECT
  b.id,
  b.organization_id,
  b.created_by_user_id,
  'owner',
  b.created_at,
  b.created_by_user_id,
  'business_creator_backfill'
FROM businesses b
ON CONFLICT DO NOTHING;

-- Jurisdiction facts are versioned inputs for a later policy/compliance engine.
-- This table intentionally contains no regulation-specific decision logic.
CREATE TABLE IF NOT EXISTS business_jurisdictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  branch_id UUID NULL,
  country_code CHAR(2) NOT NULL,
  subdivision_code TEXT NULL,
  city TEXT NULL,
  district TEXT NULL,
  regime_key TEXT NOT NULL DEFAULT 'general',
  effective_from TIMESTAMPTZ NOT NULL,
  effective_until TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_business_jurisdictions_country
    CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT ck_business_jurisdictions_effective_period
    CHECK (effective_until IS NULL OR effective_until > effective_from),
  CONSTRAINT fk_business_jurisdictions_business_tenant
    FOREIGN KEY (business_id, organization_id)
    REFERENCES businesses (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_business_jurisdictions_branch_tenant
    FOREIGN KEY (branch_id, business_id, organization_id)
    REFERENCES business_branches (id, business_id, organization_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_business_jurisdictions_effective
  ON business_jurisdictions (organization_id, business_id, branch_id, effective_from DESC);

INSERT INTO business_jurisdictions (
  business_id, organization_id, branch_id, country_code,
  city, district, regime_key, effective_from, metadata, created_by_user_id
)
SELECT
  br.business_id,
  br.organization_id,
  br.id,
  'ID',
  NULLIF(l.city, ''),
  NULLIF(l.district, ''),
  'general',
  br.effective_from,
  jsonb_build_object(
    'source', 'business_location_backfill',
    'province', l.province
  ),
  b.created_by_user_id
FROM business_branches br
JOIN business_locations l ON l.id = br.location_id
JOIN businesses b ON b.id = br.business_id AND b.organization_id = br.organization_id
WHERE NOT EXISTS (
  SELECT 1
  FROM business_jurisdictions j
  WHERE j.branch_id = br.id
    AND j.effective_until IS NULL
);

-- Evidence stores integrity metadata, not mutable truth. The referenced bytes can
-- live in the existing storage layer while this record preserves their hash.
CREATE TABLE IF NOT EXISTS business_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  evidence_type TEXT NOT NULL
    CHECK (evidence_type IN ('document', 'photo', 'receipt', 'invoice', 'system_event', 'other')),
  content_sha256 CHAR(64) NOT NULL
    CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  storage_ref TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_evidence_business_tenant
    FOREIGN KEY (business_id, organization_id)
    REFERENCES businesses (id, organization_id)
    ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_evidence_tenant_identity
  ON business_evidence (id, business_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_business_evidence_business_captured
  ON business_evidence (organization_id, business_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS business_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  actor_user_id UUID NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evidence_id UUID NULL,
  source TEXT NOT NULL DEFAULT 'marketplace_service',
  request_id UUID NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT fk_business_audit_events_business_tenant
    FOREIGN KEY (business_id, organization_id)
    REFERENCES businesses (id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_business_audit_events_evidence_tenant
    FOREIGN KEY (evidence_id, business_id, organization_id)
    REFERENCES business_evidence (id, business_id, organization_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_business_audit_events_business_recorded
  ON business_audit_events (organization_id, business_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_audit_events_entity
  ON business_audit_events (business_id, entity_type, entity_id, recorded_at DESC);

CREATE OR REPLACE FUNCTION reject_business_governance_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only and cannot be %d', TG_TABLE_NAME, lower(TG_OP);
END;
$$;

CREATE TRIGGER trg_business_evidence_append_only
BEFORE UPDATE OR DELETE ON business_evidence
FOR EACH ROW EXECUTE FUNCTION reject_business_governance_history_mutation();

CREATE TRIGGER trg_business_audit_events_append_only
BEFORE UPDATE OR DELETE ON business_audit_events
FOR EACH ROW EXECUTE FUNCTION reject_business_governance_history_mutation();
