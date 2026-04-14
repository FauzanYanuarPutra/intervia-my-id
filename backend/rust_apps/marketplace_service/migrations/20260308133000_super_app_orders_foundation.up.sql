-- Foundation schema for Lajukan Super App services
-- Covers ride, car, food, send, mart, services, franchise order intents and tracking.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS super_app_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL,
  partner_id UUID NULL,
  merchant_id UUID NULL,
  provider_id UUID NULL,
  service_type TEXT NOT NULL CHECK (
    service_type IN ('ride', 'car', 'food', 'send', 'mart', 'services', 'franchise')
  ),
  status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (
    status IN (
      'pending_verification',
      'ready_for_dispatch',
      'dispatching',
      'in_progress',
      'delivered',
      'completed',
      'cancelled',
      'disputed'
    )
  ),
  payment_mode TEXT NOT NULL DEFAULT 'wallet' CHECK (
    payment_mode IN ('wallet', 'bank_transfer', 'cod')
  ),
  currency TEXT NOT NULL DEFAULT 'IDR' CHECK (char_length(currency) = 3),
  amount_estimate_cents BIGINT NOT NULL DEFAULT 0 CHECK (amount_estimate_cents >= 0),
  amount_final_cents BIGINT NOT NULL DEFAULT 0 CHECK (amount_final_cents >= 0),
  pickup_address TEXT NULL,
  pickup_lat DOUBLE PRECISION NULL,
  pickup_lng DOUBLE PRECISION NULL,
  dropoff_address TEXT NULL,
  dropoff_lat DOUBLE PRECISION NULL,
  dropoff_lng DOUBLE PRECISION NULL,
  risk_score INT NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_super_app_orders_requester
ON super_app_orders(requester_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_super_app_orders_service_status
ON super_app_orders(service_type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_super_app_orders_partner
ON super_app_orders(partner_id, created_at DESC)
WHERE partner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_super_app_orders_metadata_gin
ON super_app_orders USING GIN (metadata);

CREATE INDEX IF NOT EXISTS idx_super_app_orders_risk_flags_gin
ON super_app_orders USING GIN (risk_flags);

CREATE TABLE IF NOT EXISTS super_app_order_events (
  id BIGSERIAL PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES super_app_orders(id) ON DELETE CASCADE,
  actor_id UUID NULL,
  actor_role TEXT NOT NULL DEFAULT 'system',
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_super_app_order_events_order
ON super_app_order_events(order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS super_app_tracking_points (
  id BIGSERIAL PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES super_app_orders(id) ON DELETE CASCADE,
  partner_id UUID NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  speed_kmh DOUBLE PRECISION NULL,
  heading_deg DOUBLE PRECISION NULL,
  accuracy_m DOUBLE PRECISION NULL,
  source TEXT NOT NULL DEFAULT 'gps',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_super_app_tracking_points_order_time
ON super_app_tracking_points(order_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_super_app_tracking_points_partner_time
ON super_app_tracking_points(partner_id, captured_at DESC)
WHERE partner_id IS NOT NULL;

SELECT 1;

