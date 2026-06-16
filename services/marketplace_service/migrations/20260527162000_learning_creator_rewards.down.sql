DROP TABLE IF EXISTS daily_login_rewards;
DROP TABLE IF EXISTS user_reward_balances;

DROP INDEX IF EXISTS idx_learning_courses_tags;
DROP INDEX IF EXISTS idx_learning_courses_discovery;

ALTER TABLE learning_courses
  DROP CONSTRAINT IF EXISTS learning_courses_primary_format_check,
  DROP COLUMN IF EXISTS rating_avg,
  DROP COLUMN IF EXISTS enrollment_count,
  DROP COLUMN IF EXISTS view_count,
  DROP COLUMN IF EXISTS published_at,
  DROP COLUMN IF EXISTS metadata,
  DROP COLUMN IF EXISTS tags,
  DROP COLUMN IF EXISTS trailer_url,
  DROP COLUMN IF EXISTS primary_format,
  DROP COLUMN IF EXISTS category;
