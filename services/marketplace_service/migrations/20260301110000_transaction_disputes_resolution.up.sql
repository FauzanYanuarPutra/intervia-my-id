-- Transaction dispute case storage + resolution amounts.
-- Keeps dispute evidence and final fund split in structured columns.

CREATE TABLE IF NOT EXISTS transaction_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  opened_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  reason_code TEXT NOT NULL,
  evidence_note TEXT NOT NULL,
  evidence_attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  counterparty_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  resolution_code TEXT,
  resolution_reason_code TEXT,
  resolution_notes TEXT,
  seller_fault_ratio INT,
  platform_fee_cents BIGINT NOT NULL DEFAULT 0,
  refund_amount_cents BIGINT NOT NULL DEFAULT 0,
  release_amount_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'IDR',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transaction_disputes_tx_unique
  ON transaction_disputes(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_disputes_status_opened_at
  ON transaction_disputes(status, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_disputes_opened_by
  ON transaction_disputes(opened_by, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_disputes_resolved_at
  ON transaction_disputes(resolved_at DESC);

DO $$
BEGIN
  ALTER TABLE transaction_disputes DROP CONSTRAINT IF EXISTS chk_transaction_disputes_status;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE transaction_disputes
    ADD CONSTRAINT chk_transaction_disputes_status
    CHECK (
      status IN (
        'open',
        'awaiting_counterparty_evidence',
        'under_review',
        'resolved',
        'closed'
      )
    )
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE transaction_disputes DROP CONSTRAINT IF EXISTS chk_transaction_disputes_ratio;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE transaction_disputes
    ADD CONSTRAINT chk_transaction_disputes_ratio
    CHECK (
      seller_fault_ratio IS NULL OR
      (seller_fault_ratio >= 0 AND seller_fault_ratio <= 100)
    )
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE transaction_disputes DROP CONSTRAINT IF EXISTS chk_transaction_disputes_amounts_non_negative;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE transaction_disputes
    ADD CONSTRAINT chk_transaction_disputes_amounts_non_negative
    CHECK (
      platform_fee_cents >= 0
      AND refund_amount_cents >= 0
      AND release_amount_cents >= 0
    )
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

SELECT 1;
