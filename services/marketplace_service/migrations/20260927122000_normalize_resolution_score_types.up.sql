-- Corrective migration for deployments that may have applied the initial
-- entity-resolution/promotion migrations before their score columns were
-- normalized to DOUBLE PRECISION. PostgreSQL's USING clause keeps existing
-- numeric values intact.
ALTER TABLE IF EXISTS data_import_entity_matches
  ALTER COLUMN name_similarity TYPE DOUBLE PRECISION
  USING name_similarity::double precision;

ALTER TABLE IF EXISTS data_import_entity_matches
  ALTER COLUMN address_similarity TYPE DOUBLE PRECISION
  USING address_similarity::double precision;

ALTER TABLE IF EXISTS data_import_entity_matches
  ALTER COLUMN geo_similarity TYPE DOUBLE PRECISION
  USING geo_similarity::double precision;

ALTER TABLE IF EXISTS data_import_entity_matches
  ALTER COLUMN combined_score TYPE DOUBLE PRECISION
  USING combined_score::double precision;

ALTER TABLE IF EXISTS reference_promotion_candidates
  ALTER COLUMN readiness_score TYPE DOUBLE PRECISION
  USING readiness_score::double precision;
