DROP TRIGGER IF EXISTS trg_business_audit_events_append_only ON business_audit_events;
DROP TRIGGER IF EXISTS trg_business_evidence_append_only ON business_evidence;

DROP TABLE IF EXISTS business_audit_events;
DROP TABLE IF EXISTS business_evidence;
DROP TABLE IF EXISTS business_jurisdictions;
DROP TABLE IF EXISTS business_access_grants;
DROP TABLE IF EXISTS business_role_permissions;
DROP TABLE IF EXISTS business_roles;
DROP TABLE IF EXISTS business_permissions;
DROP TABLE IF EXISTS business_relationships;
DROP TABLE IF EXISTS business_branches;

DROP FUNCTION IF EXISTS reject_business_governance_history_mutation();

DROP INDEX IF EXISTS uq_business_locations_tenant_identity;
DROP INDEX IF EXISTS uq_businesses_id_organization;
