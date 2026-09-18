DROP INDEX IF EXISTS idx_order_state_transitions_idempotency_key;

ALTER TABLE order_state_transitions
  DROP CONSTRAINT IF EXISTS order_state_transition_idempotency_pair,
  DROP COLUMN IF EXISTS request_hash,
  DROP COLUMN IF EXISTS idempotency_key;
