DROP TRIGGER IF EXISTS trg_business_initialize_governance_access ON businesses;
DROP FUNCTION IF EXISTS initialize_business_governance_access();

ALTER TABLE business_audit_events
  DROP CONSTRAINT IF EXISTS fk_business_audit_events_location_scope,
  DROP CONSTRAINT IF EXISTS fk_business_audit_events_business_scope,
  ADD CONSTRAINT business_audit_events_location_id_fkey
    FOREIGN KEY (location_id) REFERENCES business_locations(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_business_audit_events_business_scope
    FOREIGN KEY (business_id, organization_id)
    REFERENCES businesses(id, organization_id) ON DELETE CASCADE;

ALTER TABLE business_jurisdictions
  DROP CONSTRAINT IF EXISTS fk_business_jurisdictions_location_scope,
  ADD CONSTRAINT business_jurisdictions_location_id_fkey
    FOREIGN KEY (location_id) REFERENCES business_locations(id) ON DELETE CASCADE;

ALTER TABLE business_member_roles
  DROP CONSTRAINT IF EXISTS fk_business_member_roles_location_scope,
  ADD CONSTRAINT business_member_roles_location_id_fkey
    FOREIGN KEY (location_id) REFERENCES business_locations(id) ON DELETE CASCADE;

ALTER TABLE business_locations
  DROP CONSTRAINT IF EXISTS uq_business_locations_id_business_organization,
  ALTER COLUMN branch_code DROP DEFAULT,
  ALTER COLUMN branch_kind DROP DEFAULT;
