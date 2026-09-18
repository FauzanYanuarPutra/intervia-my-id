BEGIN;

-- Business Execution Kernel V1
-- Activates typed Business Profile policy in operational transactions without
-- rewriting historical migrations. Existing rows are backfilled to their
-- canonical primary location and retain compatibility projections.

CREATE TABLE business_document_sequences (
  business_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('sale', 'purchase')),
  next_value BIGINT NOT NULL DEFAULT 1 CHECK (next_value > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (business_id, document_type),
  CONSTRAINT fk_business_document_sequences_scope
    FOREIGN KEY (business_id, organization_id)
    REFERENCES businesses(id, organization_id)
    ON DELETE CASCADE
);

ALTER TABLE business_sales
  ADD COLUMN location_id UUID NULL,
  ADD COLUMN currency CHAR(3) NULL,
  ADD COLUMN document_number TEXT NULL,
  ADD COLUMN source_order_id UUID NULL REFERENCES orders(id) ON DELETE RESTRICT,
  ADD COLUMN correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN policy_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(policy_snapshot) = 'object');

UPDATE business_sales sale
SET location_id = location.id,
    currency = profile.currency,
    document_number = profile.document_prefix || '-SAL-LEGACY-' ||
      LPAD(ranked.sequence_number::TEXT, 6, '0'),
    policy_snapshot = jsonb_build_object(
      'profile_version', profile.version,
      'accounting_mode', profile.accounting_mode,
      'costing_policy', profile.costing_policy,
      'branch_mode', profile.branch_mode,
      'negative_stock_policy', profile.negative_stock_policy
    )
FROM business_profiles profile
JOIN business_locations location
  ON location.business_id = profile.business_id
 AND location.organization_id = profile.organization_id
 AND location.is_primary
JOIN (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY business_id ORDER BY occurred_on, created_at, id
  ) AS sequence_number
  FROM business_sales
) ranked ON ranked.id = sale.id
WHERE profile.business_id = sale.business_id
  AND profile.organization_id = sale.organization_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM business_sales
    WHERE location_id IS NULL OR currency IS NULL OR document_number IS NULL
  ) THEN
    RAISE EXCEPTION 'cannot backfill canonical execution fields for business_sales';
  END IF;
END;
$$;

ALTER TABLE business_sales
  ALTER COLUMN location_id SET NOT NULL,
  ALTER COLUMN currency SET NOT NULL,
  ALTER COLUMN document_number SET NOT NULL,
  ADD CONSTRAINT fk_business_sales_location_scope
    FOREIGN KEY (location_id, business_id, organization_id)
    REFERENCES business_locations(id, business_id, organization_id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT chk_business_sales_currency
    CHECK (currency ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT chk_business_sales_document_number
    CHECK (length(btrim(document_number)) BETWEEN 5 AND 80);

CREATE UNIQUE INDEX ux_business_sales_document_number
  ON business_sales (business_id, document_number);
CREATE UNIQUE INDEX ux_business_sales_source_order
  ON business_sales (business_id, source_order_id)
  WHERE source_order_id IS NOT NULL;
CREATE INDEX idx_business_sales_location_date
  ON business_sales (business_id, organization_id, location_id, occurred_on DESC, created_at DESC);

ALTER TABLE business_purchases
  ADD COLUMN location_id UUID NULL,
  ADD COLUMN currency CHAR(3) NULL,
  ADD COLUMN document_number TEXT NULL,
  ADD COLUMN correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN policy_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(policy_snapshot) = 'object');

UPDATE business_purchases purchase
SET location_id = location.id,
    currency = profile.currency,
    document_number = profile.document_prefix || '-PUR-LEGACY-' ||
      LPAD(ranked.sequence_number::TEXT, 6, '0'),
    policy_snapshot = jsonb_build_object(
      'profile_version', profile.version,
      'accounting_mode', profile.accounting_mode,
      'costing_policy', profile.costing_policy,
      'branch_mode', profile.branch_mode,
      'negative_stock_policy', profile.negative_stock_policy
    )
FROM business_profiles profile
JOIN business_locations location
  ON location.business_id = profile.business_id
 AND location.organization_id = profile.organization_id
 AND location.is_primary
JOIN (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY business_id ORDER BY occurred_on, created_at, id
  ) AS sequence_number
  FROM business_purchases
) ranked ON ranked.id = purchase.id
WHERE profile.business_id = purchase.business_id
  AND profile.organization_id = purchase.organization_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM business_purchases
    WHERE location_id IS NULL OR currency IS NULL OR document_number IS NULL
  ) THEN
    RAISE EXCEPTION 'cannot backfill canonical execution fields for business_purchases';
  END IF;
END;
$$;

ALTER TABLE business_purchases
  ALTER COLUMN location_id SET NOT NULL,
  ALTER COLUMN currency SET NOT NULL,
  ALTER COLUMN document_number SET NOT NULL,
  ADD CONSTRAINT fk_business_purchases_location_scope
    FOREIGN KEY (location_id, business_id, organization_id)
    REFERENCES business_locations(id, business_id, organization_id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT chk_business_purchases_currency
    CHECK (currency ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT chk_business_purchases_document_number
    CHECK (length(btrim(document_number)) BETWEEN 5 AND 80);

CREATE UNIQUE INDEX ux_business_purchases_document_number
  ON business_purchases (business_id, document_number);
CREATE INDEX idx_business_purchases_location_date
  ON business_purchases (business_id, organization_id, location_id, occurred_on DESC, created_at DESC);

CREATE TABLE business_product_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  location_id UUID NOT NULL,
  product_id UUID NOT NULL,
  stock_count DOUBLE PRECISION NULL CHECK (
    stock_count IS NULL OR (
      stock_count >= 0
      AND stock_count NOT IN (
        'NaN'::DOUBLE PRECISION,
        'Infinity'::DOUBLE PRECISION,
        '-Infinity'::DOUBLE PRECISION
      )
    )
  ),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_product_balances_location_scope
    FOREIGN KEY (location_id, business_id, organization_id)
    REFERENCES business_locations(id, business_id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_business_product_balances_product_scope
    FOREIGN KEY (product_id, business_id, organization_id)
    REFERENCES business_products(id, business_id, organization_id)
    ON DELETE RESTRICT,
  UNIQUE (location_id, product_id)
);

CREATE INDEX idx_business_product_balances_scope
  ON business_product_balances (
    business_id, organization_id, location_id, product_id
  );

INSERT INTO business_product_balances (
  organization_id, business_id, location_id, product_id, stock_count,
  created_at, updated_at
)
SELECT
  inventory.organization_id,
  inventory.business_id,
  location.id,
  inventory.product_id,
  inventory.stock_count,
  LEAST(inventory.created_at, location.created_at),
  GREATEST(inventory.updated_at, location.updated_at)
FROM business_inventory inventory
JOIN business_locations location
  ON location.business_id = inventory.business_id
 AND location.organization_id = inventory.organization_id
 AND location.is_primary
ON CONFLICT (location_id, product_id) DO NOTHING;

CREATE TABLE business_product_inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  location_id UUID NOT NULL,
  product_id UUID NOT NULL,
  movement_type TEXT NOT NULL CHECK (
    movement_type IN ('sale_consumption', 'adjustment', 'return_in', 'return_out')
  ),
  quantity_delta DOUBLE PRECISION NOT NULL CHECK (
    quantity_delta <> 0
    AND quantity_delta NOT IN (
      'NaN'::DOUBLE PRECISION,
      'Infinity'::DOUBLE PRECISION,
      '-Infinity'::DOUBLE PRECISION
    )
  ),
  quantity_before DOUBLE PRECISION NOT NULL CHECK (quantity_before >= 0),
  quantity_after DOUBLE PRECISION NOT NULL CHECK (quantity_after >= 0),
  source_type TEXT NULL,
  source_id UUID NULL,
  note TEXT NOT NULL DEFAULT '',
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_product_inventory_movements_location_scope
    FOREIGN KEY (location_id, business_id, organization_id)
    REFERENCES business_locations(id, business_id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_business_product_inventory_movements_product_scope
    FOREIGN KEY (product_id, business_id, organization_id)
    REFERENCES business_products(id, business_id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT ck_business_product_inventory_movements_source_pair
    CHECK ((source_type IS NULL) = (source_id IS NULL)),
  CONSTRAINT ck_business_product_inventory_movements_balance
    CHECK (abs(quantity_after - (quantity_before + quantity_delta)) < 0.000001)
);

CREATE INDEX idx_business_product_inventory_movements_timeline
  ON business_product_inventory_movements (
    business_id, organization_id, location_id, product_id, created_at DESC, id DESC
  );
CREATE UNIQUE INDEX ux_business_product_sale_movement
  ON business_product_inventory_movements (
    business_id, location_id, product_id, source_type, source_id, movement_type
  )
  WHERE source_type='business_sale' AND source_id IS NOT NULL
    AND movement_type='sale_consumption';

CREATE OR REPLACE FUNCTION sync_primary_product_balance_from_legacy_inventory()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  primary_location_id UUID;
BEGIN
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

  INSERT INTO business_product_balances (
    organization_id, business_id, location_id, product_id, stock_count, updated_at
  ) VALUES (
    NEW.organization_id, NEW.business_id, primary_location_id, NEW.product_id,
    NEW.stock_count, NOW()
  )
  ON CONFLICT (location_id, product_id) DO UPDATE SET
    stock_count = EXCLUDED.stock_count,
    version = CASE
      WHEN business_product_balances.stock_count IS DISTINCT FROM EXCLUDED.stock_count
        THEN business_product_balances.version + 1
      ELSE business_product_balances.version
    END,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_business_inventory_primary_product_balance_insert
AFTER INSERT ON business_inventory
FOR EACH ROW EXECUTE FUNCTION sync_primary_product_balance_from_legacy_inventory();

CREATE TRIGGER trg_business_inventory_primary_product_balance_update
AFTER UPDATE OF stock_count ON business_inventory
FOR EACH ROW
WHEN (OLD.stock_count IS DISTINCT FROM NEW.stock_count)
EXECUTE FUNCTION sync_primary_product_balance_from_legacy_inventory();

CREATE OR REPLACE FUNCTION sync_legacy_inventory_from_primary_product_balance()
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
    UPDATE business_inventory
    SET stock_count = NEW.stock_count, updated_at = NOW()
    WHERE product_id = NEW.product_id
      AND business_id = NEW.business_id
      AND organization_id = NEW.organization_id
      AND stock_count IS DISTINCT FROM NEW.stock_count;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_business_product_balances_primary_projection
AFTER INSERT OR UPDATE OF stock_count ON business_product_balances
FOR EACH ROW EXECUTE FUNCTION sync_legacy_inventory_from_primary_product_balance();

CREATE OR REPLACE FUNCTION reject_business_product_inventory_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER trg_business_product_inventory_movements_append_only
BEFORE UPDATE OR DELETE ON business_product_inventory_movements
FOR EACH ROW EXECUTE FUNCTION reject_business_product_inventory_evidence_mutation();

ALTER TABLE business_finance_entries
  DROP CONSTRAINT IF EXISTS business_finance_entries_entry_type_check;

ALTER TABLE business_finance_entries
  ADD CONSTRAINT business_finance_entries_entry_type_check
  CHECK (entry_type IN (
    'sale_income', 'other_income',
    'inventory_purchase', 'inventory_expense', 'ingredient_purchase', 'packaging_purchase',
    'payroll_expense', 'salary', 'rent_expense', 'rent',
    'utilities_expense', 'utilities', 'transport_expense', 'transport',
    'marketing_expense', 'marketing', 'equipment_expense', 'equipment',
    'capital_income', 'owner_capital', 'owner_draw', 'owner_drawing',
    'receivable_payment', 'payable_payment', 'sale_refund', 'other_expense'
  ));

COMMIT;
