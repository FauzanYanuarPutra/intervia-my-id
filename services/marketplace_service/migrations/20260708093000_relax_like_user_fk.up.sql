SET search_path = public, events;

ALTER TABLE IF EXISTS content_item_likes
  DROP CONSTRAINT IF EXISTS content_item_likes_user_id_fkey;

ALTER TABLE IF EXISTS umkm_store_gallery_likes
  DROP CONSTRAINT IF EXISTS umkm_store_gallery_likes_user_id_fkey;
