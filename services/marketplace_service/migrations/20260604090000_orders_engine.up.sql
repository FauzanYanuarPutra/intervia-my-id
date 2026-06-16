CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE order_category_type AS ENUM (
    'PHYSICAL_GOODS',
    'SUPPLY_CHAIN',
    'SERVICE_MARKETPLACE',
    'CULINARY_INSTANT'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE order_base_status AS ENUM (
    'DRAFT',
    'PENDING_PAYMENT',
    'PAID',
    'PROCESSING',
    'SHIPPED',
    'IN_SERVICE',
    'DELIVERED',
    'COMPLETED',
    'CANCELLED',
    'REJECTED',
    'EXPIRED',
    'REFUNDED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE order_payment_status AS ENUM (
    'UNPAID',
    'PENDING',
    'PAID',
    'FAILED',
    'EXPIRED',
    'REFUND_PENDING',
    'REFUNDED',
    'PARTIALLY_REFUNDED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  merchant_id UUID NOT NULL,
  category_type order_category_type NOT NULL,
  base_status order_base_status NOT NULL DEFAULT 'DRAFT',
  payment_status order_payment_status NOT NULL DEFAULT 'UNPAID',
  currency CHAR(3) NOT NULL DEFAULT 'IDR',
  subtotal_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  shipping_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  payment_provider TEXT NULL,
  payment_reference TEXT NULL,
  payment_due_at TIMESTAMPTZ NULL,
  accepted_at TIMESTAMPTZ NULL,
  paid_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  expired_at TIMESTAMPTZ NULL,
  refunded_at TIMESTAMPTZ NULL,
  category_specific_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version BIGINT NOT NULL DEFAULT 1,
  CONSTRAINT orders_total_non_negative CHECK (
    subtotal_amount >= 0
    AND shipping_amount >= 0
    AND discount_amount >= 0
    AND tax_amount >= 0
    AND total_amount >= 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key
  ON orders (user_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_orders_user_created_at
  ON orders (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_merchant_created_at
  ON orders (merchant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_category_status
  ON orders (category_type, base_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_payment_status
  ON orders (payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_payment_due_at
  ON orders (payment_due_at)
  WHERE payment_due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_metadata_gin
  ON orders USING GIN (category_specific_metadata);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NULL,
  service_id UUID NULL,
  sku_id UUID NULL,
  item_name TEXT NOT NULL,
  quantity NUMERIC(18,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(18,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(18,2) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON order_items(order_id);

CREATE TABLE IF NOT EXISTS order_state_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  transition_type TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id UUID NULL,
  reason TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_state_transitions_order_id_created_at
  ON order_state_transitions(order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  event_key TEXT NOT NULL UNIQUE,
  published_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbox_unpublished
  ON outbox_events(published_at, created_at)
  WHERE published_at IS NULL;

