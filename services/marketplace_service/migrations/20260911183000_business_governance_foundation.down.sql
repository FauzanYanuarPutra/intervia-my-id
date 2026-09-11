DROP TRIGGER IF EXISTS trg_business_audit_events_append_only ON business_audit_events;
DROP FUNCTION IF EXISTS reject_business_audit_event_mutation();

DROP TABLE IF EXISTS business_audit_events;
DROP TABLE IF EXISTS business_legal_profiles;
DROP TABLE IF EXISTS business_jurisdictions;
DROP TABLE IF EXISTS business_relationships;
DROP TABLE IF EXISTS business_member_roles;
DROP TABLE IF EXISTS business_role_permissions;
DROP TABLE IF EXISTS business_roles;
DROP TABLE IF EXISTS business_memberships;
DROP TABLE IF EXISTS business_permissions;

DROP INDEX IF EXISTS idx_business_locations_business_branch_kind;
DROP INDEX IF EXISTS uq_business_locations_business_branch_code;

ALTER TABLE business_locations
  DROP CONSTRAINT IF EXISTS chk_business_locations_operating_dates,
  DROP CONSTRAINT IF EXISTS chk_business_locations_branch_kind,
  DROP CONSTRAINT IF EXISTS chk_business_locations_branch_code_nonempty,
  DROP COLUMN IF EXISTS closed_on,
  DROP COLUMN IF EXISTS opened_on,
  DROP COLUMN IF EXISTS branch_kind,
  DROP COLUMN IF EXISTS branch_code;

ALTER TABLE businesses
  DROP CONSTRAINT IF EXISTS uq_businesses_id_organization;
