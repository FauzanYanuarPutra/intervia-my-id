-- Keep the public UMKM projection synchronized with the canonical
-- Business OS location record for customer-facing operational facts.
-- Private business/finance data is intentionally not copied.

CREATE OR REPLACE FUNCTION sync_public_umkm_store_from_business_location()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE umkm_stores
  SET
    address = COALESCE(NULLIF(NEW.address, ''), address),
    city = COALESCE(NULLIF(NEW.city, ''), city),
    lat = COALESCE(NEW.lat, lat),
    lng = COALESCE(NEW.lng, lng),
    phone = COALESCE(NULLIF(NEW.phone, ''), phone),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'business_hours', COALESCE(NEW.business_hours, '{}'::jsonb),
      'special_hours', COALESCE(NEW.special_hours, '[]'::jsonb),
      'operational_location_status', NEW.status,
      'branch_kind', COALESCE(NEW.metadata->>'branch_kind', ''),
      'province', COALESCE(NEW.province, ''),
      'district', COALESCE(NEW.district, ''),
      'postal_code', COALESCE(NEW.postal_code, ''),
      'business_location_id', NEW.id,
      'business_location_updated_at', NEW.updated_at
    ),
    updated_at = NOW()
  WHERE id = NEW.store_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_public_umkm_store_from_business_location
  ON business_locations;

CREATE TRIGGER trg_sync_public_umkm_store_from_business_location
AFTER INSERT OR UPDATE OF address, city, lat, lng, phone, business_hours,
  special_hours, status, province, district, postal_code, metadata
ON business_locations
FOR EACH ROW
WHEN (NEW.is_primary = TRUE AND NEW.public_visibility = TRUE)
EXECUTE FUNCTION sync_public_umkm_store_from_business_location();

UPDATE umkm_stores s
SET
  address = COALESCE(NULLIF(l.address, ''), s.address),
  city = COALESCE(NULLIF(l.city, ''), s.city),
  lat = COALESCE(l.lat, s.lat),
  lng = COALESCE(l.lng, s.lng),
  phone = COALESCE(NULLIF(l.phone, ''), s.phone),
  metadata = COALESCE(s.metadata, '{}'::jsonb) || jsonb_build_object(
    'business_hours', COALESCE(l.business_hours, '{}'::jsonb),
    'special_hours', COALESCE(l.special_hours, '[]'::jsonb),
    'operational_location_status', l.status,
    'branch_kind', COALESCE(l.metadata->>'branch_kind', ''),
    'province', COALESCE(l.province, ''),
    'district', COALESCE(l.district, ''),
    'postal_code', COALESCE(l.postal_code, ''),
    'business_location_id', l.id,
    'business_location_updated_at', l.updated_at
  ),
  updated_at = NOW()
FROM business_locations l
WHERE l.store_id = s.id
  AND l.is_primary = TRUE
  AND l.public_visibility = TRUE;
