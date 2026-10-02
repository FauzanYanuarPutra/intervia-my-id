CREATE TABLE IF NOT EXISTS crm_smart_match_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_content_id UUID NOT NULL,
  matched_content_id UUID NOT NULL,
  recipient_user_id UUID NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('source_owner','matched_owner')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_smart_match_notifications_unique
  ON crm_smart_match_notifications(source_content_id, matched_content_id, recipient_user_id, direction);

CREATE INDEX IF NOT EXISTS idx_crm_smart_match_notifications_recipient_created
  ON crm_smart_match_notifications(recipient_user_id, created_at DESC);
