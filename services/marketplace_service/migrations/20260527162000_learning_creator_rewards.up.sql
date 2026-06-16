ALTER TABLE learning_courses
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'business',
  ADD COLUMN IF NOT EXISTS primary_format TEXT NOT NULL DEFAULT 'mixed',
  ADD COLUMN IF NOT EXISTS trailer_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS view_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrollment_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_avg REAL NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'learning_courses_primary_format_check'
  ) THEN
    ALTER TABLE learning_courses
      ADD CONSTRAINT learning_courses_primary_format_check
      CHECK (primary_format IN ('video', 'reading', 'course', 'mixed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_learning_courses_discovery
  ON learning_courses(status, visibility, category, primary_format, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_courses_tags
  ON learning_courses USING GIN (tags);

CREATE TABLE IF NOT EXISTS user_reward_balances (
  user_id UUID PRIMARY KEY,
  coin_balance BIGINT NOT NULL DEFAULT 0 CHECK (coin_balance >= 0),
  xp_balance BIGINT NOT NULL DEFAULT 0 CHECK (xp_balance >= 0),
  voucher_count INT NOT NULL DEFAULT 0 CHECK (voucher_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_login_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  reward_date DATE NOT NULL DEFAULT CURRENT_DATE,
  week_start DATE NOT NULL DEFAULT date_trunc('week', CURRENT_DATE::timestamp)::date,
  streak_day INT NOT NULL CHECK (streak_day >= 1 AND streak_day <= 7),
  coin_amount INT NOT NULL DEFAULT 0 CHECK (coin_amount >= 0),
  xp_amount INT NOT NULL DEFAULT 0 CHECK (xp_amount >= 0),
  voucher_code TEXT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id, reward_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_login_rewards_user_date
  ON daily_login_rewards(user_id, reward_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_login_rewards_week
  ON daily_login_rewards(user_id, week_start, reward_date DESC);
