SET search_path = forum, reel, public, events;

ALTER TABLE reel.lajukan_reels
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

ALTER TABLE reel.lajukan_reels
  ADD COLUMN IF NOT EXISTS allow_comments boolean NOT NULL DEFAULT true;

-- Preserve privacy choices that the previous UI stored only in metadata. Rows
-- without a recognized value retain the backwards-compatible public/true
-- defaults.
UPDATE reel.lajukan_reels
SET visibility = CASE
  WHEN lower(COALESCE(
    metadata->>'visibility',
    metadata#>>'{publishingPreferences,visibility}',
    metadata#>>'{publishing_preferences,visibility}'
  )) IN ('public', 'followers', 'private')
  THEN lower(COALESCE(
    metadata->>'visibility',
    metadata#>>'{publishingPreferences,visibility}',
    metadata#>>'{publishing_preferences,visibility}'
  ))
  ELSE 'public'
END,
allow_comments = CASE lower(COALESCE(
  metadata->>'allowComments',
  metadata->>'allow_comments',
  metadata#>>'{publishingPreferences,allowComments}',
  metadata#>>'{publishingPreferences,allow_comments}',
  metadata#>>'{publishing_preferences,allowComments}',
  metadata#>>'{publishing_preferences,allow_comments}',
  'true'
))
  WHEN 'false' THEN false
  WHEN '0' THEN false
  ELSE true
END;

UPDATE reel.lajukan_reels
SET metadata = jsonb_set(
  jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{visibility}',
    to_jsonb(visibility),
    true
  ),
  '{allowComments}',
  to_jsonb(allow_comments),
  true
);

ALTER TABLE reel.lajukan_reels
  DROP CONSTRAINT IF EXISTS lajukan_reels_visibility_check;

ALTER TABLE reel.lajukan_reels
  ADD CONSTRAINT lajukan_reels_visibility_check
  CHECK (visibility IN ('public', 'followers', 'private'));

CREATE INDEX IF NOT EXISTS lajukan_reels_visibility_feed_idx
  ON reel.lajukan_reels (visibility, published_at DESC, id)
  WHERE status = 'published';

