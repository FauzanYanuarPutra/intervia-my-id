SET search_path = public, events;

DELETE FROM content_item_likes cil
WHERE NOT EXISTS (
  SELECT 1 FROM users_read_model u WHERE u.user_id = cil.user_id
);

DELETE FROM umkm_store_gallery_likes ugl
WHERE NOT EXISTS (
  SELECT 1 FROM users_read_model u WHERE u.user_id = ugl.user_id
);

ALTER TABLE IF EXISTS content_item_likes
  ADD CONSTRAINT content_item_likes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users_read_model(user_id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS umkm_store_gallery_likes
  ADD CONSTRAINT umkm_store_gallery_likes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users_read_model(user_id) ON DELETE CASCADE;
