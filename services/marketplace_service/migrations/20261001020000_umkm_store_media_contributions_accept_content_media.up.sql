BEGIN;

ALTER TABLE umkm_store_media_contributions
  DROP CONSTRAINT IF EXISTS ck_umkm_store_media_contribution_url;

ALTER TABLE umkm_store_media_contributions
  ADD CONSTRAINT ck_umkm_store_media_contribution_url CHECK (
    LENGTH(media_url) <= 2048
    AND (
      media_url ~ '^/api/forum/media/[A-Za-z0-9][A-Za-z0-9._-]{0,199}$'
      OR media_url ~ '^/api/content/media/[A-Za-z0-9._-]{1,120}/forum/[A-Za-z0-9][A-Za-z0-9._-]{0,199}$'
    )
  );

COMMIT;
