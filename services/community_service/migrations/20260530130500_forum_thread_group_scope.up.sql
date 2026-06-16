ALTER TABLE lajukan_forum_threads
ADD COLUMN IF NOT EXISTS group_id text NULL REFERENCES lajukan_groups(id) ON DELETE
SET NULL;
CREATE INDEX IF NOT EXISTS lajukan_forum_threads_group_idx ON forum.lajukan_forum_threads (group_id, last_activity_at DESC);
INSERT INTO lajukan_forum_categories (
    id,
    name,
    slug,
    description,
    icon,
    color,
    position,
    created_at,
    updated_at
  )
SELECT 'c-fyp',
  'Publik',
  'fyp',
  'Posting publik lintas komunitas dan update umum.',
  'community',
  '#10b981',
  0,
  now(),
  now()
WHERE NOT EXISTS (
    SELECT 1
    FROM lajukan_forum_categories
    WHERE id = 'c-fyp'
      OR slug = 'fyp'
  );
UPDATE forum.lajukan_forum_threads t
SET group_id = g.id
FROM lajukan_groups g
WHERE t.group_id IS NULL
  AND g.category_id = t.category_id;