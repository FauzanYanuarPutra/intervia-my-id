BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_privacy_requests_one_active_per_type
  ON core.privacy_requests(subject_user_id, request_type)
  WHERE status IN ('open','in_review','waiting_user');

DELETE FROM core.retention_policies
WHERE policy_key = 'governance_audit_events';

COMMIT;
