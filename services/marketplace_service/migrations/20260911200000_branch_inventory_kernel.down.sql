-- Business OS V3 Wave 2C.1 rollback.
--
-- This rollback is deliberately fail-closed once non-primary branch inventory has
-- been recorded. Removing the branch dimension after such activity would erase
-- attribution and create a false global stock history.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM business_inventory_movements movement
    JOIN business_locations location
      ON location.id = movement.location_id
     AND location.business_id = movement.business_id
     AND location.organization_id = movement.organization_id
    WHERE NOT location.is_primary
  ) THEN
    RAISE EXCEPTION
      'cannot roll back branch inventory after non-primary branch movements exist';
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_inventory_commands_append_only
  ON business_inventory_commands;
DROP TRIGGER IF EXISTS trg_business_inventory_movements_append_only
  ON business_inventory_movements;
DROP TRIGGER IF EXISTS trg_business_inventory_movements_resolve_location
  ON business_inventory_movements;
DROP TRIGGER IF EXISTS trg_business_ingredient_balances_primary_projection
  ON business_ingredient_balances;
DROP TRIGGER IF EXISTS trg_business_ingredients_primary_balance_update
  ON business_ingredients;
DROP TRIGGER IF EXISTS trg_business_ingredients_primary_balance_insert
  ON business_ingredients;

DROP INDEX IF EXISTS ux_business_inventory_movements_command;
DROP INDEX IF EXISTS idx_business_inventory_movements_location_created;

ALTER TABLE business_inventory_movements
  DROP CONSTRAINT IF EXISTS fk_business_inventory_movements_command_scope,
  DROP CONSTRAINT IF EXISTS fk_business_inventory_movements_location_scope;

UPDATE business_inventory_movements
SET movement_type = 'adjustment'
WHERE movement_type = 'stocktake_adjustment';

ALTER TABLE business_inventory_movements
  DROP CONSTRAINT IF EXISTS ck_business_inventory_movements_type,
  DROP COLUMN IF EXISTS command_id,
  DROP COLUMN IF EXISTS location_id,
  ADD CONSTRAINT business_inventory_movements_movement_type_check CHECK (
    movement_type IN (
      'sale_consumption',
      'purchase_receipt',
      'waste',
      'adjustment',
      'return_in',
      'return_out'
    )
  );

DROP TABLE IF EXISTS business_inventory_commands;
DROP TABLE IF EXISTS business_ingredient_balances;

DROP FUNCTION IF EXISTS reject_branch_inventory_evidence_mutation();
DROP FUNCTION IF EXISTS resolve_inventory_movement_location();
DROP FUNCTION IF EXISTS sync_legacy_ingredient_from_primary_balance();
DROP FUNCTION IF EXISTS sync_primary_balance_from_legacy_ingredient();

DROP INDEX IF EXISTS uq_business_locations_primary_business;
