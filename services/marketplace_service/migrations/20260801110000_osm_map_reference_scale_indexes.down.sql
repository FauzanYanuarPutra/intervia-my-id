DROP INDEX IF EXISTS idx_content_osm_map_city_trgm;
DROP INDEX IF EXISTS idx_content_osm_map_search_trgm;
DROP INDEX IF EXISTS idx_content_osm_map_point_gist;
DROP INDEX IF EXISTS idx_content_osm_map_lat_lng;
DROP FUNCTION IF EXISTS public.lajukan_safe_map_coordinate(text);
