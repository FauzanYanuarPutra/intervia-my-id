DROP TABLE IF EXISTS business_locations;
DROP INDEX IF EXISTS idx_umkm_stores_organization_id;
ALTER TABLE umkm_stores DROP COLUMN IF EXISTS organization_id;
