BEGIN;

CREATE TABLE IF NOT EXISTS core.privacy_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
  request_type TEXT NOT NULL CHECK (request_type IN ('access','correction','export','deletion','withdraw_consent','restrict','objection')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','waiting_user','completed','rejected','cancelled')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at TIMESTAMPTZ,
  assigned_to UUID REFERENCES core.users(id) ON DELETE SET NULL,
  decision_note TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_queue ON core.privacy_requests(status, due_at, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_subject ON core.privacy_requests(subject_user_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS core.security_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','contained','investigating','remediated','closed')),
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notification_due_at TIMESTAMPTZ,
  affected_data_classes TEXT[] NOT NULL DEFAULT '{}',
  affected_user_count BIGINT,
  summary TEXT NOT NULL,
  containment_note TEXT,
  remediation_note TEXT,
  subject_notification_status TEXT NOT NULL DEFAULT 'not_required' CHECK (subject_notification_status IN ('not_required','pending','sent')),
  regulator_notification_status TEXT NOT NULL DEFAULT 'not_required' CHECK (regulator_notification_status IN ('not_required','pending','sent')),
  legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
  owner_user_id UUID REFERENCES core.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_security_incidents_queue ON core.security_incidents(status, severity, discovered_at DESC);

CREATE OR REPLACE FUNCTION core.touch_governance_timestamp() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS privacy_requests_updated_at ON core.privacy_requests;
CREATE TRIGGER privacy_requests_updated_at BEFORE UPDATE ON core.privacy_requests FOR EACH ROW EXECUTE FUNCTION core.touch_governance_timestamp();
DROP TRIGGER IF EXISTS security_incidents_updated_at ON core.security_incidents;
CREATE TRIGGER security_incidents_updated_at BEFORE UPDATE ON core.security_incidents FOR EACH ROW EXECUTE FUNCTION core.touch_governance_timestamp();

COMMIT;