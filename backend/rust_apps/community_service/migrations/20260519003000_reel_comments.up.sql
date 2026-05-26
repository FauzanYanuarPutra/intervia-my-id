CREATE TABLE IF NOT EXISTS lajukan_reel_comments (
  id text PRIMARY KEY,
  reel_id text NOT NULL REFERENCES lajukan_reels(id) ON DELETE CASCADE,
  author_user_id text NOT NULL REFERENCES lajukan_forum_users(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  author_avatar_url text NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'deleted', 'blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lajukan_reel_comments_reel_idx
  ON lajukan_reel_comments (reel_id, status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS lajukan_reel_comments_author_idx
  ON lajukan_reel_comments (author_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS lajukan_reel_comments_body_search_idx
  ON lajukan_reel_comments
  USING gin (to_tsvector('simple', coalesce(body, '')));
