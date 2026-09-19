BEGIN;
DROP TABLE IF EXISTS core.security_incidents;
DROP TABLE IF EXISTS core.privacy_requests;
DROP FUNCTION IF EXISTS core.touch_governance_timestamp();
COMMIT;