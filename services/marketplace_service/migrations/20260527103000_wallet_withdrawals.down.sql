DO $$
BEGIN
  ALTER TABLE wallet_ledger_entries DROP CONSTRAINT IF EXISTS chk_wallet_ledger_entry_type;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE wallet_ledger_entries
    ADD CONSTRAINT chk_wallet_ledger_entry_type
    CHECK (
      entry_type IN (
        'topup',
        'payment_hold',
        'payment_release',
        'refund',
        'fee',
        'adjustment'
      )
    )
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DROP TABLE IF EXISTS wallet_withdrawals;

SELECT 1;
