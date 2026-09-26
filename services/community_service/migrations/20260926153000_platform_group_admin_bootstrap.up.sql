SET search_path = forum, reel, public, events;

-- Grant the configured official Lajukan community admin account access to every
-- active group that already exists. The operation is idempotent and only
-- promotes matching forum identities; it does not create fictional users.
WITH target_users AS (
  SELECT id
  FROM forum.lajukan_forum_users
  WHERE deleted_at IS NULL
    AND (
      lower(username) IN ('lajukan001', 'lajukan001@gmail.com')
      OR lower(COALESCE(metadata ->> 'email', '')) = 'lajukan001@gmail.com'
    )
)
INSERT INTO forum.lajukan_group_members (
  group_id,
  user_id,
  role,
  status,
  joined_at,
  updated_at
)
SELECT
  g.id,
  u.id,
  'owner',
  'active',
  now(),
  now()
FROM forum.lajukan_groups g
CROSS JOIN target_users u
WHERE g.status = 'active'
ON CONFLICT (group_id, user_id) DO UPDATE
SET role = 'owner',
    status = 'active',
    updated_at = now();
