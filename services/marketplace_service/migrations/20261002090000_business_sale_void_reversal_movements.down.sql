-- Revert support for canonical sale void/reset reversal evidence.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM business_inventory_movements
    WHERE movement_type = 'sale_void_reversal'
  ) THEN
    RAISE EXCEPTION 'cannot rollback sale_void_reversal movement support while reversal rows exist in business_inventory_movements';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM business_product_inventory_movements
    WHERE movement_type = 'sale_void_reversal'
  ) THEN
    RAISE EXCEPTION 'cannot rollback sale_void_reversal movement support while reversal rows exist in business_product_inventory_movements';
  END IF;
END $$;

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
