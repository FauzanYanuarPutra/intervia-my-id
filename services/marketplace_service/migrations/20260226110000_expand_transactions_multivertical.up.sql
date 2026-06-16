-- Multi-vertical transaction foundation:
-- Shopee-like product, Upwork-like service, on-demand ride/delivery, and jobs flow.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS deal_kind TEXT NOT NULL DEFAULT 'product',
  ADD COLUMN IF NOT EXISTS fulfillment_mode TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS transaction_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_transactions_status;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE transactions
    ADD CONSTRAINT chk_transactions_status
    CHECK (
      transaction_status IN (
        'pending',
        'accepted',
        'in_progress',
        'delivered',
        'completed',
        'cancelled',
        'disputed'
      )
    )
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE transactions
    ADD CONSTRAINT chk_transactions_deal_kind
    CHECK (
      deal_kind IN (
        'product',
        'service',
        'job',
        'property',
        'profile',
        'ride',
        'delivery',
        'food',
        'other'
      )
    )
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE transactions
    ADD CONSTRAINT chk_transactions_fulfillment_mode
    CHECK (
      fulfillment_mode IN (
        'standard',
        'shipping',
        'pickup',
        'remote',
        'onsite',
        'instant'
      )
    )
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_deal_kind ON transactions(deal_kind);
CREATE INDEX IF NOT EXISTS idx_transactions_fulfillment_mode ON transactions(fulfillment_mode);
CREATE INDEX IF NOT EXISTS idx_transactions_status_kind ON transactions(transaction_status, deal_kind);

SELECT 1;
