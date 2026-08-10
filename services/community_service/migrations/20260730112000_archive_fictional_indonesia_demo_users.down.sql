UPDATE forum.lajukan_forum_users
SET metadata = metadata - 'archived_by_seed_pack' - 'archived_reason',
    deleted_at = NULL,
    updated_at = NOW()
WHERE metadata->>'archived_by_seed_pack' = 'real_indonesia_open_data_20260723'
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
