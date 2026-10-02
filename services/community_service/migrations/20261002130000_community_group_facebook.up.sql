ALTER TABLE forum.lajukan_groups
  ADD COLUMN IF NOT EXISTS facebook_group_url TEXT;

ALTER TABLE forum.lajukan_groups
  DROP CONSTRAINT IF EXISTS lajukan_groups_facebook_group_url_check;

ALTER TABLE forum.lajukan_groups
  ADD CONSTRAINT lajukan_groups_facebook_group_url_check
  CHECK (
    facebook_group_url IS NULL
    OR facebook_group_url ~ '^https://(www\\.)?facebook\\.com/'
  );

CREATE INDEX IF NOT EXISTS idx_lajukan_groups_facebook_group_url
  ON forum.lajukan_groups (facebook_group_url)
  WHERE facebook_group_url IS NOT NULL;

-- Keep the external Facebook community link attached to groups that already
-- expose an external WhatsApp join path. The value remains editable per group
-- from group management.
UPDATE forum.lajukan_groups
SET facebook_group_url = 'https://www.facebook.com/share/g/1JiSbWVqtG/'
WHERE status = 'active'
  AND whatsapp_join_url IS NOT NULL
  AND facebook_group_url IS NULL;
