ALTER TABLE business_finance_entries
  ADD COLUMN IF NOT EXISTS effect_sign SMALLINT NOT NULL DEFAULT 1;

DO $$
BEGIN
  ALTER TABLE business_finance_entries
    ADD CONSTRAINT business_finance_entries_effect_sign_check
    CHECK (effect_sign IN (-1, 1));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE business_sales
  ADD COLUMN IF NOT EXISTS void_reason TEXT,
  ADD COLUMN IF NOT EXISTS voided_by_user_id UUID,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS void_idempotency_key UUID,
  ADD COLUMN IF NOT EXISTS void_request_hash TEXT;

DO $$
BEGIN
  ALTER TABLE business_sales
    ADD CONSTRAINT business_sale_void_idempotency_pair
    CHECK (
      (void_idempotency_key IS NULL AND void_request_hash IS NULL)
      OR (
        void_idempotency_key IS NOT NULL
        AND void_request_hash IS NOT NULL
        AND length(void_request_hash) = 64
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_sales_void_idempotency
  ON business_sales (business_id, void_idempotency_key)
  WHERE void_idempotency_key IS NOT NULL;
