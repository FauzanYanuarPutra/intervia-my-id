DROP INDEX IF EXISTS forum.idx_lajukan_groups_whatsapp_join_url;
ALTER TABLE forum.lajukan_groups DROP CONSTRAINT IF EXISTS lajukan_groups_whatsapp_join_url_check;
ALTER TABLE forum.lajukan_groups DROP COLUMN IF EXISTS whatsapp_join_url;