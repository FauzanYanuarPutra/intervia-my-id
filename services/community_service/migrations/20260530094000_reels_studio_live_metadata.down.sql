ALTER TABLE reel.lajukan_reels DROP CONSTRAINT IF EXISTS lajukan_reels_live_status_check,
    DROP CONSTRAINT IF EXISTS lajukan_reels_capture_mode_check,
    DROP CONSTRAINT IF EXISTS lajukan_reels_filter_preset_check;
ALTER TABLE reel.lajukan_reels DROP COLUMN IF EXISTS metadata,
    DROP COLUMN IF EXISTS live_scheduled_at,
    DROP COLUMN IF EXISTS live_title,
    DROP COLUMN IF EXISTS live_status,
    DROP COLUMN IF EXISTS capture_mode,
    DROP COLUMN IF EXISTS filter_preset;
