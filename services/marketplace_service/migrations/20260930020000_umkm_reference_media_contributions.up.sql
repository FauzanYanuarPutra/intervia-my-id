BEGIN;

ALTER TABLE umkm_store_media_contributions
  ADD COLUMN IF NOT EXISTS reference_content_id UUID
    REFERENCES content_items(id) ON DELETE CASCADE;

ALTER TABLE umkm_store_media_contributions
  ALTER COLUMN store_id DROP NOT NULL;

ALTER TABLE umkm_store_media_contributions
  DROP CONSTRAINT IF EXISTS ck_umkm_store_media_contribution_target;

ALTER TABLE umkm_store_media_contributions
  ADD CONSTRAINT ck_umkm_store_media_contribution_target CHECK (
    (store_id IS NOT NULL AND reference_content_id IS NULL)
    OR
    (store_id IS NULL AND reference_content_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_umkm_reference_media_contribution_url
  ON umkm_store_media_contributions (reference_content_id, media_url);

CREATE INDEX IF NOT EXISTS idx_umkm_reference_media_contributions_public
  ON umkm_store_media_contributions (
    reference_content_id,
    status,
    is_primary DESC,
    created_at DESC
  )
  WHERE status = 'approved';

COMMIT;
