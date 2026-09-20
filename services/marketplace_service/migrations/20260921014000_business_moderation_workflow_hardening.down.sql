ALTER TABLE internal_moderation.business_moderation_cases
  DROP CONSTRAINT IF EXISTS business_moderation_cases_status_check;

ALTER TABLE internal_moderation.business_moderation_cases
  ADD CONSTRAINT business_moderation_cases_status_check
  CHECK (status IN ('open','reviewing','awaiting_owner','resolved','escalated'));

DROP INDEX IF EXISTS internal_moderation.idx_business_appeals_case;
DROP INDEX IF EXISTS internal_moderation.idx_business_moderation_cases_sla;

ALTER TABLE internal_moderation.business_appeals
  DROP COLUMN IF EXISTS submitted_by_ip,
  DROP COLUMN IF EXISTS submitted_user_agent;
