DROP TRIGGER IF EXISTS crm_notifications_updated_at
  ON internal_moderation.crm_notifications;
DROP TRIGGER IF EXISTS business_verifications_updated_at
  ON internal_moderation.business_verifications;
DROP TRIGGER IF EXISTS business_appeals_updated_at
  ON internal_moderation.business_appeals;
DROP TRIGGER IF EXISTS business_reports_updated_at
  ON internal_moderation.business_reports;
DROP TRIGGER IF EXISTS business_moderation_events_immutable
  ON internal_moderation.business_moderation_events;
DROP TRIGGER IF EXISTS business_moderation_cases_updated_at
  ON internal_moderation.business_moderation_cases;

DROP INDEX IF EXISTS internal_moderation.idx_crm_notifications_business;
DROP INDEX IF EXISTS internal_moderation.idx_crm_notifications_queue;
DROP INDEX IF EXISTS internal_moderation.idx_business_moderation_evidence_case;
DROP INDEX IF EXISTS internal_moderation.idx_business_verification_queue;
DROP INDEX IF EXISTS internal_moderation.idx_business_appeals_queue;
DROP INDEX IF EXISTS internal_moderation.uq_business_appeal_pending;
DROP INDEX IF EXISTS internal_moderation.idx_business_reports_business;
DROP INDEX IF EXISTS internal_moderation.idx_business_reports_queue;
DROP INDEX IF EXISTS internal_moderation.uq_business_reporter_active;
DROP INDEX IF EXISTS internal_moderation.idx_business_moderation_due;

DROP TABLE IF EXISTS internal_moderation.crm_notifications;
DROP TABLE IF EXISTS internal_moderation.business_moderation_evidence;
DROP TABLE IF EXISTS internal_moderation.business_verifications;
DROP TABLE IF EXISTS internal_moderation.business_appeals;
DROP TABLE IF EXISTS internal_moderation.business_reports;

ALTER TABLE internal_moderation.business_moderation_cases
  DROP COLUMN IF EXISTS due_at;

DROP TABLE IF EXISTS internal_moderation.business_moderation_events;
DROP TABLE IF EXISTS internal_moderation.business_moderation_cases;
