BEGIN;

ALTER TABLE core.privacy_requests
  ADD COLUMN IF NOT EXISTS subject_note TEXT,
  ADD COLUMN IF NOT EXISTS verification_required BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_actor_user_id UUID REFERENCES core.users(id) ON DELETE SET NULL;

ALTER TABLE core.security_incidents
  ADD COLUMN IF NOT EXISTS containment_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS remediated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_actor_user_id UUID REFERENCES core.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS core.governance_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES core.users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('privacy_request','security_incident')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  previous_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  next_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_audit_entity
  ON core.governance_audit_events(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_due_queue
  ON core.privacy_requests(status, due_at)
  WHERE status IN ('open','in_review','waiting_user');

CREATE OR REPLACE FUNCTION core.prevent_governance_audit_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'governance_audit_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS governance_audit_events_no_update ON core.governance_audit_events;
CREATE TRIGGER governance_audit_events_no_update
BEFORE UPDATE OR DELETE ON core.governance_audit_events
FOR EACH ROW EXECUTE FUNCTION core.prevent_governance_audit_mutation();

COMMIT;
