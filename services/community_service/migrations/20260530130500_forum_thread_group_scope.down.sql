DROP INDEX IF EXISTS lajukan_forum_threads_group_idx;
ALTER TABLE lajukan_forum_threads DROP COLUMN IF EXISTS group_id;
DELETE FROM lajukan_forum_categories
WHERE id = 'c-fyp'
  AND slug = 'fyp';