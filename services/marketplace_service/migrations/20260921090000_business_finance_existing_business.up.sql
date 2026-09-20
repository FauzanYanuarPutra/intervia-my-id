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

CREATE OR REPLACE VIEW business_finance_account_balances AS
WITH effective_entries AS (
  SELECT id,
         business_id,
         organization_id,
         lower(account_key) AS account_key,
         lower(entry_type) AS entry_type,
         amount,
         effect_multiplier
  FROM business_finance_entries
), movements AS (
  SELECT business_id,
         organization_id,
         account_key AS account_key,
         CASE
           WHEN account_key IN ('cash','bank','ewallet') THEN
             CASE
               WHEN entry_type IN ('sale_income','other_income','capital_income','owner_capital','receivable_payment','opening_balance','account_transfer') THEN amount * effect_multiplier
               WHEN entry_type IN ('inventory_purchase','inventory_expense','ingredient_purchase','packaging_purchase','payroll_expense','salary','rent_expense','rent','utilities_expense','utilities','transport_expense','transport','marketing_expense','marketing','equipment_expense','equipment','owner_draw','owner_drawing','payable_payment','other_expense','sale_refund') THEN -amount * effect_multiplier
               ELSE 0
             END
           ELSE 0
         END::BIGINT AS amount_delta
  FROM effective_entries
  WHERE account_key IN ('cash','bank','ewallet')

  UNION ALL

  SELECT business_id,
         organization_id,
         'receivable'::TEXT,
         CASE
           WHEN entry_type = 'sale_income' AND account_key = 'receivable' THEN amount * effect_multiplier
           WHEN entry_type = 'opening_balance' AND account_key = 'receivable' THEN amount * effect_multiplier
           WHEN entry_type = 'receivable_payment' THEN -amount * effect_multiplier
           ELSE 0
         END::BIGINT
  FROM effective_entries
  WHERE (entry_type IN ('sale_income','opening_balance') AND account_key = 'receivable')
     OR entry_type = 'receivable_payment'

  UNION ALL

  SELECT business_id,
         organization_id,
         'payable'::TEXT,
         CASE
           WHEN entry_type IN ('inventory_purchase','inventory_expense','ingredient_purchase','packaging_purchase') AND account_key = 'payable' THEN amount * effect_multiplier
           WHEN entry_type = 'opening_balance' AND account_key = 'payable' THEN amount * effect_multiplier
           WHEN entry_type = 'payable_payment' THEN -amount * effect_multiplier
           ELSE 0
         END::BIGINT
  FROM effective_entries
  WHERE (entry_type IN ('inventory_purchase','inventory_expense','ingredient_purchase','packaging_purchase','opening_balance') AND account_key = 'payable')
     OR entry_type = 'payable_payment'
)
SELECT business_id,
       organization_id,
       account_key,
       COALESCE(SUM(amount_delta), 0)::BIGINT AS balance
FROM movements
GROUP BY business_id, organization_id, account_key;

CREATE INDEX IF NOT EXISTS business_finance_entries_source_idx
  ON business_finance_entries (business_id, source_type, source_id, occurred_on DESC)
  WHERE source_type IS NOT NULL;

COMMIT;
