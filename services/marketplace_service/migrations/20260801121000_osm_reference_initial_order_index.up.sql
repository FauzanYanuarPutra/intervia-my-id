-- Home and empty-query Explore references read a small newest-first batch
-- without a viewer or viewport. Keep that path index-only at large scale
-- instead of sorting the full public-reference catalog.
CREATE INDEX IF NOT EXISTS idx_content_osm_map_initial_order
  ON content_items (updated_at DESC, id ASC)
  WHERE content_status = 'active'
    AND metadata->>'record_kind' = 'real_openstreetmap_reference'
    AND metadata->>'source_dataset' = 'openstreetmap'
    AND COALESCE(metadata->>'is_transactional', 'true') = 'false'
    AND lower(COALESCE(metadata->>'market_side', '')) = 'reference'
    AND public.lajukan_safe_map_coordinate(metadata->>'latitude') BETWEEN -90.0 AND 90.0
    AND public.lajukan_safe_map_coordinate(metadata->>'longitude') BETWEEN -180.0 AND 180.0;
