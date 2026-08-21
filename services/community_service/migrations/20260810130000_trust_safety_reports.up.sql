SET search_path = forum, reel, public, events;

CREATE TABLE IF NOT EXISTS forum.lajukan_trust_reports (
  id text PRIMARY KEY,
  reporter_user_id text NOT NULL REFERENCES forum.lajukan_forum_users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('reel', 'thread', 'post')),
  target_id text NOT NULL,
  target_user_id text NULL,
  reason text NOT NULL CHECK (
    reason IN ('spam', 'scam', 'harassment', 'hate', 'sexual', 'violence', 'illegal', 'privacy', 'other')
  ),
  details text NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS lajukan_trust_reports_queue_idx
  ON forum.lajukan_trust_reports (status, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS lajukan_trust_reports_target_idx
  ON forum.lajukan_trust_reports (target_type, target_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS forum.lajukan_user_blocks (
  blocker_user_id text NOT NULL REFERENCES forum.lajukan_forum_users(id) ON DELETE CASCADE,
  blocked_user_id text NOT NULL REFERENCES forum.lajukan_forum_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_user_id, blocked_user_id),
  CHECK (blocker_user_id <> blocked_user_id)
);

CREATE INDEX IF NOT EXISTS lajukan_user_blocks_blocked_idx
  ON forum.lajukan_user_blocks (blocked_user_id, blocker_user_id);

ALTER TABLE forum.lajukan_reel_user_actions
  DROP CONSTRAINT IF EXISTS lajukan_reel_user_actions_action_check;

ALTER TABLE forum.lajukan_reel_user_actions
  ADD CONSTRAINT lajukan_reel_user_actions_action_check
  CHECK (action IN ('like', 'save', 'follow', 'not_interested'));

