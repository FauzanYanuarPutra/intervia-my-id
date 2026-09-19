BEGIN;

DROP TRIGGER IF EXISTS trg_business_stock_transfers_append_only
  ON business_stock_transfers;
DROP INDEX IF EXISTS ux_business_product_transfer_movement;
DROP INDEX IF EXISTS ux_business_inventory_transfer_movement;

DELETE FROM business_product_inventory_movements
WHERE source_type='stock_transfer';
DELETE FROM business_inventory_movements
WHERE source_type='stock_transfer';

DROP TABLE IF EXISTS business_stock_transfers;

ALTER TABLE business_product_inventory_movements
  DROP CONSTRAINT IF EXISTS ck_business_product_inventory_movements_type;
ALTER TABLE business_product_inventory_movements
  ADD CONSTRAINT business_product_inventory_movements_movement_type_check CHECK (
    movement_type IN ('sale_consumption','adjustment','return_in','return_out')
  );

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
      'stocktake_adjustment'
    )
  );

COMMIT;
