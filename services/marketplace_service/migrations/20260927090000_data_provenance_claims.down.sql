DROP INDEX IF EXISTS idx_content_items_reference_provenance;
DROP INDEX IF EXISTS uq_active_business_owner;
DROP INDEX IF EXISTS idx_business_ownership_content_active;
DROP INDEX IF EXISTS idx_business_claim_evidence_claim;
DROP INDEX IF EXISTS uq_business_claim_pending;
DROP INDEX IF EXISTS idx_business_claims_claimant_status;
DROP INDEX IF EXISTS idx_business_claims_content_status;
DROP INDEX IF EXISTS idx_data_import_records_kind_status;
DROP INDEX IF EXISTS idx_data_import_records_target;
DROP INDEX IF EXISTS idx_data_import_jobs_source_created;
DROP INDEX IF EXISTS idx_data_source_registry_enabled;

DROP TABLE IF EXISTS business_ownership_grants;
DROP TABLE IF EXISTS business_claim_evidence;
DROP TABLE IF EXISTS business_claims;
DROP TABLE IF EXISTS data_import_records;
DROP TABLE IF EXISTS data_import_jobs;
DROP TABLE IF EXISTS data_source_registry;
