-- Keep the public UMKM projection derived from the canonical primary Business OS location.
-- This also handles a primary-location switch: changing is_primary/public_visibility on
-- the previous location must immediately stop it from being the public source.

CREATE OR REPLACE FUNCTION sync_public_umkm_store_from_business_location()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  source_location business_locations%ROWTYPE;
BEGIN
  SELECT *
  INTO source_location
  FROM business_locations
  WHERE store_id = NEW.store_id
    AND is_primary = TRUE
    AND public_visibility = TRUE
  ORDER BY updated_at DESC, id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  UPDATE umkm_stores s
  SET
    address = COALESCE(NULLIF(source_location.address, ''), s.address),
    city = COALESCE(NULLIF(source_location.city, ''), s.city),
    lat = COALESCE(source_location.lat, s.lat),
    lng = COALESCE(source_location.lng, s.lng),
    phone = COALESCE(NULLIF(source_location.phone, ''), s.phone),
    metadata = COALESCE(s.metadata, '{}'::jsonb)
      || jsonb_strip_nulls(jsonb_build_object(
        'business_hours', COALESCE(source_location.business_hours, '{}'::jsonb),
        'special_hours', COALESCE(source_location.special_hours, '[]'::jsonb),
        'operational_location_status', source_location.status,
        'branch_kind', COALESCE(source_location.metadata->>'branch_kind', ''),
        'location_type', source_location.location_type,
        'location_name', source_location.name,
        'province', source_location.province,
        'district', source_location.district,
        'postal_code', source_location.postal_code,
        'timezone', source_location.timezone,
        'whatsapp_phone', NULLIF(source_location.whatsapp, ''),
        'website_url', NULLIF(source_location.metadata->>'website_url', ''),
        'website', NULLIF(source_location.metadata->>'website', ''),
        'email', NULLIF(source_location.metadata->>'email', ''),
        'service_area', NULLIF(source_location.metadata->>'service_area', ''),
        'service_areas_text', NULLIF(source_location.metadata->>'service_areas_text', ''),
        'delivery_area', NULLIF(source_location.metadata->>'delivery_area', ''),
        'coverage_area', NULLIF(source_location.metadata->>'coverage_area', ''),
        'fulfillment_notes', NULLIF(source_location.metadata->>'fulfillment_notes', ''),
        'service_options', source_location.metadata->'service_options',
        'order_methods', source_location.metadata->'order_methods',
        'delivery_methods', source_location.metadata->'delivery_methods',
        'catalog_focus', NULLIF(source_location.metadata->>'catalog_focus', ''),
        'main_offering', NULLIF(source_location.metadata->>'main_offering', ''),
        'business_role', NULLIF(source_location.metadata->>'business_role', ''),
        'business_model', NULLIF(source_location.metadata->>'business_model', ''),
        'customer_type', NULLIF(source_location.metadata->>'customer_type', ''),
        'target_customer', NULLIF(source_location.metadata->>'target_customer', ''),
        'price_range', NULLIF(source_location.metadata->>'price_range', ''),
        'price_level', NULLIF(source_location.metadata->>'price_level', ''),
        'social_facebook_url', NULLIF(source_location.metadata->>'social_facebook_url', ''),
        'social_instagram_url', NULLIF(source_location.metadata->>'social_instagram_url', ''),
        'social_tiktok_url', NULLIF(source_location.metadata->>'social_tiktok_url', ''),
        'social_youtube_url', NULLIF(source_location.metadata->>'social_youtube_url', '')
      ))
      || jsonb_build_object(
        'business_location_id', source_location.id,
        'business_location_updated_at', source_location.updated_at
      ),
    updated_at = NOW()
  WHERE s.id = source_location.store_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_public_umkm_store_from_business_location
  ON business_locations;

CREATE TRIGGER trg_sync_public_umkm_store_from_business_location
AFTER INSERT OR UPDATE OF
  address, city, lat, lng, phone, whatsapp, business_hours, special_hours,
  status, province, district, postal_code, metadata,
  is_primary, public_visibility, location_type, name, timezone
ON business_locations
FOR EACH ROW
EXECUTE FUNCTION sync_public_umkm_store_from_business_location();

-- Rebuild the public projection from the canonical primary location now.
WITH latest_public_locations AS (
  SELECT DISTINCT ON (bl.store_id)
    bl.*
  FROM business_locations bl
  WHERE bl.is_primary = TRUE
    AND bl.public_visibility = TRUE
  ORDER BY bl.store_id, bl.updated_at DESC, bl.id DESC
)
UPDATE umkm_stores s
SET
  address = COALESCE(NULLIF(l.address, ''), s.address),
  city = COALESCE(NULLIF(l.city, ''), s.city),
  lat = COALESCE(l.lat, s.lat),
  lng = COALESCE(l.lng, s.lng),
  phone = COALESCE(NULLIF(l.phone, ''), s.phone),
  metadata = COALESCE(s.metadata, '{}'::jsonb)
    || jsonb_strip_nulls(jsonb_build_object(
      'business_hours', COALESCE(l.business_hours, '{}'::jsonb),
      'special_hours', COALESCE(l.special_hours, '[]'::jsonb),
      'operational_location_status', l.status,
      'location_type', l.location_type,
      'location_name', l.name,
      'province', l.province,
      'district', l.district,
      'postal_code', l.postal_code,
      'timezone', l.timezone,
      'whatsapp_phone', NULLIF(l.whatsapp, ''),
      'website_url', NULLIF(l.metadata->>'website_url', ''),
      'website', NULLIF(l.metadata->>'website', ''),
      'email', NULLIF(l.metadata->>'email', ''),
      'service_area', NULLIF(l.metadata->>'service_area', ''),
      'service_areas_text', NULLIF(l.metadata->>'service_areas_text', ''),
      'delivery_area', NULLIF(l.metadata->>'delivery_area', ''),
      'coverage_area', NULLIF(l.metadata->>'coverage_area', ''),
      'fulfillment_notes', NULLIF(l.metadata->>'fulfillment_notes', ''),
      'service_options', l.metadata->'service_options',
      'order_methods', l.metadata->'order_methods',
      'delivery_methods', l.metadata->'delivery_methods',
      'catalog_focus', NULLIF(l.metadata->>'catalog_focus', ''),
      'main_offering', NULLIF(l.metadata->>'main_offering', ''),
      'business_role', NULLIF(l.metadata->>'business_role', ''),
      'business_model', NULLIF(l.metadata->>'business_model', ''),
      'customer_type', NULLIF(l.metadata->>'customer_type', ''),
      'target_customer', NULLIF(l.metadata->>'target_customer', ''),
      'price_range', NULLIF(l.metadata->>'price_range', ''),
      'price_level', NULLIF(l.metadata->>'price_level', ''),
      'social_facebook_url', NULLIF(l.metadata->>'social_facebook_url', ''),
      'social_instagram_url', NULLIF(l.metadata->>'social_instagram_url', ''),
      'social_tiktok_url', NULLIF(l.metadata->>'social_tiktok_url', ''),
      'social_youtube_url', NULLIF(l.metadata->>'social_youtube_url', '')
    ))
    || jsonb_build_object(
      'business_location_id', l.id,
      'business_location_updated_at', l.updated_at
    ),
  updated_at = NOW()
FROM latest_public_locations l
WHERE s.id = l.store_id;
