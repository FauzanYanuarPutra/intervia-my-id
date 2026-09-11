-- Preserve compatibility with pre-Wave-2B.2 provisioning while keeping legal
-- relationships and jurisdictions evidence-based rather than inferred.

ALTER TABLE business_locations
  ALTER COLUMN branch_code SET DEFAULT 'MAIN',
  ALTER COLUMN branch_kind SET DEFAULT 'store';

-- The first additive migration briefly backfilled descriptive/legal tables from
-- technical creator/location data. Remove those inferred rows: creator access is
-- an authorization fact, not proof of legal ownership; location text is not a
-- reliable jurisdiction declaration; a display name is not necessarily a legal
-- entity name.
DELETE FROM business_relationships
WHERE metadata->>'source' = 'wave_2b2_creator_backfill';

DELETE FROM business_jurisdictions
WHERE metadata->>'source' = 'wave_2b2_primary_location_backfill';

DELETE FROM business_legal_profiles
WHERE metadata->>'source' = 'wave_2b2_business_name_backfill';

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
