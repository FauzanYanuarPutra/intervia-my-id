-- Business OS V3 Wave 2B.2: additive governance foundation.
-- Existing organization/business/location identities remain canonical.

ALTER TABLE businesses
  ADD CONSTRAINT uq_businesses_id_organization UNIQUE (id, organization_id);

ALTER TABLE business_locations
  ADD COLUMN IF NOT EXISTS branch_code TEXT,
  ADD COLUMN IF NOT EXISTS branch_kind TEXT,
  ADD COLUMN IF NOT EXISTS opened_on DATE NULL,
  ADD COLUMN IF NOT EXISTS closed_on DATE NULL;

UPDATE business_locations
SET branch_code = CASE
      WHEN is_primary THEN 'MAIN'
      ELSE 'LOC-' || UPPER(SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 8))
    END,
    branch_kind = CASE location_type
      WHEN 'online' THEN 'online'
      WHEN 'service_area' THEN 'service_area'
      ELSE 'store'
    END
WHERE branch_code IS NULL OR branch_kind IS NULL;

ALTER TABLE business_locations
  ALTER COLUMN branch_code SET NOT NULL,
  ALTER COLUMN branch_kind SET NOT NULL;

ALTER TABLE business_locations
  ADD CONSTRAINT chk_business_locations_branch_code_nonempty
    CHECK (length(btrim(branch_code)) > 0),
  ADD CONSTRAINT chk_business_locations_branch_kind
    CHECK (branch_kind IN ('store', 'kiosk', 'office', 'warehouse', 'service_area', 'online')),
  ADD CONSTRAINT chk_business_locations_operating_dates
    CHECK (closed_on IS NULL OR opened_on IS NULL OR closed_on >= opened_on);

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_locations_business_branch_code
  ON business_locations (business_id, branch_code)
  WHERE business_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_locations_business_branch_kind
  ON business_locations (business_id, branch_kind, status)
  WHERE business_id IS NOT NULL;

CREATE TABLE business_permissions (
  permission_key TEXT PRIMARY KEY,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_business_permissions_key_nonempty CHECK (length(btrim(permission_key)) > 0)
);

INSERT INTO business_permissions (permission_key, description) VALUES
  ('business.view', 'View business configuration'),
  ('business.update', 'Update business configuration'),
  ('branch.view', 'View branches and locations'),
  ('branch.manage', 'Create and manage branches and locations'),
  ('catalog.view', 'View catalog management data'),
  ('catalog.manage', 'Manage catalog data'),
  ('order.view', 'View business orders'),
  ('order.manage', 'Manage business orders'),
  ('inventory.view', 'View inventory data'),
  ('inventory.manage', 'Manage inventory data'),
  ('payment.view', 'View payment data'),
  ('payment.manage', 'Manage payment operations'),
  ('finance.view', 'View finance data'),
  ('finance.manage', 'Manage finance data'),
  ('compliance.view', 'View legal and compliance metadata'),
  ('compliance.manage', 'Manage legal and compliance metadata'),
  ('member.view', 'View business memberships'),
  ('member.manage', 'Manage business memberships and access');

CREATE TABLE business_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'suspended')),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_memberships_business_scope
    FOREIGN KEY (business_id, organization_id)
    REFERENCES businesses(id, organization_id) ON DELETE CASCADE,
  CONSTRAINT chk_business_memberships_effective_window
    CHECK (effective_until IS NULL OR effective_until >= effective_from),
  UNIQUE (business_id, user_id),
  UNIQUE (id, business_id, organization_id)
);

CREATE INDEX idx_business_memberships_actor_scope
  ON business_memberships (user_id, organization_id, business_id, status);

CREATE TABLE business_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  role_key TEXT NOT NULL,
  name TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_roles_business_scope
    FOREIGN KEY (business_id, organization_id)
    REFERENCES businesses(id, organization_id) ON DELETE CASCADE,
  CONSTRAINT chk_business_roles_key_nonempty CHECK (length(btrim(role_key)) > 0),
  UNIQUE (business_id, role_key),
  UNIQUE (id, business_id, organization_id)
);

CREATE TABLE business_role_permissions (
  role_id UUID NOT NULL REFERENCES business_roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES business_permissions(permission_key) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE business_member_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  membership_id UUID NOT NULL,
  role_id UUID NOT NULL,
  location_id UUID NULL REFERENCES business_locations(id) ON DELETE CASCADE,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_member_roles_membership_scope
    FOREIGN KEY (membership_id, business_id, organization_id)
    REFERENCES business_memberships(id, business_id, organization_id) ON DELETE CASCADE,
  CONSTRAINT fk_business_member_roles_role_scope
    FOREIGN KEY (role_id, business_id, organization_id)
    REFERENCES business_roles(id, business_id, organization_id) ON DELETE CASCADE,
  CONSTRAINT chk_business_member_roles_effective_window
    CHECK (effective_until IS NULL OR effective_until >= effective_from)
);

CREATE UNIQUE INDEX uq_business_member_roles_active_scope
  ON business_member_roles (membership_id, role_id, COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE effective_until IS NULL;

CREATE INDEX idx_business_member_roles_scope
  ON business_member_roles (business_id, organization_id, membership_id);

CREATE TABLE business_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  relationship_type TEXT NOT NULL
    CHECK (relationship_type IN ('owner', 'employee', 'contractor', 'supplier', 'merchant_platform', 'partner', 'other')),
  party_user_id UUID NULL,
  party_label TEXT NULL,
  external_reference TEXT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ NULL,
  recorded_by_user_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_relationships_business_scope
    FOREIGN KEY (business_id, organization_id)
    REFERENCES businesses(id, organization_id) ON DELETE CASCADE,
  CONSTRAINT chk_business_relationships_party
    CHECK (party_user_id IS NOT NULL OR NULLIF(btrim(COALESCE(party_label, '')), '') IS NOT NULL OR NULLIF(btrim(COALESCE(external_reference, '')), '') IS NOT NULL),
  CONSTRAINT chk_business_relationships_effective_window
    CHECK (effective_until IS NULL OR effective_until >= effective_from)
);

CREATE INDEX idx_business_relationships_scope
  ON business_relationships (business_id, organization_id, relationship_type, effective_until);

CREATE TABLE business_jurisdictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  location_id UUID NULL REFERENCES business_locations(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  province TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  district TEXT NOT NULL DEFAULT '',
  authority_name TEXT NULL,
  registration_reference TEXT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ NULL,
  recorded_by_user_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_jurisdictions_business_scope
    FOREIGN KEY (business_id, organization_id)
    REFERENCES businesses(id, organization_id) ON DELETE CASCADE,
  CONSTRAINT chk_business_jurisdictions_country_code
    CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT chk_business_jurisdictions_effective_window
    CHECK (effective_until IS NULL OR effective_until >= effective_from)
);

CREATE INDEX idx_business_jurisdictions_scope
  ON business_jurisdictions (business_id, organization_id, effective_until);

CREATE TABLE business_legal_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  legal_name TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'other',
  registration_reference TEXT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ NULL,
  recorded_by_user_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_legal_profiles_business_scope
    FOREIGN KEY (business_id, organization_id)
    REFERENCES businesses(id, organization_id) ON DELETE CASCADE,
  CONSTRAINT chk_business_legal_profiles_name_nonempty CHECK (length(btrim(legal_name)) > 0),
  CONSTRAINT chk_business_legal_profiles_effective_window
    CHECK (effective_until IS NULL OR effective_until >= effective_from)
);

CREATE INDEX idx_business_legal_profiles_scope
  ON business_legal_profiles (business_id, organization_id, effective_until);

CREATE TABLE business_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  location_id UUID NULL REFERENCES business_locations(id) ON DELETE SET NULL,
  actor_user_id UUID NULL,
  event_key TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id UUID NULL,
  reason TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_audit_events_business_scope
    FOREIGN KEY (business_id, organization_id)
    REFERENCES businesses(id, organization_id) ON DELETE CASCADE,
  CONSTRAINT chk_business_audit_events_event_key_nonempty CHECK (length(btrim(event_key)) > 0),
  CONSTRAINT chk_business_audit_events_subject_type_nonempty CHECK (length(btrim(subject_type)) > 0)
);

CREATE INDEX idx_business_audit_events_timeline
  ON business_audit_events (business_id, organization_id, occurred_at DESC, id DESC);
CREATE INDEX idx_business_audit_events_actor
  ON business_audit_events (actor_user_id, occurred_at DESC)
  WHERE actor_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION reject_business_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'business_audit_events is append-only';
END;
$$;

CREATE TRIGGER trg_business_audit_events_append_only
BEFORE UPDATE OR DELETE ON business_audit_events
FOR EACH ROW EXECUTE FUNCTION reject_business_audit_event_mutation();

-- Backfill technical access only. This preserves application behavior without
-- asserting that the creator is a legal owner, worker, partner, or other party.
INSERT INTO business_roles (organization_id, business_id, role_key, name, is_system)
SELECT organization_id, id, 'owner', 'Owner access', TRUE
FROM businesses
ON CONFLICT (business_id, role_key) DO NOTHING;

INSERT INTO business_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM business_roles r
CROSS JOIN business_permissions p
WHERE r.role_key = 'owner' AND r.is_system = TRUE
ON CONFLICT DO NOTHING;

INSERT INTO business_memberships (
  organization_id, business_id, user_id, status, effective_from,
  metadata
)
SELECT
  organization_id, id, created_by_user_id, 'active', created_at,
  jsonb_build_object(
    'source', 'wave_2b2_creator_access_backfill',
    'legal_relationship_inferred', false
  )
FROM businesses
ON CONFLICT (business_id, user_id) DO NOTHING;

INSERT INTO business_member_roles (
  organization_id, business_id, membership_id, role_id, effective_from
)
SELECT
  m.organization_id, m.business_id, m.id, r.id,
  GREATEST(m.effective_from, r.created_at)
FROM business_memberships m
JOIN business_roles r
  ON r.business_id = m.business_id
 AND r.organization_id = m.organization_id
 AND r.role_key = 'owner'
JOIN businesses b
  ON b.id = m.business_id
 AND b.organization_id = m.organization_id
WHERE m.user_id = b.created_by_user_id
ON CONFLICT DO NOTHING;

-- Legal relationship, jurisdiction and legal-profile tables intentionally remain
-- empty until facts are explicitly recorded with an accountable actor/evidence.
INSERT INTO business_audit_events (
  organization_id, business_id, actor_user_id,
  event_key, subject_type, subject_id, reason, metadata, occurred_at
)
SELECT
  organization_id, id, NULL,
  'governance.backfilled', 'business', id,
  'Wave 2B.2 technical governance access backfill',
  jsonb_build_object(
    'source', 'migration_20260911183000',
    'legal_relationship_inferred', false,
    'jurisdiction_inferred', false,
    'legal_profile_inferred', false
  ),
  NOW()
FROM businesses;
