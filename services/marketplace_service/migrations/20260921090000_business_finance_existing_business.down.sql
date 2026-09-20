BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM business_finance_entries
    WHERE entry_type IN ('opening_balance', 'account_transfer')
  ) THEN
    RAISE EXCEPTION 'cannot roll back finance existing-business extension while opening/transfer entries exist';
  END IF;
END $$;

ALTER TABLE business_finance_entries
  DROP CONSTRAINT IF EXISTS business_finance_entries_entry_type_check;

ALTER TABLE business_finance_entries
  ADD CONSTRAINT business_finance_entries_entry_type_check
  CHECK (entry_type IN (
    'sale_income',
    'sale_refund',
    'other_income',
    'capital_income',
    'owner_capital',
    'receivable_payment',
    'ingredient_purchase',
    'packaging_purchase',
    'inventory_purchase',
    'inventory_expense',
    'payroll_expense',
    'salary',
    'rent_expense',
    'rent',
    'utilities_expense',
    'utilities',
    'transport_expense',
    'transport',
    'marketing_expense',
    'marketing',
    'equipment_expense',
    'equipment',
    'owner_draw',
    'owner_drawing',
    'payable_payment',
    'other_expense'
  ));

ALTER TABLE business_finance_commands
  DROP CONSTRAINT IF EXISTS business_finance_commands_operation_check;

ALTER TABLE business_finance_commands
  ADD CONSTRAINT business_finance_commands_operation_check
  CHECK (operation IN (
    'create_entry',
    'correct_entry',
    'move_allocation'
  ));

DROP INDEX IF EXISTS business_finance_entries_source_idx;

COMMIT;
