BEGIN;

ALTER TABLE business_inventory_movements
  DROP CONSTRAINT IF EXISTS ck_business_inventory_movements_type;
ALTER TABLE business_inventory_movements
  ADD CONSTRAINT ck_business_inventory_movements_type CHECK (
    movement_type IN (
      'sale_consumption',
      'purchase_receipt',
      'waste',
      'adjustment',
      'return_in',
      'return_out',
      'stocktake_adjustment',
      'transfer_out',
      'transfer_in'
    )
  );

ALTER TABLE business_product_inventory_movements
  DROP CONSTRAINT IF EXISTS business_product_inventory_movements_movement_type_check;
ALTER TABLE business_product_inventory_movements
  DROP CONSTRAINT IF EXISTS ck_business_product_inventory_movements_type;
ALTER TABLE business_product_inventory_movements
  ADD CONSTRAINT ck_business_product_inventory_movements_type CHECK (
    movement_type IN (
      'sale_consumption',
      'adjustment',
      'return_in',
      'return_out',
      'transfer_out',
      'transfer_in'
    )
  );

CREATE TABLE business_stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  from_location_id UUID NOT NULL,
  to_location_id UUID NOT NULL,
  item_kind TEXT NOT NULL CHECK (item_kind IN ('ingredient','product')),
  ingredient_id UUID NULL,
  product_id UUID NULL,
  quantity NUMERIC(20,6) NOT NULL CHECK (quantity > 0),
  source_quantity_before NUMERIC(20,6) NOT NULL CHECK (source_quantity_before >= 0),
  source_quantity_after NUMERIC(20,6) NOT NULL CHECK (source_quantity_after >= 0),
  destination_quantity_before NUMERIC(20,6) NOT NULL CHECK (destination_quantity_before >= 0),
  destination_quantity_after NUMERIC(20,6) NOT NULL CHECK (destination_quantity_after >= 0),
  reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 2000),
  idempotency_key UUID NOT NULL,
  request_hash CHAR(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_stock_transfers_scope
    FOREIGN KEY (business_id, organization_id)
    REFERENCES businesses(id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_business_stock_transfers_from_location
    FOREIGN KEY (from_location_id, business_id, organization_id)
    REFERENCES business_locations(id, business_id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_business_stock_transfers_to_location
    FOREIGN KEY (to_location_id, business_id, organization_id)
    REFERENCES business_locations(id, business_id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_business_stock_transfers_ingredient
    FOREIGN KEY (ingredient_id, business_id, organization_id)
    REFERENCES business_ingredients(id, business_id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_business_stock_transfers_product
    FOREIGN KEY (product_id, business_id, organization_id)
    REFERENCES business_products(id, business_id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT ck_business_stock_transfers_locations
    CHECK (from_location_id <> to_location_id),
  CONSTRAINT ck_business_stock_transfers_item
    CHECK (
      (item_kind='ingredient' AND ingredient_id IS NOT NULL AND product_id IS NULL)
      OR
      (item_kind='product' AND product_id IS NOT NULL AND ingredient_id IS NULL)
    ),
  CONSTRAINT ck_business_stock_transfers_source_math
    CHECK (source_quantity_after = source_quantity_before - quantity),
  CONSTRAINT ck_business_stock_transfers_destination_math
    CHECK (destination_quantity_after = destination_quantity_before + quantity),
  UNIQUE (id, business_id, organization_id),
  UNIQUE (business_id, idempotency_key)
);

CREATE INDEX idx_business_stock_transfers_timeline
  ON business_stock_transfers (
    business_id, organization_id, created_at DESC, id DESC
  );
CREATE INDEX idx_business_stock_transfers_locations
  ON business_stock_transfers (
    business_id, organization_id, from_location_id, to_location_id, created_at DESC
  );

CREATE UNIQUE INDEX ux_business_inventory_transfer_movement
  ON business_inventory_movements (
    business_id, organization_id, location_id, ingredient_id,
    source_type, source_id, movement_type
  )
  WHERE source_type='stock_transfer' AND source_id IS NOT NULL;

CREATE UNIQUE INDEX ux_business_product_transfer_movement
  ON business_product_inventory_movements (
    business_id, organization_id, location_id, product_id,
    source_type, source_id, movement_type
  )
  WHERE source_type='stock_transfer' AND source_id IS NOT NULL;

CREATE TRIGGER trg_business_stock_transfers_append_only
BEFORE UPDATE OR DELETE ON business_stock_transfers
FOR EACH ROW EXECUTE FUNCTION reject_branch_inventory_evidence_mutation();

COMMIT;
