DROP TRIGGER IF EXISTS trg_sync_public_umkm_store_from_business_location
  ON business_locations;
DROP FUNCTION IF EXISTS sync_public_umkm_store_from_business_location();
