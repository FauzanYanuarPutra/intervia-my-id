BEGIN;

CREATE SCHEMA IF NOT EXISTS internal_moderation;
REVOKE ALL ON SCHEMA internal_moderation FROM PUBLIC;

CREATE TABLE IF NOT EXISTS internal_moderation.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE RESTRICT,
  reporter_user_id UUID NOT NULL,
  reason_code TEXT NOT NULL CHECK (reason_code IN (
    'spam',
    'fraud_misleading',
    'illegal',
    'harassment',
    'privacy_personal_data',
    'sexual_pornographic',
    'violence_threat',
    'copyright',
    'inaccurate',
    'other'
  )),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','reviewing','resolved','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_content_reporter_active
  ON internal_moderation.content_reports (content_id, reporter_user_id)
  WHERE status IN ('open','reviewing');

CREATE INDEX IF NOT EXISTS idx_content_reports_queue
  ON internal_moderation.content_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_reports_content
  ON internal_moderation.content_reports (content_id, created_at DESC);

CREATE TABLE IF NOT EXISTS internal_moderation.content_moderation_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE RESTRICT,
  opened_by UUID,
  assigned_to UUID,
  source TEXT NOT NULL DEFAULT 'user_report'
    CHECK (source IN ('user_report','automated','proactive','law_enforcement','system')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','reviewing','resolved','escalated','appealed')),
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low','medium','high','critical')),
  current_action TEXT,
  current_reason_code TEXT,
  current_reason_note TEXT,
  legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_moderation_cases_queue
  ON internal_moderation.content_moderation_cases (status, severity, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_moderation_cases_assignee
  ON internal_moderation.content_moderation_cases (assigned_to, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_moderation_cases_content
  ON internal_moderation.content_moderation_cases (content_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS internal_moderation.content_moderation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES internal_moderation.content_moderation_cases(id) ON DELETE RESTRICT,
  actor_id UUID,
  action TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  reason_note TEXT,
  severity TEXT NOT NULL
    CHECK (severity IN ('low','medium','high','critical')),
  previous_status TEXT,
  new_status TEXT,
  content_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moderation_events_case
  ON internal_moderation.content_moderation_events (case_id, created_at DESC);

CREATE TABLE IF NOT EXISTS internal_moderation.content_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES internal_moderation.content_moderation_cases(id) ON DELETE RESTRICT,
  appellant_user_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_review','upheld','overturned','needs_information')),
  reviewer_id UUID,
  reviewer_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_content_appeal_pending
  ON internal_moderation.content_appeals (case_id, appellant_user_id)
  WHERE status IN ('pending','in_review');

CREATE INDEX IF NOT EXISTS idx_content_appeals_queue
  ON internal_moderation.content_appeals (status, created_at DESC);

CREATE OR REPLACE FUNCTION internal_moderation.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS content_reports_updated_at
  ON internal_moderation.content_reports;
CREATE TRIGGER content_reports_updated_at
BEFORE UPDATE ON internal_moderation.content_reports
FOR EACH ROW EXECUTE FUNCTION internal_moderation.touch_updated_at();

DROP TRIGGER IF EXISTS content_cases_updated_at
  ON internal_moderation.content_moderation_cases;
CREATE TRIGGER content_cases_updated_at
BEFORE UPDATE ON internal_moderation.content_moderation_cases
FOR EACH ROW EXECUTE FUNCTION internal_moderation.touch_updated_at();

DROP TRIGGER IF EXISTS content_appeals_updated_at
  ON internal_moderation.content_appeals;
CREATE TRIGGER content_appeals_updated_at
BEFORE UPDATE ON internal_moderation.content_appeals
FOR EACH ROW EXECUTE FUNCTION internal_moderation.touch_updated_at();

CREATE OR REPLACE FUNCTION internal_moderation.prevent_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'moderation evidence is append-only';
END;
$$;

DROP TRIGGER IF EXISTS content_moderation_events_immutable
  ON internal_moderation.content_moderation_events;
CREATE TRIGGER content_moderation_events_immutable
BEFORE UPDATE OR DELETE ON internal_moderation.content_moderation_events
FOR EACH ROW EXECUTE FUNCTION internal_moderation.prevent_event_mutation();

REVOKE ALL ON ALL TABLES IN SCHEMA internal_moderation FROM PUBLIC;

COMMIT;
