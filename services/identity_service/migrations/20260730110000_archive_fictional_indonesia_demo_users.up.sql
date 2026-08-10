-- The 2026-07-09 profiles are explicitly fictional local-demo identities.
-- Keep the rows for FK/history safety, but remove them from authentication and discovery.
UPDATE core.user_profiles
SET metadata = COALESCE(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'archived_by_seed_pack', 'real_indonesia_open_data_20260723',
        'archived_reason', 'Fictional demo identity hidden in favor of sourced public references.'
      ),
    updated_at = NOW()
WHERE metadata->>'seed_pack' = 'indonesia_demo_20260709'
  AND metadata->>'archived_by_seed_pack' IS NULL;

UPDATE core.users u
SET status = 'disabled',
    is_active = FALSE,
    deleted_at = COALESCE(deleted_at, NOW()),
    updated_at = NOW()
FROM core.user_profiles p
WHERE p.user_id = u.id
  AND p.metadata->>'seed_pack' = 'indonesia_demo_20260709'
  AND p.metadata->>'archived_by_seed_pack' = 'real_indonesia_open_data_20260723';
