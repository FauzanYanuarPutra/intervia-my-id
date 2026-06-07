ALTER TABLE lajukan_reels
  ADD COLUMN IF NOT EXISTS filter_preset text NOT NULL DEFAULT 'natural',
  ADD COLUMN IF NOT EXISTS capture_mode text NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS live_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS live_title text NULL,
  ADD COLUMN IF NOT EXISTS live_scheduled_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  ALTER TABLE lajukan_reels
    ADD CONSTRAINT lajukan_reels_filter_preset_check
    CHECK (filter_preset IN ('natural', 'warm', 'fresh', 'cinema', 'mono', 'pop'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE lajukan_reels
    ADD CONSTRAINT lajukan_reels_capture_mode_check
    CHECK (capture_mode IN ('upload', 'camera', 'live'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE lajukan_reels
    ADD CONSTRAINT lajukan_reels_live_status_check
    CHECK (live_status IN ('none', 'scheduled', 'live', 'ended'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

UPDATE lajukan_reels
SET
  filter_preset = COALESCE(NULLIF(filter_preset, ''), 'natural'),
  capture_mode = COALESCE(NULLIF(capture_mode, ''), 'upload'),
  live_status = COALESCE(NULLIF(live_status, ''), 'none'),
  metadata = COALESCE(metadata, '{}'::jsonb);
