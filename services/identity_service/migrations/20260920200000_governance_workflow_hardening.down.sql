BEGIN;

DROP TRIGGER IF EXISTS governance_audit_events_no_update ON core.governance_audit_events;
DROP FUNCTION IF EXISTS core.prevent_governance_audit_mutation();
DROP INDEX IF EXISTS idx_privacy_requests_due_queue;
DROP INDEX IF EXISTS idx_governance_audit_entity;
DROP TABLE IF EXISTS core.governance_audit_events;

ALTER TABLE core.security_incidents
  DROP COLUMN IF EXISTS last_actor_user_id,
  DROP COLUMN IF EXISTS closed_at,
  DROP COLUMN IF EXISTS remediated_at,
  DROP COLUMN IF EXISTS containment_at;

ALTER TABLE core.privacy_requests
  DROP COLUMN IF EXISTS last_actor_user_id,
  DROP COLUMN IF EXISTS verification_expires_at,
  DROP COLUMN IF EXISTS verified_at,
  DROP COLUMN IF EXISTS verification_required,
  DROP COLUMN IF EXISTS subject_note;

COMMIT;
