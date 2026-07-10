CREATE TABLE IF NOT EXISTS crm_requirement_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,
  source_id TEXT NULL,
  requester_user_id UUID NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'needs_review', 'ready_to_match', 'matching', 'connected', 'closed', 'invalid')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to UUID NULL,
  original_text_snapshot TEXT NULL,
  original_metadata_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  admin_summary TEXT NULL,
  risk_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_requirement_reviews_source_unique
  ON crm_requirement_reviews(source_type, source_id)
  WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_requirement_reviews_status_updated
  ON crm_requirement_reviews(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_requirement_reviews_assignee_status
  ON crm_requirement_reviews(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_crm_requirement_reviews_requester
  ON crm_requirement_reviews(requester_user_id);

CREATE TABLE IF NOT EXISTS crm_requirement_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_review_id UUID NOT NULL REFERENCES crm_requirement_reviews(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL
    CHECK (source_type IN ('ai', 'rule', 'admin_correction')),
  model_provider TEXT NULL,
  model_name TEXT NULL,
  prompt_version TEXT NULL,
  schema_version TEXT NOT NULL,
  extracted_data JSONB NOT NULL,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0
    CHECK (confidence >= 0 AND confidence <= 1),
  missing_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_requirement_extractions_review_created
  ON crm_requirement_extractions(requirement_review_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_requirement_extractions_schema
  ON crm_requirement_extractions(schema_version);
CREATE INDEX IF NOT EXISTS idx_crm_requirement_extractions_data_gin
  ON crm_requirement_extractions USING GIN (extracted_data);

CREATE TABLE IF NOT EXISTS crm_matching_weight_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_key TEXT NOT NULL UNIQUE,
  weights JSONB NOT NULL,
  policy_notes TEXT NULL,
  active BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_matching_weight_versions_active
  ON crm_matching_weight_versions(active, created_at DESC);

INSERT INTO crm_matching_weight_versions (
  version_key,
  weights,
  policy_notes,
  active
)
VALUES (
  'lajukan-match-score-v1',
  '{
    "keyword_category_fit": 25,
    "need_item_fit": 20,
    "location_fit": 15,
    "price_budget_fit": 10,
    "trust_verification": 10,
    "availability_response": 10,
    "listing_quality": 5,
    "freshness": 5,
    "risk_penalty_max": -15
  }'::jsonb,
  'Initial deterministic scoring weights for admin-reviewed internal matching.',
  true
)
ON CONFLICT (version_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS crm_matching_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_review_id UUID NOT NULL REFERENCES crm_requirement_reviews(id) ON DELETE CASCADE,
  extraction_id UUID NULL REFERENCES crm_requirement_extractions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'extracted', 'retrieved', 'scored', 'needs_admin_review', 'approved', 'connected', 'no_match', 'failed')),
  scoring_version TEXT NOT NULL DEFAULT 'lajukan-match-score-v1',
  retrieval_strategy TEXT NOT NULL DEFAULT 'postgres',
  candidate_count INT NOT NULL DEFAULT 0 CHECK (candidate_count >= 0),
  top_score NUMERIC(6,2) NULL CHECK (top_score IS NULL OR (top_score >= 0 AND top_score <= 100)),
  error_code TEXT NULL,
  error_message_internal TEXT NULL,
  idempotency_key TEXT NULL,
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_matching_runs_idempotency
  ON crm_matching_runs(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_matching_runs_review_created
  ON crm_matching_runs(requirement_review_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_matching_runs_status_created
  ON crm_matching_runs(status, created_at DESC);

CREATE TABLE IF NOT EXISTS crm_matching_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matching_run_id UUID NOT NULL REFERENCES crm_matching_runs(id) ON DELETE CASCADE,
  candidate_type TEXT NOT NULL
    CHECK (candidate_type IN ('content_item', 'umkm_store', 'umkm_product', 'business_profile', 'manual')),
  candidate_id TEXT NOT NULL,
  provider_user_id UUID NULL,
  provider_business_id UUID NULL,
  rank INT NOT NULL CHECK (rank > 0),
  score_total NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (score_total >= 0 AND score_total <= 100),
  score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  matched_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  verification_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  location_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  admin_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (admin_status IN ('pending', 'approved', 'rejected', 'held')),
  admin_reason TEXT NULL,
  reviewed_by UUID NULL,
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_matching_candidates_run_rank
  ON crm_matching_candidates(matching_run_id, rank);
CREATE INDEX IF NOT EXISTS idx_crm_matching_candidates_entity
  ON crm_matching_candidates(candidate_type, candidate_id);
CREATE INDEX IF NOT EXISTS idx_crm_matching_candidates_admin_status
  ON crm_matching_candidates(admin_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_matching_candidates_provider
  ON crm_matching_candidates(provider_user_id, provider_business_id);

CREATE TABLE IF NOT EXISTS crm_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_review_id UUID NOT NULL REFERENCES crm_requirement_reviews(id) ON DELETE CASCADE,
  matching_run_id UUID NULL REFERENCES crm_matching_runs(id) ON DELETE SET NULL,
  matching_candidate_id UUID NULL REFERENCES crm_matching_candidates(id) ON DELETE SET NULL,
  requester_user_id UUID NULL,
  provider_user_id UUID NULL,
  provider_business_id UUID NULL,
  provider_entity_type TEXT NOT NULL,
  provider_entity_id TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'manual'
    CHECK (channel IN ('lajukan_chat', 'whatsapp', 'phone', 'manual')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'opened', 'contacted', 'responded', 'negotiating', 'succeeded', 'failed', 'spam_or_invalid')),
  outcome_reason TEXT NULL,
  notes TEXT NULL,
  idempotency_key TEXT NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_connections_idempotency
  ON crm_connections(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_connections_requirement_created
  ON crm_connections(requirement_review_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_connections_provider_status
  ON crm_connections(provider_user_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_connections_requester_status
  ON crm_connections(requester_user_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_connections_status_updated
  ON crm_connections(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS crm_matching_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NULL REFERENCES crm_connections(id) ON DELETE SET NULL,
  matching_candidate_id UUID NULL REFERENCES crm_matching_candidates(id) ON DELETE SET NULL,
  requirement_review_id UUID NULL REFERENCES crm_requirement_reviews(id) ON DELETE SET NULL,
  feedback_source TEXT NOT NULL
    CHECK (feedback_source IN ('admin', 'requester', 'provider', 'system')),
  feedback_type TEXT NOT NULL
    CHECK (feedback_type IN ('approved', 'rejected', 'contacted', 'responded', 'succeeded', 'failed', 'corrected_extraction')),
  reason_code TEXT NULL,
  note TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_matching_feedback_connection_created
  ON crm_matching_feedback(connection_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_matching_feedback_candidate_created
  ON crm_matching_feedback(matching_candidate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_matching_feedback_requirement_created
  ON crm_matching_feedback(requirement_review_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_matching_feedback_type_created
  ON crm_matching_feedback(feedback_type, created_at DESC);

CREATE TABLE IF NOT EXISTS crm_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_user_id UUID NULL,
  actor_role TEXT NULL,
  before JSONB NULL,
  after JSONB NULL,
  reason TEXT NULL,
  request_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_audit_logs_entity_created
  ON crm_audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_audit_logs_actor_created
  ON crm_audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_audit_logs_action_created
  ON crm_audit_logs(action, created_at DESC);
