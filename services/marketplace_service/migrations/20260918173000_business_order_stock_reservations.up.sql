CREATE TABLE IF NOT EXISTS business_order_stock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL,
  quantity NUMERIC(20,6) NOT NULL CHECK (quantity > 0),
  state TEXT NOT NULL DEFAULT 'reserved'
    CHECK (state IN ('reserved', 'released', 'consumed')),
  expires_at TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ NULL,
  consumed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT business_order_stock_reservations_order_product_key
    UNIQUE (order_id, product_id),
  CONSTRAINT business_order_stock_reservations_product_scope_fkey
    FOREIGN KEY (product_id, business_id, organization_id)
    REFERENCES business_products (id, business_id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT business_order_stock_reservations_state_timestamps_check
    CHECK (
      (state = 'reserved' AND released_at IS NULL AND consumed_at IS NULL)
      OR (state = 'released' AND released_at IS NOT NULL AND consumed_at IS NULL)
      OR (state = 'consumed' AND released_at IS NULL AND consumed_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_business_order_stock_reservations_active
  ON business_order_stock_reservations (
    business_id,
    organization_id,
    product_id,
    expires_at
  )
  WHERE state = 'reserved';

CREATE INDEX IF NOT EXISTS idx_business_order_stock_reservations_order
  ON business_order_stock_reservations (order_id, state);
