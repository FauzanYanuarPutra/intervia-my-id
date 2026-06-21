SET search_path = public, events;

CREATE TABLE IF NOT EXISTS content_item_likes (
  content_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users_read_model(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_content_item_likes_content_id
  ON content_item_likes (content_id);

CREATE INDEX IF NOT EXISTS idx_content_item_likes_user_id
  ON content_item_likes (user_id);
