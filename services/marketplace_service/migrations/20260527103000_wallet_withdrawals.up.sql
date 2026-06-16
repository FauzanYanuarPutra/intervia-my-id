-- Wallet withdrawals.
-- User-facing withdraw is a request first: available balance is reserved in held balance
-- until payout processing is handled by ops/provider integration.

CREATE TABLE IF NOT EXISTS wallet_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id UUID NOT NULL,
  environment TEXT NOT NULL DEFAULT 'development',
  amount_cents BIGINT NOT NULL,
  fee_cents BIGINT NOT NULL DEFAULT 0,
  net_amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IDR',
  bank_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  bank_account_name TEXT NOT NULL,
  bank_account_number_masked TEXT NOT NULL,
  bank_account_number_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review',
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  ALTER TABLE wallet_withdrawals DROP CONSTRAINT IF EXISTS chk_wallet_withdrawals_environment;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE wallet_withdrawals
    ADD CONSTRAINT chk_wallet_withdrawals_environment
    CHECK (environment IN ('development', 'live'))
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE wallet_withdrawals DROP CONSTRAINT IF EXISTS chk_wallet_withdrawals_status;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE wallet_withdrawals
    ADD CONSTRAINT chk_wallet_withdrawals_status
    CHECK (status IN ('pending_review', 'processing', 'completed', 'cancelled', 'failed', 'rejected'))
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE wallet_withdrawals DROP CONSTRAINT IF EXISTS chk_wallet_withdrawals_positive;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE wallet_withdrawals
    ADD CONSTRAINT chk_wallet_withdrawals_positive
    CHECK (
      amount_cents > 0
      AND fee_cents >= 0
      AND net_amount_cents >= 0
      AND net_amount_cents <= amount_cents
    )
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_wallet_withdrawals_user_created_at ON wallet_withdrawals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_withdrawals_account_status ON wallet_withdrawals(account_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_withdrawals_env_status ON wallet_withdrawals(environment, status, created_at DESC);

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
        'adjustment',
        'withdrawal_request',
        'withdrawal_cancel'
      )
    )
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

SELECT 1;
