SET search_path = public, events;

CREATE TABLE IF NOT EXISTS umkm_store_gallery_likes (
  store_id uuid NOT NULL REFERENCES umkm_stores(id) ON DELETE CASCADE,
  media_key text NOT NULL,
  user_id uuid NOT NULL REFERENCES users_read_model(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, media_key, user_id)
);

CREATE INDEX IF NOT EXISTS idx_umkm_store_gallery_likes_store_id
  ON umkm_store_gallery_likes (store_id);

CREATE INDEX IF NOT EXISTS idx_umkm_store_gallery_likes_user_id
  ON umkm_store_gallery_likes (user_id);

CREATE INDEX IF NOT EXISTS idx_umkm_store_gallery_likes_store_media
  ON umkm_store_gallery_likes (store_id, media_key);
