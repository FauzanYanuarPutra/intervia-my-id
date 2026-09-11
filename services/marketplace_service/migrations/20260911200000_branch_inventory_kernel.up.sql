-- Business OS V3 Wave 2C.1: branch-scoped ingredient inventory kernel.
--
-- Design rules:
-- * branch balances are the branch read model for ingredient stock;
-- * the existing business_ingredients.stock_quantity column remains a primary-branch
--   compatibility mirror while legacy callers are migrated;
-- * movements and commands are append-only evidence of stock changes;
-- * every new movement belongs to an exact business/location/ingredient scope;
-- * existing sale movements are attributed to the canonical primary branch.

DO $$
BEGIN
  IF EXISTS (
    SELECT business_id
    FROM business_locations
    WHERE business_id IS NOT NULL AND is_primary
    GROUP BY business_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'branch inventory requires at most one primary location per business';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_locations_primary_business
  ON business_locations (business_id)
  WHERE business_id IS NOT NULL AND is_primary;

CREATE TABLE business_ingredient_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  location_id UUID NOT NULL,
  ingredient_id UUID NOT NULL,
  quantity NUMERIC(20,6) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_ingredient_balances_location_scope
    FOREIGN KEY (location_id, business_id, organization_id)
    REFERENCES business_locations(id, business_id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_business_ingredient_balances_ingredient_scope
    FOREIGN KEY (ingredient_id, business_id, organization_id)
    REFERENCES business_ingredients(id, business_id, organization_id)
    ON DELETE RESTRICT,
  UNIQUE (location_id, ingredient_id),
  UNIQUE (id, business_id, organization_id, location_id, ingredient_id)
);

CREATE INDEX idx_business_ingredient_balances_scope
  ON business_ingredient_balances (business_id, organization_id, location_id, ingredient_id);
CREATE INDEX idx_business_ingredient_balances_quantity
  ON business_ingredient_balances (business_id, organization_id, location_id, quantity);

INSERT INTO business_ingredient_balances (
  organization_id, business_id, location_id, ingredient_id, quantity,
  created_at, updated_at
)
SELECT
  ingredient.organization_id,
  ingredient.business_id,
  location.id,
  ingredient.id,
  ingredient.stock_quantity,
  LEAST(ingredient.created_at, location.created_at),
  GREATEST(ingredient.updated_at, location.updated_at)
FROM business_ingredients ingredient
JOIN business_locations location
  ON location.business_id = ingredient.business_id
 AND location.organization_id = ingredient.organization_id
 AND location.is_primary
ON CONFLICT (location_id, ingredient_id) DO NOTHING;

CREATE TABLE business_inventory_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  location_id UUID NOT NULL,
  ingredient_id UUID NOT NULL,
  idempotency_key UUID NOT NULL,
  operation TEXT NOT NULL CHECK (
    operation IN ('purchase_receipt', 'waste', 'adjustment', 'return_in', 'return_out', 'stocktake')
  ),
  requested_quantity NUMERIC(20,6) NULL,
  requested_delta NUMERIC(20,6) NULL,
  counted_quantity NUMERIC(20,6) NULL,
  quantity_before NUMERIC(20,6) NOT NULL CHECK (quantity_before >= 0),
  quantity_after NUMERIC(20,6) NOT NULL CHECK (quantity_after >= 0),
  reason TEXT NOT NULL DEFAULT '',
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(evidence_refs) = 'array'),
  request_hash CHAR(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_inventory_commands_location_scope
    FOREIGN KEY (location_id, business_id, organization_id)
    REFERENCES business_locations(id, business_id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_business_inventory_commands_ingredient_scope
    FOREIGN KEY (ingredient_id, business_id, organization_id)
    REFERENCES business_ingredients(id, business_id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT ck_business_inventory_commands_shape CHECK (
    (operation IN ('purchase_receipt', 'waste', 'return_in', 'return_out')
      AND requested_quantity IS NOT NULL AND requested_quantity > 0
      AND requested_delta IS NULL AND counted_quantity IS NULL)
    OR
    (operation = 'adjustment'
      AND requested_quantity IS NULL AND requested_delta IS NOT NULL AND requested_delta <> 0
      AND counted_quantity IS NULL)
    OR
    (operation = 'stocktake'
      AND requested_quantity IS NULL AND requested_delta IS NULL
      AND counted_quantity IS NOT NULL AND counted_quantity >= 0)
  ),
  CONSTRAINT ck_business_inventory_commands_reason CHECK (
    operation NOT IN ('waste', 'adjustment', 'return_out', 'stocktake')
    OR length(btrim(reason)) > 0
  ),
  CONSTRAINT ck_business_inventory_commands_reason_length CHECK (length(reason) <= 2000),
  UNIQUE (business_id, idempotency_key),
  UNIQUE (id, business_id, organization_id, location_id, ingredient_id)
);

CREATE INDEX idx_business_inventory_commands_timeline
  ON business_inventory_commands (business_id, organization_id, location_id, created_at DESC, id DESC);
CREATE INDEX idx_business_inventory_commands_ingredient
  ON business_inventory_commands (business_id, organization_id, location_id, ingredient_id, created_at DESC);

ALTER TABLE business_inventory_movements
  DROP CONSTRAINT business_inventory_movements_movement_type_check;

ALTER TABLE business_inventory_movements
  ADD COLUMN location_id UUID NULL,
  ADD COLUMN command_id UUID NULL,
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

UPDATE business_inventory_movements movement
SET location_id = location.id
FROM business_locations location
WHERE movement.location_id IS NULL
  AND location.business_id = movement.business_id
  AND location.organization_id = movement.organization_id
  AND location.is_primary;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM business_inventory_movements WHERE location_id IS NULL) THEN
    RAISE EXCEPTION 'cannot attribute existing inventory movement to a primary branch';
  END IF;
END;
$$;

ALTER TABLE business_inventory_movements
  ALTER COLUMN location_id SET NOT NULL,
  ADD CONSTRAINT fk_business_inventory_movements_location_scope
    FOREIGN KEY (location_id, business_id, organization_id)
    REFERENCES business_locations(id, business_id, organization_id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT fk_business_inventory_movements_command_scope
    FOREIGN KEY (command_id, business_id, organization_id, location_id, ingredient_id)
    REFERENCES business_inventory_commands(id, business_id, organization_id, location_id, ingredient_id)
    ON DELETE RESTRICT;

CREATE INDEX idx_business_inventory_movements_location_created
  ON business_inventory_movements (
    business_id, organization_id, location_id, created_at DESC, id DESC
  );
CREATE UNIQUE INDEX ux_business_inventory_movements_command
  ON business_inventory_movements (command_id)
  WHERE command_id IS NOT NULL;

CREATE OR REPLACE FUNCTION sync_primary_balance_from_legacy_ingredient()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  primary_location_id UUID;
BEGIN
  -- Prevent the reverse compatibility trigger from bouncing the same write back.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  SELECT location.id INTO primary_location_id
  FROM business_locations location
  WHERE location.business_id = NEW.business_id
    AND location.organization_id = NEW.organization_id
    AND location.is_primary
  LIMIT 1;

  IF primary_location_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO business_ingredient_balances (
    organization_id, business_id, location_id, ingredient_id,
    quantity, updated_at
  ) VALUES (
    NEW.organization_id, NEW.business_id, primary_location_id, NEW.id,
    NEW.stock_quantity, NOW()
  )
  ON CONFLICT (location_id, ingredient_id) DO UPDATE SET
    quantity = EXCLUDED.quantity,
    version = CASE
      WHEN business_ingredient_balances.quantity IS DISTINCT FROM EXCLUDED.quantity
        THEN business_ingredient_balances.version + 1
      ELSE business_ingredient_balances.version
    END,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_business_ingredients_primary_balance_insert
AFTER INSERT ON business_ingredients
FOR EACH ROW EXECUTE FUNCTION sync_primary_balance_from_legacy_ingredient();

CREATE TRIGGER trg_business_ingredients_primary_balance_update
AFTER UPDATE OF stock_quantity ON business_ingredients
FOR EACH ROW
WHEN (OLD.stock_quantity IS DISTINCT FROM NEW.stock_quantity)
EXECUTE FUNCTION sync_primary_balance_from_legacy_ingredient();

CREATE OR REPLACE FUNCTION sync_legacy_ingredient_from_primary_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  primary_location BOOLEAN;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  SELECT location.is_primary INTO primary_location
  FROM business_locations location
  WHERE location.id = NEW.location_id
    AND location.business_id = NEW.business_id
    AND location.organization_id = NEW.organization_id;

  IF COALESCE(primary_location, FALSE) THEN
    UPDATE business_ingredients
    SET stock_quantity = NEW.quantity, updated_at = NOW()
    WHERE id = NEW.ingredient_id
      AND business_id = NEW.business_id
      AND organization_id = NEW.organization_id
      AND stock_quantity IS DISTINCT FROM NEW.quantity;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_business_ingredient_balances_primary_projection
AFTER INSERT OR UPDATE OF quantity ON business_ingredient_balances
FOR EACH ROW EXECUTE FUNCTION sync_legacy_ingredient_from_primary_balance();

CREATE OR REPLACE FUNCTION resolve_inventory_movement_location()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.location_id IS NULL THEN
    SELECT location.id INTO NEW.location_id
    FROM business_locations location
    WHERE location.business_id = NEW.business_id
      AND location.organization_id = NEW.organization_id
      AND location.is_primary
      AND location.status <> 'closed'
    LIMIT 1;
  END IF;

  IF NEW.location_id IS NULL THEN
    RAISE EXCEPTION 'primary inventory location missing for business %', NEW.business_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_business_inventory_movements_resolve_location
BEFORE INSERT ON business_inventory_movements
FOR EACH ROW EXECUTE FUNCTION resolve_inventory_movement_location();

CREATE OR REPLACE FUNCTION reject_branch_inventory_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER trg_business_inventory_commands_append_only
BEFORE UPDATE OR DELETE ON business_inventory_commands
FOR EACH ROW EXECUTE FUNCTION reject_branch_inventory_evidence_mutation();

CREATE TRIGGER trg_business_inventory_movements_append_only
BEFORE UPDATE OR DELETE ON business_inventory_movements
FOR EACH ROW EXECUTE FUNCTION reject_branch_inventory_evidence_mutation();
