DROP TRIGGER IF EXISTS trg_business_initialize_governance_access ON businesses;
DROP FUNCTION IF EXISTS initialize_business_governance_access();

ALTER TABLE business_locations
  ALTER COLUMN branch_code DROP DEFAULT,
  ALTER COLUMN branch_kind DROP DEFAULT;
