ALTER TABLE order_state_transitions
  ADD COLUMN IF NOT EXISTS idempotency_key UUID NULL,
  ADD COLUMN IF NOT EXISTS request_hash TEXT NULL;

DO $$
BEGIN
  ALTER TABLE order_state_transitions
    ADD CONSTRAINT order_state_transition_idempotency_pair
    CHECK (
      (idempotency_key IS NULL AND request_hash IS NULL)
      OR (idempotency_key IS NOT NULL AND request_hash IS NOT NULL AND length(request_hash) = 64)
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_state_transitions_idempotency_key
  ON order_state_transitions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
