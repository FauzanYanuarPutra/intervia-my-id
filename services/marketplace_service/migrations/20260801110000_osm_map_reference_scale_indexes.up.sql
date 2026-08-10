-- Parse only bounded decimal-shaped coordinate text. The CASE prevents
-- malformed JSON metadata from ever reaching the float8 cast used by map
-- filters and expression indexes.
CREATE OR REPLACE FUNCTION public.lajukan_safe_map_coordinate(raw_value text)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN raw_value ~ '^[+-]?[0-9]{1,3}([.][0-9]{1,15})?$'
      THEN raw_value::double precision
    ELSE NULL
  END
$$;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Supports numeric bounding-box scans when the planner estimates them more
-- selective than the geometric point index.
CREATE INDEX IF NOT EXISTS idx_content_osm_map_lat_lng
  ON content_items (
    public.lajukan_safe_map_coordinate(metadata->>'latitude'),
    public.lajukan_safe_map_coordinate(metadata->>'longitude'),
    updated_at DESC,
    id
  )
  WHERE content_status = 'active'
    AND metadata->>'record_kind' = 'real_openstreetmap_reference'
    AND metadata->>'source_dataset' = 'openstreetmap'
    AND COALESCE(metadata->>'is_transactional', 'true') = 'false'
    AND lower(COALESCE(metadata->>'market_side', '')) = 'reference'
    AND public.lajukan_safe_map_coordinate(metadata->>'latitude') BETWEEN -90.0 AND 90.0
    AND public.lajukan_safe_map_coordinate(metadata->>'longitude') BETWEEN -180.0 AND 180.0;

-- PostgreSQL's built-in point GiST operator supports both bounding-box
-- containment and indexed KNN ordering (`<->`) without PostGIS.
CREATE INDEX IF NOT EXISTS idx_content_osm_map_point_gist
  ON content_items USING GIST (
    point(
      public.lajukan_safe_map_coordinate(metadata->>'longitude'),
      public.lajukan_safe_map_coordinate(metadata->>'latitude')
    )
  )
  WHERE content_status = 'active'
    AND metadata->>'record_kind' = 'real_openstreetmap_reference'
    AND metadata->>'source_dataset' = 'openstreetmap'
    AND COALESCE(metadata->>'is_transactional', 'true') = 'false'
    AND lower(COALESCE(metadata->>'market_side', '')) = 'reference'
    AND public.lajukan_safe_map_coordinate(metadata->>'latitude') BETWEEN -90.0 AND 90.0
    AND public.lajukan_safe_map_coordinate(metadata->>'longitude') BETWEEN -180.0 AND 180.0;

CREATE INDEX IF NOT EXISTS idx_content_osm_map_search_trgm
  ON content_items USING GIN (
    (
      lower(
        COALESCE(title, '') || ' ' ||
        COALESCE(summary, '') || ' ' ||
        COALESCE(slug, '') || ' ' ||
        COALESCE(metadata->>'search_text', '') || ' ' ||
        COALESCE(metadata->>'city', '') || ' ' ||
        COALESCE(metadata->>'location', '') || ' ' ||
        COALESCE(metadata->>'address', '') || ' ' ||
        COALESCE(metadata->>'brand', '') || ' ' ||
        COALESCE(metadata->>'operator', '') || ' ' ||
        COALESCE(metadata->>'source_description', '') || ' ' ||
        COALESCE(metadata->>'marketplace_category_slug', '') || ' ' ||
        COALESCE(metadata->>'marketplace_subcategory_slug', '') || ' ' ||
        COALESCE(metadata->>'osm_primary_key', '') || ' ' ||
        COALESCE(metadata->>'osm_primary_value', '')
      )
    ) gin_trgm_ops
  )
  WHERE content_status = 'active'
    AND metadata->>'record_kind' = 'real_openstreetmap_reference'
    AND metadata->>'source_dataset' = 'openstreetmap'
    AND COALESCE(metadata->>'is_transactional', 'true') = 'false'
    AND lower(COALESCE(metadata->>'market_side', '')) = 'reference'
    AND public.lajukan_safe_map_coordinate(metadata->>'latitude') BETWEEN -90.0 AND 90.0
    AND public.lajukan_safe_map_coordinate(metadata->>'longitude') BETWEEN -180.0 AND 180.0;

CREATE INDEX IF NOT EXISTS idx_content_osm_map_city_trgm
  ON content_items USING GIN (
    (lower(COALESCE(metadata->>'city', ''))) gin_trgm_ops
  )
  WHERE content_status = 'active'
    AND metadata->>'record_kind' = 'real_openstreetmap_reference'
    AND metadata->>'source_dataset' = 'openstreetmap'
    AND COALESCE(metadata->>'is_transactional', 'true') = 'false'
    AND lower(COALESCE(metadata->>'market_side', '')) = 'reference'
    AND public.lajukan_safe_map_coordinate(metadata->>'latitude') BETWEEN -90.0 AND 90.0
    AND public.lajukan_safe_map_coordinate(metadata->>'longitude') BETWEEN -180.0 AND 180.0;
