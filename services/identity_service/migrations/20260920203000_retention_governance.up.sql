BEGIN;

ALTER TABLE core.privacy_requests
  ADD COLUMN IF NOT EXISTS legal_hold BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS core.retention_policies (
  policy_key TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  retention_days INTEGER NOT NULL CHECK (retention_days BETWEEN 1 AND 36500),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO core.retention_policies (policy_key, description, retention_days)
VALUES
  ('privacy_requests_closed', 'Closed privacy requests', 730),
  ('security_incidents_closed', 'Closed security incidents', 2555),
  ('governance_audit_events', 'Governance audit history', 2555),
  ('user_moderation_actions', 'Account moderation history', 2555)
ON CONFLICT (policy_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS core.retention_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  policy_key TEXT NOT NULL,
  rows_deleted BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','completed','failed')),
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_retention_runs_policy_started
  ON core.retention_runs(policy_key, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_privacy_requests_retention
  ON core.privacy_requests(completed_at, legal_hold)
  WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_security_incidents_retention
  ON core.security_incidents(closed_at, legal_hold)
  WHERE closed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_moderation_actions_retention
  ON core.user_moderation_actions(created_at);

CREATE INDEX IF NOT EXISTS idx_governance_audit_retention
  ON core.governance_audit_events(created_at);

COMMIT;
