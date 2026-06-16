-- Super app geospatial persistence (PostgreSQL native POINT + GiST) for real-time tracking.
-- Tables:
-- 1) driver_locations_latest  : latest known driver location (one row per driver)
-- 2) trip_location_points     : sampled trip points history
-- 3) dispatch_orders          : dispatch status snapshots

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS driver_locations_latest (
  driver_id TEXT PRIMARY KEY,
  service_type TEXT NOT NULL CHECK (
    service_type IN ('ride', 'car', 'food', 'send', 'mart', 'services', 'franchise')
  ),
  status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'offline')),
  location POINT NOT NULL CHECK (
    location[0] BETWEEN -180 AND 180 AND location[1] BETWEEN -90 AND 90
  ),
  heading_deg DOUBLE PRECISION NULL CHECK (heading_deg >= 0 AND heading_deg <= 360),
  speed_kmh DOUBLE PRECISION NULL CHECK (speed_kmh >= 0 AND speed_kmh <= 300),
  vehicle_type TEXT NULL,
  source TEXT NOT NULL DEFAULT 'gps',
  location_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_locations_latest_gist
ON driver_locations_latest USING GIST (location);

CREATE INDEX IF NOT EXISTS idx_driver_locations_latest_service_status_time
ON driver_locations_latest (service_type, status, location_updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_driver_locations_latest_updated_at
ON driver_locations_latest (updated_at DESC);

CREATE TABLE IF NOT EXISTS dispatch_orders (
  order_id TEXT PRIMARY KEY,
  service_type TEXT NOT NULL CHECK (
    service_type IN ('ride', 'car', 'food', 'send', 'mart', 'services', 'franchise')
  ),
  requester_id TEXT NOT NULL,
  matched_driver_id TEXT NULL,
  status TEXT NOT NULL DEFAULT 'searching' CHECK (
    status IN ('searching', 'matched', 'expired', 'cancelled')
  ),
  pickup POINT NOT NULL CHECK (
    pickup[0] BETWEEN -180 AND 180 AND pickup[1] BETWEEN -90 AND 90
  ),
  dropoff POINT NULL,
  last_radius_m INT NOT NULL DEFAULT 0,
  notified_driver_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  matched_at TIMESTAMPTZ NULL,
  expired_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    dropoff IS NULL OR (
      dropoff[0] BETWEEN -180 AND 180 AND dropoff[1] BETWEEN -90 AND 90
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_dispatch_orders_pickup_gist
ON dispatch_orders USING GIST (pickup);

CREATE INDEX IF NOT EXISTS idx_dispatch_orders_status_updated
ON dispatch_orders (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_dispatch_orders_matched_driver
ON dispatch_orders (matched_driver_id, updated_at DESC)
WHERE matched_driver_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dispatch_orders_notified_gin
ON dispatch_orders USING GIN (notified_driver_ids);

CREATE TABLE IF NOT EXISTS trip_location_points (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT NOT NULL,
  driver_id TEXT NOT NULL,
  point POINT NOT NULL CHECK (
    point[0] BETWEEN -180 AND 180 AND point[1] BETWEEN -90 AND 90
  ),
  speed_kmh DOUBLE PRECISION NULL CHECK (speed_kmh >= 0 AND speed_kmh <= 300),
  heading_deg DOUBLE PRECISION NULL CHECK (heading_deg >= 0 AND heading_deg <= 360),
  source TEXT NOT NULL DEFAULT 'gps',
  is_anomaly BOOLEAN NOT NULL DEFAULT FALSE,
  anomaly_reason TEXT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  sampled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_location_points_order_sampled
ON trip_location_points (order_id, sampled_at DESC);

CREATE INDEX IF NOT EXISTS idx_trip_location_points_driver_sampled
ON trip_location_points (driver_id, sampled_at DESC);

CREATE INDEX IF NOT EXISTS idx_trip_location_points_point_gist
ON trip_location_points USING GIST (point);

CREATE INDEX IF NOT EXISTS idx_trip_location_points_anomaly
ON trip_location_points (is_anomaly, sampled_at DESC)
WHERE is_anomaly = TRUE;

SELECT 1;
