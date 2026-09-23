SET search_path = forum, reel, public, events;

CREATE TABLE IF NOT EXISTS forum.lajukan_forum_thread_bookmarks (
  thread_id text NOT NULL REFERENCES forum.lajukan_forum_threads(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES forum.lajukan_forum_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS lajukan_forum_thread_bookmarks_thread_idx
  ON forum.lajukan_forum_thread_bookmarks (thread_id);

CREATE INDEX IF NOT EXISTS lajukan_forum_thread_bookmarks_user_idx
  ON forum.lajukan_forum_thread_bookmarks (user_id);
