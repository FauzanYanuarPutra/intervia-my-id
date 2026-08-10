UPDATE core.users u
SET status = 'active',
    is_active = TRUE,
    deleted_at = NULL,
    updated_at = NOW()
FROM core.user_profiles p
WHERE p.user_id = u.id
  AND p.metadata->>'seed_pack' = 'indonesia_demo_20260709'
  AND p.metadata->>'archived_by_seed_pack' = 'real_indonesia_open_data_20260723';

UPDATE core.user_profiles
SET metadata = metadata - 'archived_by_seed_pack' - 'archived_reason',
    updated_at = NOW()
WHERE metadata->>'seed_pack' = 'indonesia_demo_20260709'
  AND metadata->>'archived_by_seed_pack' = 'real_indonesia_open_data_20260723';
