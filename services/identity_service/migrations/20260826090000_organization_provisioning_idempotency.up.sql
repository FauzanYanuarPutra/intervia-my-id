SET search_path = core, identity, public, events, audit;

-- Display names are not identities. Multiple tenants may legitimately use the
-- same business name; the canonical slug remains globally unique.
ALTER TABLE core.organizations
  DROP CONSTRAINT IF EXISTS organizations_name_key;

CREATE TABLE IF NOT EXISTS core.organization_provisioning_idempotency (
  actor_user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  idempotency_key UUID NOT NULL,
  request_hash CHAR(64) NOT NULL,
  organization_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (actor_user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_organization_provisioning_organization
  ON core.organization_provisioning_idempotency (organization_id);
