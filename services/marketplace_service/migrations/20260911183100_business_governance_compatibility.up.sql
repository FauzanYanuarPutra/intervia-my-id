-- Preserve compatibility with pre-Wave-2B.2 provisioning while keeping legal
-- relationships and jurisdictions evidence-based rather than inferred.

ALTER TABLE business_locations
  ALTER COLUMN branch_code SET DEFAULT 'MAIN',
  ALTER COLUMN branch_kind SET DEFAULT 'store';

-- Location-scoped grants and compliance facts must point to a location from the
-- same business/organization boundary. The nullable legacy columns remain
-- supported; composite FKs apply whenever a location is present.
ALTER TABLE business_locations
  ADD CONSTRAINT uq_business_locations_id_business_organization
    UNIQUE (id, business_id, organization_id);

ALTER TABLE business_member_roles
  DROP CONSTRAINT business_member_roles_location_id_fkey,
  ADD CONSTRAINT fk_business_member_roles_location_scope
    FOREIGN KEY (location_id, business_id, organization_id)
    REFERENCES business_locations(id, business_id, organization_id)
    ON DELETE CASCADE;

ALTER TABLE business_jurisdictions
  DROP CONSTRAINT business_jurisdictions_location_id_fkey,
  ADD CONSTRAINT fk_business_jurisdictions_location_scope
    FOREIGN KEY (location_id, business_id, organization_id)
    REFERENCES business_locations(id, business_id, organization_id)
    ON DELETE RESTRICT;

-- Audit events are immutable snapshots. FK actions must never UPDATE or DELETE
-- an audit row behind the append-only trigger, so both references are restrictive.
ALTER TABLE business_audit_events
  DROP CONSTRAINT business_audit_events_location_id_fkey,
  DROP CONSTRAINT fk_business_audit_events_business_scope,
  ADD CONSTRAINT fk_business_audit_events_location_scope
    FOREIGN KEY (location_id, business_id, organization_id)
    REFERENCES business_locations(id, business_id, organization_id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT fk_business_audit_events_business_scope
    FOREIGN KEY (business_id, organization_id)
    REFERENCES businesses(id, organization_id)
    ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION initialize_business_governance_access()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  owner_role_id UUID;
  creator_membership_id UUID;
BEGIN
  INSERT INTO business_roles (
    organization_id, business_id, role_key, name, is_system
  ) VALUES (
    NEW.organization_id, NEW.id, 'owner', 'Owner access', TRUE
  )
  ON CONFLICT (business_id, role_key)
  DO UPDATE SET updated_at = business_roles.updated_at
  RETURNING id INTO owner_role_id;

  INSERT INTO business_role_permissions (role_id, permission_key)
  SELECT owner_role_id, permission_key
  FROM business_permissions
  ON CONFLICT DO NOTHING;

  INSERT INTO business_memberships (
    organization_id, business_id, user_id, status,
    effective_from, metadata
  ) VALUES (
    NEW.organization_id, NEW.id, NEW.created_by_user_id, 'active',
    NEW.created_at,
    jsonb_build_object('source', 'business_insert_trigger', 'legal_relationship_inferred', false)
  )
  ON CONFLICT (business_id, user_id)
  DO UPDATE SET
    status = 'active',
    effective_until = NULL,
    updated_at = NOW()
  RETURNING id INTO creator_membership_id;

  INSERT INTO business_member_roles (
    organization_id, business_id, membership_id, role_id, effective_from
  ) VALUES (
    NEW.organization_id, NEW.id, creator_membership_id, owner_role_id, NEW.created_at
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO business_audit_events (
    organization_id, business_id, actor_user_id,
    event_key, subject_type, subject_id, reason, metadata,
    occurred_at
  ) VALUES (
    NEW.organization_id, NEW.id, NEW.created_by_user_id,
    'governance.access_initialized', 'business', NEW.id,
    'Creator technical governance access initialized',
    jsonb_build_object('role_key', 'owner', 'legal_relationship_inferred', false),
    NEW.created_at
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_business_initialize_governance_access
AFTER INSERT ON businesses
FOR EACH ROW EXECUTE FUNCTION initialize_business_governance_access();
