ALTER TABLE reel.lajukan_reel_comments
ADD COLUMN IF NOT EXISTS parent_comment_id text NULL REFERENCES reel.lajukan_reel_comments(id) ON DELETE CASCADE;
ALTER TABLE reel.lajukan_reel_comments
ADD COLUMN IF NOT EXISTS reply_count integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS lajukan_reel_comments_parent_idx ON reel.lajukan_reel_comments (
  reel_id,
  parent_comment_id,
  status,
  created_at ASC,
  id ASC
);
