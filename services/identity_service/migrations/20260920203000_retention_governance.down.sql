BEGIN;

DROP INDEX IF EXISTS idx_user_moderation_actions_retention;
DROP INDEX IF EXISTS idx_security_incidents_retention;
DROP INDEX IF EXISTS idx_privacy_requests_retention;
DROP INDEX IF EXISTS idx_governance_audit_retention;
DROP INDEX IF EXISTS idx_retention_runs_policy_started;
DROP TABLE IF EXISTS core.retention_runs;
DROP TABLE IF EXISTS core.retention_policies;
ALTER TABLE core.privacy_requests DROP COLUMN IF EXISTS legal_hold;

COMMIT;
