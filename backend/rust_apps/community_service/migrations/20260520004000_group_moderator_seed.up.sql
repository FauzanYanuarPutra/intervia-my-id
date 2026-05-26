WITH ranked_members AS (
  SELECT
    gm.group_id,
    gm.user_id,
    row_number() OVER (
      PARTITION BY gm.group_id
      ORDER BY u.reputation DESC, gm.joined_at ASC, gm.user_id ASC
    ) AS member_rank
  FROM lajukan_group_members gm
  JOIN lajukan_forum_users u ON u.id = gm.user_id
  WHERE gm.status = 'active'
    AND gm.role = 'member'
)
UPDATE lajukan_group_members gm
SET role = 'moderator',
    updated_at = now()
FROM ranked_members ranked
WHERE gm.group_id = ranked.group_id
  AND gm.user_id = ranked.user_id
  AND ranked.member_rank = 1
  AND NOT EXISTS (
    SELECT 1
    FROM lajukan_group_members existing
    WHERE existing.group_id = gm.group_id
      AND existing.role = 'moderator'
      AND existing.status = 'active'
  );
