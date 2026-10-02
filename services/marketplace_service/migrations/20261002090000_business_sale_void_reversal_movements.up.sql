-- Allow canonical sale void/reset reversals to be recorded in both inventory ledgers.
--
-- SaleRepository::void() appends immutable reversal evidence instead of mutating
-- prior sale-consumption movements. Both movement ledgers therefore need to
-- explicitly accept the sale_void_reversal movement type.

ALTER TABLE business_inventory_movements
  DROP CONSTRAINT IF EXISTS ck_business_inventory_movements_type;

ALTER TABLE business_inventory_movements
  ADD CONSTRAINT ck_business_inventory_movements_type CHECK (
    movement_type IN (
      'sale_consumption',
      'sale_void_reversal',
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
      'sale_void_reversal',
      'adjustment',
      'return_in',
      'return_out',
      'transfer_out',
      'transfer_in'
    )
  );
