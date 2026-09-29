SET search_path = forum, reel, public, events;

-- Grant the Lajukan admin account group-admin ownership on the three official
-- topic groups requested by the platform operator. The operation is idempotent:
-- an existing membership is promoted/reactivated, while a missing membership
-- is created. No other groups or users are modified.
WITH target_user AS (
  SELECT id
  FROM forum.lajukan_forum_users
  WHERE deleted_at IS NULL
    AND (
      lower(COALESCE(metadata ->> 'email', '')) = 'lajukan001@gmail.com'
      OR lower(username) = 'lajukan001@gmail.com'
      OR lower(username) = 'lajukan001'
    )
  ORDER BY
    CASE
      WHEN lower(COALESCE(metadata ->> 'email', '')) = 'lajukan001@gmail.com' THEN 0
      WHEN lower(username) = 'lajukan001@gmail.com' THEN 1
      ELSE 2
    END,
    created_at ASC
  LIMIT 1
),
target_groups AS (
  SELECT id
  FROM forum.lajukan_groups
  WHERE status = 'active'
    AND slug IN (
      'marketing-growth',
      'operasional-usaha',
      'supplier-sourcing'
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
FROM target_groups g
CROSS JOIN target_user u
ON CONFLICT (group_id, user_id) DO UPDATE
SET role = 'owner',
    status = 'active',
    updated_at = now();
