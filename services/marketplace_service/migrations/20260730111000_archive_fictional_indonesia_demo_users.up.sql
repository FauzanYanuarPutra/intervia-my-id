-- Mirror the identity archive in the marketplace read model so fictional
-- providers cannot be returned as discover/search candidates.
UPDATE users_read_model
SET metadata = COALESCE(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'pre_archive_status', status,
        'archived_by_seed_pack', 'real_indonesia_open_data_20260723',
        'archived_reason', 'Fictional demo identity hidden in favor of sourced public references.'
      ),
    status = 'deleted',
    identity_deleted_at = COALESCE(identity_deleted_at, NOW()),
    synced_at = NOW()
WHERE metadata->>'seed_pack' = 'indonesia_demo_20260709'
  AND metadata->>'archived_by_seed_pack' IS NULL;
