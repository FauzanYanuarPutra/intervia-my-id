CREATE TABLE IF NOT EXISTS events.event_log (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_user_id UUID NULL,
  anonymous_id TEXT NULL,
  session_id TEXT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  locale TEXT NULL,
  source TEXT NOT NULL DEFAULT 'web',
  page TEXT NULL,
  entity_type TEXT NULL,
  entity_id TEXT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_log_event_name_not_empty CHECK (length(trim(event_name)) > 0),
  CONSTRAINT event_log_properties_object CHECK (jsonb_typeof(properties) = 'object'),
  CONSTRAINT event_log_context_object CHECK (jsonb_typeof(context) = 'object')
);
CREATE INDEX IF NOT EXISTS idx_event_log_name_time ON event_log(event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_log_actor_time ON event_log(actor_user_id, occurred_at DESC)
WHERE actor_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_log_anonymous_time ON event_log(anonymous_id, occurred_at DESC)
WHERE anonymous_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_log_session_time ON event_log(session_id, occurred_at DESC)
WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_log_entity_time ON event_log(entity_type, entity_id, occurred_at DESC)
WHERE entity_type IS NOT NULL
  AND entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_log_properties_gin ON events.event_log USING GIN (properties);
CREATE TABLE IF NOT EXISTS events.ai_decision_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_type TEXT NOT NULL,
  actor_user_id UUID NULL,
  entity_type TEXT NULL,
  entity_id TEXT NULL,
  model_version TEXT NOT NULL DEFAULT 'manual-v0',
  policy_version TEXT NOT NULL DEFAULT 'policy-v0',
  score NUMERIC(8, 5) NULL,
  recommendation TEXT NULL,
  reason_codes TEXT [] NOT NULL DEFAULT ARRAY []::TEXT [],
  input_ref JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  guardrail_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_decision_log_input_object CHECK (jsonb_typeof(input_ref) = 'object'),
  CONSTRAINT ai_decision_log_output_object CHECK (jsonb_typeof(output) = 'object'),
  CONSTRAINT ai_decision_log_guardrail_object CHECK (jsonb_typeof(guardrail_result) = 'object')
);
CREATE INDEX IF NOT EXISTS idx_ai_decision_log_type_time ON ai_decision_log(decision_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_decision_log_entity_time ON ai_decision_log(entity_type, entity_id, created_at DESC)
WHERE entity_type IS NOT NULL
  AND entity_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS fraud_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_type TEXT NOT NULL,
  actor_user_id UUID NULL,
  entity_type TEXT NULL,
  entity_id TEXT NULL,
  risk_score INT NULL CHECK (
    risk_score IS NULL
    OR (
      risk_score >= 0
      AND risk_score <= 100
    )
  ),
  severity TEXT NOT NULL DEFAULT 'info',
  reason_codes TEXT [] NOT NULL DEFAULT ARRAY []::TEXT [],
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ NULL,
  reviewed_by UUID NULL,
  CONSTRAINT fraud_signals_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);
CREATE INDEX IF NOT EXISTS idx_fraud_signals_status_time ON fraud_signals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_signals_actor_time ON fraud_signals(actor_user_id, created_at DESC)
WHERE actor_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fraud_signals_entity_time ON fraud_signals(entity_type, entity_id, created_at DESC)
WHERE entity_type IS NOT NULL
  AND entity_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS automation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_key TEXT NOT NULL,
  dedupe_key TEXT NULL,
  trigger_event_id UUID NULL REFERENCES event_log(event_id) ON DELETE
  SET NULL,
    actor_user_id UUID NULL,
    entity_type TEXT NULL,
    entity_id TEXT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempt_count INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_at TIMESTAMPTZ NULL,
    locked_by TEXT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_error TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT automation_jobs_payload_object CHECK (jsonb_typeof(payload) = 'object')
);
ALTER TABLE automation_jobs
ADD COLUMN IF NOT EXISTS dedupe_key TEXT NULL;
CREATE INDEX IF NOT EXISTS idx_automation_jobs_pending ON automation_jobs(status, run_after, created_at)
WHERE status IN ('pending', 'retry');
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_jobs_dedupe_open ON automation_jobs(dedupe_key)
WHERE dedupe_key IS NOT NULL
  AND status IN ('pending', 'retry', 'running');
CREATE INDEX IF NOT EXISTS idx_automation_jobs_entity_time ON automation_jobs(entity_type, entity_id, created_at DESC)
WHERE entity_type IS NOT NULL
  AND entity_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS recommendation_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NULL REFERENCES event_log(event_id) ON DELETE
  SET NULL,
    actor_user_id UUID NULL,
    anonymous_id TEXT NULL,
    surface TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    rank_position INT NULL,
    strategy TEXT NOT NULL DEFAULT 'baseline',
    model_version TEXT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT recommendation_impressions_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);
CREATE INDEX IF NOT EXISTS idx_recommendation_impressions_surface_time ON recommendation_impressions(surface, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendation_impressions_actor_time ON recommendation_impressions(actor_user_id, created_at DESC)
WHERE actor_user_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS recommendation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  impression_id UUID NULL REFERENCES recommendation_impressions(id) ON DELETE
  SET NULL,
    event_id UUID NULL REFERENCES event_log(event_id) ON DELETE
  SET NULL,
    actor_user_id UUID NULL,
    anonymous_id TEXT NULL,
    feedback_type TEXT NOT NULL,
    surface TEXT NULL,
    entity_type TEXT NULL,
    entity_id TEXT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT recommendation_feedback_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);
CREATE INDEX IF NOT EXISTS idx_recommendation_feedback_entity_time ON recommendation_feedback(entity_type, entity_id, created_at DESC)
WHERE entity_type IS NOT NULL
  AND entity_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS user_feature_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NULL,
  anonymous_id TEXT NULL,
  lifecycle_stage TEXT NOT NULL DEFAULT 'anonymous',
  intent_tags TEXT [] NOT NULL DEFAULT ARRAY []::TEXT [],
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_count_30d INT NOT NULL DEFAULT 0,
  search_count_7d INT NOT NULL DEFAULT 0,
  chat_count_7d INT NOT NULL DEFAULT 0,
  transaction_count_30d INT NOT NULL DEFAULT 0,
  risk_score INT NOT NULL DEFAULT 0 CHECK (
    risk_score >= 0
    AND risk_score <= 100
  ),
  retention_score INT NOT NULL DEFAULT 0 CHECK (
    retention_score >= 0
    AND retention_score <= 100
  ),
  feature_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_feature_identity_present CHECK (
    actor_user_id IS NOT NULL
    OR anonymous_id IS NOT NULL
  ),
  CONSTRAINT user_feature_snapshot_json_object CHECK (jsonb_typeof(feature_json) = 'object')
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_feature_snapshots_user ON user_feature_snapshots(actor_user_id)
WHERE actor_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_feature_snapshots_anonymous ON user_feature_snapshots(anonymous_id)
WHERE actor_user_id IS NULL
  AND anonymous_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS entity_feature_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  trust_score INT NOT NULL DEFAULT 50 CHECK (
    trust_score >= 0
    AND trust_score <= 100
  ),
  response_speed_score INT NOT NULL DEFAULT 50 CHECK (
    response_speed_score >= 0
    AND response_speed_score <= 100
  ),
  conversion_score INT NOT NULL DEFAULT 50 CHECK (
    conversion_score >= 0
    AND conversion_score <= 100
  ),
  freshness_score INT NOT NULL DEFAULT 50 CHECK (
    freshness_score >= 0
    AND freshness_score <= 100
  ),
  risk_score INT NOT NULL DEFAULT 0 CHECK (
    risk_score >= 0
    AND risk_score <= 100
  ),
  feature_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT entity_feature_snapshot_json_object CHECK (jsonb_typeof(feature_json) = 'object'),
  UNIQUE (entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_entity_feature_snapshots_type_score ON entity_feature_snapshots(
  entity_type,
  trust_score DESC,
  conversion_score DESC
);
CREATE TABLE IF NOT EXISTS fraud_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_type TEXT NOT NULL,
  actor_user_id UUID NULL,
  entity_type TEXT NULL,
  entity_id TEXT NULL,
  risk_score INT NOT NULL DEFAULT 0 CHECK (
    risk_score >= 0
    AND risk_score <= 100
  ),
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  reason_codes TEXT [] NOT NULL DEFAULT ARRAY []::TEXT [],
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ NULL,
  resolved_by UUID NULL,
  CONSTRAINT fraud_cases_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);
CREATE INDEX IF NOT EXISTS idx_fraud_cases_status_time ON fraud_cases(status, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_cases_entity_time ON fraud_cases(entity_type, entity_id, opened_at DESC)
WHERE entity_type IS NOT NULL
  AND entity_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS experiment_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_key TEXT NOT NULL,
  variant_key TEXT NOT NULL,
  actor_user_id UUID NULL,
  anonymous_id TEXT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT experiment_assignment_identity_present CHECK (
    actor_user_id IS NOT NULL
    OR anonymous_id IS NOT NULL
  ),
  CONSTRAINT experiment_assignment_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_experiment_assignments_identity ON experiment_assignments(
  experiment_key,
  COALESCE(actor_user_id::TEXT, ''),
  COALESCE(anonymous_id, '')
);