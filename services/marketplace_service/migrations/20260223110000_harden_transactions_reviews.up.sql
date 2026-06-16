-- Harden transaction integrity and review idempotency.
-- Use NOT VALID so existing legacy data does not block deployment,
-- while still enforcing constraints for new/updated rows.

DO $$
BEGIN
  ALTER TABLE transactions
    ADD CONSTRAINT chk_transactions_status
    CHECK (transaction_status IN ('pending', 'accepted', 'cancelled', 'completed'))
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE transactions
    ADD CONSTRAINT chk_transactions_positive_amount
    CHECK (amount_cents > 0)
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE transactions
    ADD CONSTRAINT chk_transactions_buyer_not_seller
    CHECK (buyer_id <> seller_id)
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_unique_reviewer_per_transaction
  ON reviews (transaction_id, reviewer_id)
  WHERE transaction_id IS NOT NULL;

SELECT 1;
