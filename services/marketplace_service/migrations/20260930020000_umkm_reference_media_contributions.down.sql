BEGIN;

DROP INDEX IF EXISTS idx_umkm_reference_media_contributions_public;
DROP INDEX IF EXISTS uq_umkm_reference_media_contribution_url;
ALTER TABLE umkm_store_media_contributions
  DROP CONSTRAINT IF EXISTS ck_umkm_store_media_contribution_target;
ALTER TABLE umkm_store_media_contributions
  DROP COLUMN IF EXISTS reference_content_id;
ALTER TABLE umkm_store_media_contributions
  ALTER COLUMN store_id SET NOT NULL;

COMMIT;
