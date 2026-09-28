-- Keep public reference coordinates and provenance self-healing.
-- Imported reference content may already exist before newer projection rules land.

UPDATE content_items AS c
SET metadata = COALESCE(c.metadata, '{}'::jsonb)
  || jsonb_strip_nulls(jsonb_build_object(
       'source_title', COALESCE(NULLIF(btrim(c.metadata->>'source_title'), ''), s.provider_name),
       'source_url', COALESCE(NULLIF(btrim(c.metadata->>'source_url'), ''), r.source_url, s.source_url),
       'source_license', COALESCE(NULLIF(btrim(c.metadata->>'source_license'), ''), r.license_snapshot, s.license_name),
       'source_license_url', COALESCE(NULLIF(btrim(c.metadata->>'source_license_url'), ''), s.license_url),
       'source_attribution', COALESCE(NULLIF(btrim(c.metadata->>'source_attribution'), ''), r.attribution_snapshot, s.attribution_text),
       'source_record_id', COALESCE(NULLIF(btrim(c.metadata->>'source_record_id'), ''), r.source_record_id),
       'canonical_record_id', r.id,
       'latitude', COALESCE(
         public.lajukan_safe_map_coordinate(c.metadata->>'latitude'),
         public.lajukan_safe_map_coordinate(c.metadata->>'lat'),
         e.latitude
       ),
       'longitude', COALESCE(
         public.lajukan_safe_map_coordinate(c.metadata->>'longitude'),
         public.lajukan_safe_map_coordinate(c.metadata->>'lng'),
         public.lajukan_safe_map_coordinate(c.metadata->>'lon'),
         e.longitude
       ),
       'city', COALESCE(NULLIF(btrim(c.metadata->>'city'), ''), e.city),
       'province', COALESCE(NULLIF(btrim(c.metadata->>'province'), ''), e.province),
       'address', COALESCE(NULLIF(btrim(c.metadata->>'address'), ''), e.normalized_address)
     )),
    updated_at = NOW()
FROM reference_promotion_candidates pc
JOIN data_import_entities e ON e.id = pc.entity_id
JOIN data_import_records r ON r.id = COALESCE(e.canonical_record_id, r.id)
JOIN data_source_registry s ON s.id = pc.source_id
WHERE pc.proposed_content_id = c.id
  AND c.content_status <> 'deleted';

-- Also repair older reference rows that have provenance but were created before
-- source_title/coordinate projection became mandatory.
UPDATE content_items AS c
SET metadata = COALESCE(c.metadata, '{}'::jsonb)
  || jsonb_strip_nulls(jsonb_build_object(
       'source_title', COALESCE(
         NULLIF(btrim(c.metadata->>'source_title'), ''),
         NULLIF(btrim(c.metadata->>'source_provider'), ''),
         NULLIF(btrim(c.metadata->>'source_dataset'), '')
       ),
       'latitude', COALESCE(
         public.lajukan_safe_map_coordinate(c.metadata->>'latitude'),
         public.lajukan_safe_map_coordinate(c.metadata->>'lat')
       ),
       'longitude', COALESCE(
         public.lajukan_safe_map_coordinate(c.metadata->>'longitude'),
         public.lajukan_safe_map_coordinate(c.metadata->>'lng'),
         public.lajukan_safe_map_coordinate(c.metadata->>'lon')
       )
     )),
    updated_at = NOW()
WHERE c.content_status <> 'deleted'
  AND c.metadata->>'reference_publication_status' = 'published'
  AND c.metadata->>'record_kind' IN (
    'government_reference',
    'open_data_reference',
    'licensed_reference',
    'external_content_reference',
    'real_openstreetmap_reference',
    'osm_provider_reference',
    'wikidata_reference'
  );

-- Keep umkm_stores' coordinate columns and public metadata aligned. The
-- columns remain canonical for operational queries; metadata is the stable
-- public projection consumed by map/reference clients.
CREATE OR REPLACE FUNCTION sync_umkm_store_coordinate_metadata()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.metadata = COALESCE(NEW.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'latitude', NEW.lat,
      'longitude', NEW.lng
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_umkm_store_coordinate_metadata ON umkm_stores;

CREATE TRIGGER trg_sync_umkm_store_coordinate_metadata
BEFORE INSERT OR UPDATE OF lat, lng, metadata
ON umkm_stores
FOR EACH ROW
EXECUTE FUNCTION sync_umkm_store_coordinate_metadata();

UPDATE umkm_stores
SET metadata = COALESCE(metadata, '{}'::jsonb)
  || jsonb_build_object(
    'latitude', lat,
    'longitude', lng
  )
WHERE lat BETWEEN -90 AND 90
  AND lng BETWEEN -180 AND 180;
