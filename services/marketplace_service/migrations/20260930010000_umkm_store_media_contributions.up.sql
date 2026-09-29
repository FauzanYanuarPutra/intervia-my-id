BEGIN;

CREATE TABLE IF NOT EXISTS umkm_store_media_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES umkm_stores(id) ON DELETE CASCADE,
  uploader_user_id UUID NOT NULL REFERENCES users_read_model(user_id) ON DELETE RESTRICT,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image'
    CHECK (media_type IN ('image','video')),
  caption TEXT,
  uploader_name_snapshot TEXT,
  uploader_username_snapshot TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','hidden')),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  review_note TEXT,
  reviewed_by UUID NULL,
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_umkm_store_media_contribution_url CHECK (
    LENGTH(media_url) <= 2048
    AND media_url ~ '^/api/forum/media/[A-Za-z0-9][A-Za-z0-9._-]{0,199}$'
  ),
  CONSTRAINT ck_umkm_store_media_contribution_caption CHECK (
    caption IS NULL OR LENGTH(caption) <= 500
  ),
  CONSTRAINT ck_umkm_store_media_contribution_review_note CHECK (
    review_note IS NULL OR LENGTH(review_note) <= 4000
  ),
  CONSTRAINT ck_umkm_store_media_contribution_uploader_name CHECK (
    uploader_name_snapshot IS NULL OR LENGTH(uploader_name_snapshot) <= 160
  ),
  CONSTRAINT ck_umkm_store_media_contribution_uploader_username CHECK (
    uploader_username_snapshot IS NULL OR LENGTH(uploader_username_snapshot) <= 80
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_umkm_store_media_contribution_store_url
  ON umkm_store_media_contributions (store_id, media_url);

CREATE INDEX IF NOT EXISTS idx_umkm_store_media_contributions_public
  ON umkm_store_media_contributions (store_id, status, is_primary DESC, created_at DESC)
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_umkm_store_media_contributions_queue
  ON umkm_store_media_contributions (status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_umkm_store_media_contributions_uploader
  ON umkm_store_media_contributions (uploader_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_umkm_store_media_contribution_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS umkm_store_media_contribution_updated_at
  ON umkm_store_media_contributions;
CREATE TRIGGER umkm_store_media_contribution_updated_at
BEFORE UPDATE ON umkm_store_media_contributions
FOR EACH ROW EXECUTE FUNCTION public.touch_umkm_store_media_contribution_updated_at();

COMMIT;
