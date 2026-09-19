BEGIN;

DROP INDEX IF EXISTS uq_privacy_requests_one_active_per_type;

INSERT INTO core.retention_policies (policy_key, description, retention_days, enabled)
VALUES ('governance_audit_events', 'Governance audit history', 2555, TRUE)
ON CONFLICT (policy_key) DO NOTHING;

COMMIT;
