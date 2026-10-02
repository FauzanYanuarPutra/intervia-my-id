DROP INDEX IF EXISTS idx_lajukan_groups_facebook_group_url;

ALTER TABLE forum.lajukan_groups
  DROP CONSTRAINT IF EXISTS lajukan_groups_facebook_group_url_check;

ALTER TABLE forum.lajukan_groups
  DROP COLUMN IF EXISTS facebook_group_url;
