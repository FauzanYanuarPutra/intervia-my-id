ALTER TABLE reel.lajukan_reels
ADD COLUMN IF NOT EXISTS filter_preset text NOT NULL DEFAULT 'natural',
  ADD COLUMN IF NOT EXISTS capture_mode text NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS live_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS live_title text NULL,
  ADD COLUMN IF NOT EXISTS live_scheduled_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
UPDATE reel.lajukan_reels
SET filter_preset = CASE
    WHEN COALESCE(NULLIF(filter_preset, ''), 'natural') IN ('natural', 'warm', 'fresh', 'cinema', 'mono', 'pop')
      THEN COALESCE(NULLIF(filter_preset, ''), 'natural')
    ELSE 'natural'
  END,
  capture_mode = CASE
    WHEN COALESCE(NULLIF(capture_mode, ''), 'upload') IN ('upload', 'camera', 'live')
      THEN COALESCE(NULLIF(capture_mode, ''), 'upload')
    ELSE 'upload'
  END,
  live_status = CASE
    WHEN COALESCE(NULLIF(live_status, ''), 'none') IN ('none', 'offline') THEN 'none'
    WHEN COALESCE(NULLIF(live_status, ''), 'none') IN ('scheduled', 'live', 'ended')
      THEN COALESCE(NULLIF(live_status, ''), 'none')
    ELSE 'none'
  END,
  metadata = COALESCE(metadata, '{}'::jsonb);
DO $$ BEGIN
ALTER TABLE reel.lajukan_reels
ADD CONSTRAINT lajukan_reels_filter_preset_check CHECK (
    filter_preset IN (
      'natural',
      'warm',
      'fresh',
      'cinema',
      'mono',
      'pop'
    )
  );
EXCEPTION
WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
ALTER TABLE reel.lajukan_reels
ADD CONSTRAINT lajukan_reels_capture_mode_check CHECK (capture_mode IN ('upload', 'camera', 'live'));
EXCEPTION
WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
ALTER TABLE reel.lajukan_reels
ADD CONSTRAINT lajukan_reels_live_status_check CHECK (
    live_status IN ('none', 'scheduled', 'live', 'ended')
  );
EXCEPTION
WHEN duplicate_object THEN NULL;
END $$;
