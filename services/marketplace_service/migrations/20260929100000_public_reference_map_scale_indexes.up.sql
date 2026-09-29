-- Accelerate geo-only map reads for every public reference family, not just OSM.
-- The expression uses the same safe coordinate function as the read queries so
-- malformed metadata stays excluded and cannot abort an index scan.
CREATE INDEX IF NOT EXISTS idx_content_public_reference_map_point_gist
  ON content_items USING GIST (
    point(
      public.lajukan_safe_map_coordinate(metadata->>'longitude'),
      public.lajukan_safe_map_coordinate(metadata->>'latitude')
    )
  )
  WHERE content_status = 'active'
    AND metadata->>'reference_publication_status' = 'published'
    AND COALESCE(metadata->>'is_transactional', 'true') = 'false'
    AND lower(COALESCE(metadata->>'market_side', '')) = 'reference'
    AND metadata->>'record_kind' IN (
      'government_reference',
      'open_data_reference',
      'licensed_reference',
      'external_content_reference',
      'real_openstreetmap_reference',
      'osm_provider_reference',
      'wikidata_reference'
    )
    AND public.lajukan_safe_map_coordinate(metadata->>'latitude') BETWEEN -90.0 AND 90.0
    AND public.lajukan_safe_map_coordinate(metadata->>'longitude') BETWEEN -180.0 AND 180.0;

CREATE INDEX IF NOT EXISTS idx_content_public_reference_map_lat_lng
  ON content_items (
    public.lajukan_safe_map_coordinate(metadata->>'latitude'),
    public.lajukan_safe_map_coordinate(metadata->>'longitude'),
    updated_at DESC,
    id
  )
  WHERE content_status = 'active'
    AND metadata->>'reference_publication_status' = 'published'
    AND COALESCE(metadata->>'is_transactional', 'true') = 'false'
    AND lower(COALESCE(metadata->>'market_side', '')) = 'reference'
    AND metadata->>'record_kind' IN (
      'government_reference',
      'open_data_reference',
      'licensed_reference',
      'external_content_reference',
      'real_openstreetmap_reference',
      'osm_provider_reference',
      'wikidata_reference'
    )
    AND public.lajukan_safe_map_coordinate(metadata->>'latitude') BETWEEN -90.0 AND 90.0
    AND public.lajukan_safe_map_coordinate(metadata->>'longitude') BETWEEN -180.0 AND 180.0;
