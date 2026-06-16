-- Wallet + top-up foundation
-- Separate balances between development and live environments.
-- Keep DDL idempotent and safe for shared environments.

CREATE TABLE IF NOT EXISTS wallet_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  environment TEXT NOT NULL DEFAULT 'development',
  currency TEXT NOT NULL DEFAULT 'IDR',
  available_balance_cents BIGINT NOT NULL DEFAULT 0,
  held_balance_cents BIGINT NOT NULL DEFAULT 0,
  total_topup_cents BIGINT NOT NULL DEFAULT 0,
  total_spend_cents BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, environment, currency)
);

DO $$
BEGIN
  ALTER TABLE wallet_accounts DROP CONSTRAINT IF EXISTS chk_wallet_accounts_environment;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE wallet_accounts
    ADD CONSTRAINT chk_wallet_accounts_environment
    CHECK (environment IN ('development', 'live'))
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE wallet_accounts DROP CONSTRAINT IF EXISTS chk_wallet_accounts_status;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE wallet_accounts
    ADD CONSTRAINT chk_wallet_accounts_status
    CHECK (status IN ('active', 'suspended', 'closed'))
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE wallet_accounts DROP CONSTRAINT IF EXISTS chk_wallet_accounts_non_negative;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE wallet_accounts
    ADD CONSTRAINT chk_wallet_accounts_non_negative
    CHECK (
      available_balance_cents >= 0
      AND held_balance_cents >= 0
      AND total_topup_cents >= 0
      AND total_spend_cents >= 0
    )
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_wallet_accounts_user_env ON wallet_accounts(user_id, environment);
CREATE INDEX IF NOT EXISTS idx_wallet_accounts_updated_at ON wallet_accounts(updated_at DESC);

CREATE TABLE IF NOT EXISTS wallet_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id UUID NOT NULL,
  environment TEXT NOT NULL DEFAULT 'development',
  amount_cents BIGINT NOT NULL,
  fee_cents BIGINT NOT NULL DEFAULT 0,
  net_amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IDR',
  payment_provider TEXT NOT NULL DEFAULT 'mock',
  payment_method TEXT,
  external_reference TEXT,
  checkout_url TEXT,
  payment_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(external_reference)
);

DO $$
BEGIN
  ALTER TABLE wallet_topups DROP CONSTRAINT IF EXISTS chk_wallet_topups_environment;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE wallet_topups
    ADD CONSTRAINT chk_wallet_topups_environment
    CHECK (environment IN ('development', 'live'))
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE wallet_topups DROP CONSTRAINT IF EXISTS chk_wallet_topups_positive;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE wallet_topups
    ADD CONSTRAINT chk_wallet_topups_positive
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

DO $$
BEGIN
  ALTER TABLE wallet_topups DROP CONSTRAINT IF EXISTS chk_wallet_topups_status;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE wallet_topups
    ADD CONSTRAINT chk_wallet_topups_status
    CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'expired'))
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE wallet_topups DROP CONSTRAINT IF EXISTS chk_wallet_topups_provider;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE wallet_topups
    ADD CONSTRAINT chk_wallet_topups_provider
    CHECK (
      payment_provider IN (
        'midtrans',
        'stripe',
        'xendit',
        'paypal',
        'adyen',
        'manual',
        'mock'
      )
    )
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_wallet_topups_user_created_at ON wallet_topups(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_topups_status ON wallet_topups(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_topups_env_status ON wallet_topups(environment, status, created_at DESC);

CREATE TABLE IF NOT EXISTS wallet_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id UUID NOT NULL,
  environment TEXT NOT NULL DEFAULT 'development',
  currency TEXT NOT NULL DEFAULT 'IDR',
  direction TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  balance_after_cents BIGINT NOT NULL,
  entry_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'posted',
  reference_type TEXT,
  reference_id UUID,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  ALTER TABLE wallet_ledger_entries DROP CONSTRAINT IF EXISTS chk_wallet_ledger_environment;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE wallet_ledger_entries
    ADD CONSTRAINT chk_wallet_ledger_environment
    CHECK (environment IN ('development', 'live'))
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE wallet_ledger_entries DROP CONSTRAINT IF EXISTS chk_wallet_ledger_direction;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE wallet_ledger_entries
    ADD CONSTRAINT chk_wallet_ledger_direction
    CHECK (direction IN ('credit', 'debit'))
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

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

DO $$
BEGIN
  ALTER TABLE wallet_ledger_entries DROP CONSTRAINT IF EXISTS chk_wallet_ledger_status;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE wallet_ledger_entries
    ADD CONSTRAINT chk_wallet_ledger_status
    CHECK (status IN ('pending', 'posted', 'reversed'))
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE wallet_ledger_entries DROP CONSTRAINT IF EXISTS chk_wallet_ledger_positive;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE wallet_ledger_entries
    ADD CONSTRAINT chk_wallet_ledger_positive
    CHECK (
      amount_cents > 0
      AND balance_after_cents >= 0
    )
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user_created_at ON wallet_ledger_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_account_created_at ON wallet_ledger_entries(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_reference ON wallet_ledger_entries(reference_type, reference_id);

SELECT 1;
