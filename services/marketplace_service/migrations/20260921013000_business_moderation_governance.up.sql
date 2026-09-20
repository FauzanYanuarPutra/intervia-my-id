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
