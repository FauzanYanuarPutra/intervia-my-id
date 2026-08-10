-- Threads and reels from this seed were archived on 2026-07-23. Soft-delete
-- their synthetic profiles too, including identity-derived read-model copies.
UPDATE forum.lajukan_forum_users
SET metadata = COALESCE(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'archived_by_seed_pack', 'real_indonesia_open_data_20260723',
        'archived_reason', 'Fictional demo profile hidden in favor of sourced public references.'
      ),
    deleted_at = COALESCE(deleted_at, NOW()),
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND (
    metadata->>'seed_pack' = 'indonesia_demo_20260709'
    OR id IN (
      'auth-00000000-0000-0000-0000-000000000701',
      'auth-00000000-0000-0000-0000-000000000702',
      'auth-00000000-0000-0000-0000-000000000703',
      'auth-00000000-0000-0000-0000-000000000704',
      'auth-00000000-0000-0000-0000-000000000705',
      'auth-00000000-0000-0000-0000-000000000706',
      'auth-00000000-0000-0000-0000-000000000707',
      'auth-00000000-0000-0000-0000-000000000708',
      'auth-00000000-0000-0000-0000-000000000709',
      'auth-00000000-0000-0000-0000-000000000710'
    )
  );
