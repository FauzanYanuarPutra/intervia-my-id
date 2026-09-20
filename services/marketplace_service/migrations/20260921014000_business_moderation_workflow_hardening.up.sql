ALTER TABLE internal_moderation.business_moderation_cases
  DROP CONSTRAINT IF EXISTS business_moderation_cases_status_check;

ALTER TABLE internal_moderation.business_moderation_cases
  ADD CONSTRAINT business_moderation_cases_status_check
  CHECK (status IN ('open','reviewing','awaiting_owner','resolved','escalated','appealed'));

ALTER TABLE internal_moderation.business_appeals
  ADD COLUMN IF NOT EXISTS submitted_by_ip INET,
  ADD COLUMN IF NOT EXISTS submitted_user_agent TEXT;

CREATE INDEX IF NOT EXISTS idx_business_appeals_case
  ON internal_moderation.business_appeals (case_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_moderation_cases_sla
  ON internal_moderation.business_moderation_cases (status, due_at)
  WHERE due_at IS NOT NULL;
