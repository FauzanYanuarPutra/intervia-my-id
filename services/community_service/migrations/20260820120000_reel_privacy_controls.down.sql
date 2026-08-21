SET search_path = forum, reel, public, events;

DROP INDEX IF EXISTS reel.lajukan_reels_visibility_feed_idx;

ALTER TABLE reel.lajukan_reels
  DROP CONSTRAINT IF EXISTS lajukan_reels_visibility_check;

ALTER TABLE reel.lajukan_reels
  DROP COLUMN IF EXISTS allow_comments,
  DROP COLUMN IF EXISTS visibility;
