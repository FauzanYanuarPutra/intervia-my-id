BEGIN;

CREATE TABLE IF NOT EXISTS internal_moderation.business_moderation_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES umkm_stores(id) ON DELETE RESTRICT,
  owner_user_id UUID NOT NULL,
  opened_by UUID,
  assigned_to UUID,
  source TEXT NOT NULL DEFAULT 'proactive'
    CHECK (source IN ('proactive','user_report','automated','system')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','reviewing','awaiting_owner','resolved','escalated')),
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low','medium','high','critical')),
  current_action TEXT,
  current_reason_code TEXT,
  current_reason_note TEXT,
  missing_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_business_moderation_queue
  ON internal_moderation.business_moderation_cases (status, severity, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_moderation_business
  ON internal_moderation.business_moderation_cases (business_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_moderation_owner
  ON internal_moderation.business_moderation_cases (owner_user_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS internal_moderation.business_moderation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES internal_moderation.business_moderation_cases(id) ON DELETE RESTRICT,
  actor_id UUID,
  action TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  reason_note TEXT,
  severity TEXT NOT NULL
    CHECK (severity IN ('low','medium','high','critical')),
  previous_status TEXT,
  new_status TEXT,
  missing_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  business_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_moderation_events_case
  ON internal_moderation.business_moderation_events (case_id, created_at DESC);

CREATE OR REPLACE FUNCTION internal_moderation.business_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_moderation_cases_updated_at
  ON internal_moderation.business_moderation_cases;
CREATE TRIGGER business_moderation_cases_updated_at
BEFORE UPDATE ON internal_moderation.business_moderation_cases
FOR EACH ROW EXECUTE FUNCTION internal_moderation.business_touch_updated_at();

CREATE OR REPLACE FUNCTION internal_moderation.prevent_business_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'business moderation evidence is append-only';
END;
$$;

DROP TRIGGER IF EXISTS business_moderation_events_immutable
  ON internal_moderation.business_moderation_events;
CREATE TRIGGER business_moderation_events_immutable
BEFORE UPDATE OR DELETE ON internal_moderation.business_moderation_events
FOR EACH ROW EXECUTE FUNCTION internal_moderation.prevent_business_event_mutation();

REVOKE ALL ON TABLE
  internal_moderation.business_moderation_cases,
  internal_moderation.business_moderation_events
FROM PUBLIC;

COMMIT;

ALTER TABLE internal_moderation.business_moderation_cases
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_business_moderation_due
  ON internal_moderation.business_moderation_cases (due_at, status)
  WHERE due_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS internal_moderation.business_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES umkm_stores(id) ON DELETE RESTRICT,
  reporter_user_id UUID NOT NULL,
  reason_code TEXT NOT NULL
    CHECK (reason_code IN (
      'inaccurate_information',
      'not_found',
      'duplicate_business',
      'fraud_misleading',
      'policy_violation',
      'privacy_personal_data',
      'copyright',
      'other'
    )),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','reviewing','resolved','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_reporter_active
  ON internal_moderation.business_reports (business_id, reporter_user_id)
  WHERE status IN ('open','reviewing');

CREATE INDEX IF NOT EXISTS idx_business_reports_queue
  ON internal_moderation.business_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_reports_business
  ON internal_moderation.business_reports (business_id, created_at DESC);

CREATE TABLE IF NOT EXISTS internal_moderation.business_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES internal_moderation.business_moderation_cases(id) ON DELETE RESTRICT,
  business_id UUID NOT NULL REFERENCES umkm_stores(id) ON DELETE RESTRICT,
  appellant_user_id UUID NOT NULL,
  reason TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_review','upheld','overturned','needs_information')),
  reviewer_id UUID NULL,
  reviewer_note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_appeal_pending
  ON internal_moderation.business_appeals (case_id, appellant_user_id)
  WHERE status IN ('pending','in_review');

CREATE INDEX IF NOT EXISTS idx_business_appeals_queue
  ON internal_moderation.business_appeals (status, created_at DESC);

CREATE TABLE IF NOT EXISTS internal_moderation.business_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES umkm_stores(id) ON DELETE RESTRICT,
  owner_user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (status IN ('unverified','pending','verified','rejected')),
  method TEXT NULL
    CHECK (method IS NULL OR method IN ('owner_claim','manual','document','reference')),
  requested_at TIMESTAMPTZ NULL,
  reviewed_at TIMESTAMPTZ NULL,
  reviewed_by UUID NULL,
  review_reason TEXT NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_verification_active
  ON internal_moderation.business_verifications (business_id)
  WHERE status IN ('unverified','pending','verified');

CREATE INDEX IF NOT EXISTS idx_business_verification_queue
  ON internal_moderation.business_verifications (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS internal_moderation.business_moderation_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES internal_moderation.business_moderation_cases(id) ON DELETE RESTRICT,
  added_by UUID NOT NULL,
  evidence_type TEXT NOT NULL
    CHECK (evidence_type IN ('photo','document','url','note','screenshot','other')),
  label TEXT NOT NULL,
  source_url TEXT NULL,
  note TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_moderation_evidence_case
  ON internal_moderation.business_moderation_evidence (case_id, created_at DESC);

CREATE TABLE IF NOT EXISTS internal_moderation.crm_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL DEFAULT 'business',
  event_type TEXT NOT NULL,
  business_id UUID NULL REFERENCES umkm_stores(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_by UUID NULL,
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_notifications_queue
  ON internal_moderation.crm_notifications (is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_notifications_business
  ON internal_moderation.crm_notifications (business_id, created_at DESC);

DROP TRIGGER IF EXISTS business_reports_updated_at
  ON internal_moderation.business_reports;
CREATE TRIGGER business_reports_updated_at
BEFORE UPDATE ON internal_moderation.business_reports
FOR EACH ROW EXECUTE FUNCTION internal_moderation.business_touch_updated_at();

DROP TRIGGER IF EXISTS business_appeals_updated_at
  ON internal_moderation.business_appeals;
CREATE TRIGGER business_appeals_updated_at
BEFORE UPDATE ON internal_moderation.business_appeals
FOR EACH ROW EXECUTE FUNCTION internal_moderation.business_touch_updated_at();

DROP TRIGGER IF EXISTS business_verifications_updated_at
  ON internal_moderation.business_verifications;
CREATE TRIGGER business_verifications_updated_at
BEFORE UPDATE ON internal_moderation.business_verifications
FOR EACH ROW EXECUTE FUNCTION internal_moderation.business_touch_updated_at();

DROP TRIGGER IF EXISTS crm_notifications_updated_at
  ON internal_moderation.crm_notifications;
CREATE TRIGGER crm_notifications_updated_at
BEFORE UPDATE ON internal_moderation.crm_notifications
FOR EACH ROW EXECUTE FUNCTION internal_moderation.business_touch_updated_at();

REVOKE ALL ON TABLE
  internal_moderation.business_reports,
  internal_moderation.business_appeals,
  internal_moderation.business_verifications,
  internal_moderation.business_moderation_evidence,
  internal_moderation.crm_notifications
FROM PUBLIC;
