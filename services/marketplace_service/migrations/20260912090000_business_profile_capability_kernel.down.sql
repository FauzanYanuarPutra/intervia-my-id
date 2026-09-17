DROP TRIGGER IF EXISTS trg_business_initialize_profile ON businesses;
DROP FUNCTION IF EXISTS initialize_business_profile();

DROP TABLE IF EXISTS business_capabilities;
DROP TABLE IF EXISTS business_profiles;
DROP TABLE IF EXISTS business_template_capabilities;
DROP TABLE IF EXISTS business_capability_definitions;
DROP TABLE IF EXISTS business_templates;
