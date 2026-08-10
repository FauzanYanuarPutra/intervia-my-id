-- PostgreSQL's built-in point GiST operator supports indexed nearest-neighbour
-- scans without requiring PostGIS. Keep the index partial because public map
-- discovery reads active storefronts only.
CREATE INDEX IF NOT EXISTS idx_umkm_stores_active_point_gist
  ON umkm_stores USING GIST (point(lng, lat))
  WHERE is_active = TRUE;
