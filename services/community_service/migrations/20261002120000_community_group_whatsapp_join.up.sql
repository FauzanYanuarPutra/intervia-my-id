ALTER TABLE forum.lajukan_groups
  ADD COLUMN IF NOT EXISTS whatsapp_join_url TEXT;

ALTER TABLE forum.lajukan_groups
  DROP CONSTRAINT IF EXISTS lajukan_groups_whatsapp_join_url_check;

ALTER TABLE forum.lajukan_groups
  ADD CONSTRAINT lajukan_groups_whatsapp_join_url_check
  CHECK (
    whatsapp_join_url IS NULL
    OR whatsapp_join_url ~ '^https://(chat\\.whatsapp\\.com/|wa\\.me/)'
  );

CREATE INDEX IF NOT EXISTS idx_lajukan_groups_whatsapp_join_url
  ON forum.lajukan_groups (whatsapp_join_url)
  WHERE whatsapp_join_url IS NOT NULL;