CREATE TABLE IF NOT EXISTS internal_moderation.crm_notification_reads (
  notification_id UUID NOT NULL REFERENCES internal_moderation.crm_notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_notification_reads_user
  ON internal_moderation.crm_notification_reads (user_id, read_at DESC);

REVOKE ALL ON TABLE internal_moderation.crm_notification_reads FROM PUBLIC;
