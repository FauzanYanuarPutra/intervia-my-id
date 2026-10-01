BEGIN;

CREATE TABLE IF NOT EXISTS business_data_reset_batches (
  id UUID PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  idempotency_key UUID NOT NULL,
  request_hash CHAR(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(scopes) = 'array'),
  reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 2000),
  status TEXT NOT NULL CHECK (status IN ('running','completed','partial','failed')),
  affected_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code TEXT NULL,
  actor_user_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_business_data_reset_batches_timeline
  ON business_data_reset_batches (business_id, organization_id, created_at DESC, id DESC);

COMMIT;
