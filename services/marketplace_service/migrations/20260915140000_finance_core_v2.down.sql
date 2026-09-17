BEGIN;

DROP VIEW IF EXISTS business_finance_account_balances;
DROP VIEW IF EXISTS business_allocation_bucket_balances;

DROP TRIGGER IF EXISTS business_allocation_movements_append_only ON business_allocation_movements;
DROP TRIGGER IF EXISTS business_finance_corrections_append_only ON business_finance_entry_corrections;
DROP TRIGGER IF EXISTS business_finance_commands_append_only ON business_finance_commands;
DROP TRIGGER IF EXISTS business_finance_entries_append_only ON business_finance_entries;
DROP FUNCTION IF EXISTS reject_business_finance_core_mutation();

DROP TABLE IF EXISTS business_allocation_movements;
DROP TABLE IF EXISTS business_finance_entry_corrections;
DROP TABLE IF EXISTS business_finance_commands;

DROP INDEX IF EXISTS business_finance_entries_command_idx;
DROP INDEX IF EXISTS business_finance_entries_business_date_idx;
DROP INDEX IF EXISTS business_finance_entries_one_reversal_per_entry;

ALTER TABLE business_finance_entries
  DROP CONSTRAINT IF EXISTS business_finance_entries_allocation_bucket_check,
  DROP CONSTRAINT IF EXISTS business_finance_entries_effect_multiplier_check,
  DROP COLUMN IF EXISTS allocation_bucket,
  DROP COLUMN IF EXISTS finance_command_id,
  DROP COLUMN IF EXISTS correction_reason,
  DROP COLUMN IF EXISTS corrects_entry_id,
  DROP COLUMN IF EXISTS reversal_of_entry_id,
  DROP COLUMN IF EXISTS effect_multiplier;

COMMIT;
