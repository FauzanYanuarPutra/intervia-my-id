BEGIN;

DROP TRIGGER IF EXISTS trg_business_product_inventory_movements_append_only
  ON business_product_inventory_movements;
DROP FUNCTION IF EXISTS reject_business_product_inventory_evidence_mutation();

DROP TRIGGER IF EXISTS trg_business_product_balances_primary_projection
  ON business_product_balances;
DROP FUNCTION IF EXISTS sync_legacy_inventory_from_primary_product_balance();

DROP TRIGGER IF EXISTS trg_business_inventory_primary_product_balance_update
  ON business_inventory;
DROP TRIGGER IF EXISTS trg_business_inventory_primary_product_balance_insert
  ON business_inventory;
DROP FUNCTION IF EXISTS sync_primary_product_balance_from_legacy_inventory();

DROP TABLE IF EXISTS business_product_inventory_movements;
DROP TABLE IF EXISTS business_product_balances;

DROP INDEX IF EXISTS idx_business_purchases_location_date;
DROP INDEX IF EXISTS ux_business_purchases_document_number;
ALTER TABLE business_purchases
  DROP CONSTRAINT IF EXISTS chk_business_purchases_document_number,
  DROP CONSTRAINT IF EXISTS chk_business_purchases_currency,
  DROP CONSTRAINT IF EXISTS fk_business_purchases_location_scope,
  DROP COLUMN IF EXISTS policy_snapshot,
  DROP COLUMN IF EXISTS correlation_id,
  DROP COLUMN IF EXISTS document_number,
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS location_id;

DROP INDEX IF EXISTS idx_business_sales_location_date;
DROP INDEX IF EXISTS ux_business_sales_source_order;
DROP INDEX IF EXISTS ux_business_sales_document_number;
ALTER TABLE business_sales
  DROP CONSTRAINT IF EXISTS chk_business_sales_document_number,
  DROP CONSTRAINT IF EXISTS chk_business_sales_currency,
  DROP CONSTRAINT IF EXISTS fk_business_sales_location_scope,
  DROP COLUMN IF EXISTS policy_snapshot,
  DROP COLUMN IF EXISTS correlation_id,
  DROP COLUMN IF EXISTS source_order_id,
  DROP COLUMN IF EXISTS document_number,
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS location_id;

DROP TABLE IF EXISTS business_document_sequences;

ALTER TABLE business_finance_entries
  DROP CONSTRAINT IF EXISTS business_finance_entries_entry_type_check;
ALTER TABLE business_finance_entries
  ADD CONSTRAINT business_finance_entries_entry_type_check
  CHECK (entry_type IN (
    'sale_income', 'other_income',
    'inventory_expense', 'ingredient_purchase', 'packaging_purchase',
    'payroll_expense', 'salary', 'rent_expense', 'rent',
    'utilities_expense', 'utilities', 'transport_expense', 'transport',
    'marketing_expense', 'marketing', 'equipment_expense', 'equipment',
    'capital_income', 'owner_capital', 'owner_draw', 'owner_drawing',
    'receivable_payment', 'payable_payment', 'sale_refund', 'other_expense'
  ));

COMMIT;
