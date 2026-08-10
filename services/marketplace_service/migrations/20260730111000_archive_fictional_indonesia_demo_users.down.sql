UPDATE users_read_model
SET status = COALESCE(NULLIF(metadata->>'pre_archive_status', ''), 'active'),
    identity_deleted_at = NULL,
    metadata = metadata
      - 'pre_archive_status'
      - 'archived_by_seed_pack'
      - 'archived_reason',
    synced_at = NOW()
WHERE metadata->>'seed_pack' = 'indonesia_demo_20260709'
  AND metadata->>'archived_by_seed_pack' = 'real_indonesia_open_data_20260723';
