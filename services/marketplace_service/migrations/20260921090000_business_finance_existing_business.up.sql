BEGIN;

ALTER TABLE business_finance_entries
  DROP CONSTRAINT IF EXISTS business_finance_entries_entry_type_check;

ALTER TABLE business_finance_entries
  ADD CONSTRAINT business_finance_entries_entry_type_check
  CHECK (entry_type IN (
    'sale_income',
    'other_income',
    'ingredient_purchase',
    'packaging_purchase',
    'rent',
    'utilities',
    'salary',
    'transport',
    'marketing',
    'equipment',
    'owner_capital',
    'owner_drawing',
    'receivable_payment',
    'payable_payment',
    'other_expense',
    'opening_balance',
    'account_transfer'
  ));

ALTER TABLE business_finance_commands
  DROP CONSTRAINT IF EXISTS business_finance_commands_operation_check;

ALTER TABLE business_finance_commands
  ADD CONSTRAINT business_finance_commands_operation_check
  CHECK (operation IN (
    'create_entry',
    'correct_entry',
    'move_allocation',
    'transfer_accounts'
  ));

CREATE INDEX IF NOT EXISTS business_finance_entries_source_idx
  ON business_finance_entries (business_id, source_type, source_id, occurred_on DESC)
  WHERE source_type IS NOT NULL;

COMMIT;
