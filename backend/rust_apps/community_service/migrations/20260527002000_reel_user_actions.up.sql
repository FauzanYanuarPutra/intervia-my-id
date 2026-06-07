CREATE TABLE IF NOT EXISTS lajukan_reel_user_actions (
  id text PRIMARY KEY,
  reel_id text NOT NULL REFERENCES lajukan_reels(id) ON DELETE CASCADE,
  actor_user_id text NOT NULL REFERENCES lajukan_forum_users(id) ON DELETE CASCADE,
  target_user_id text NULL,
  action text NOT NULL CHECK (action IN ('like', 'save', 'follow')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lajukan_reel_user_actions_unique_idx
  ON lajukan_reel_user_actions (reel_id, actor_user_id, action);

CREATE UNIQUE INDEX IF NOT EXISTS lajukan_reel_user_follows_unique_idx
  ON lajukan_reel_user_actions (actor_user_id, target_user_id, action)
  WHERE action = 'follow' AND target_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS lajukan_reel_user_actions_actor_idx
  ON lajukan_reel_user_actions (actor_user_id, action, updated_at DESC);

