BEGIN;

CREATE TABLE IF NOT EXISTS core.user_moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
  actor_user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('warn','restrict','suspend','ban','restore')),
  reason_code TEXT NOT NULL CHECK (reason_code IN ('legal_violation','fraud_misleading','spam','privacy_personal_data','harassment_discrimination','child_safety','security_abuse','repeated_policy_violation','other')),
  reason_note TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_moderation_target ON core.user_moderation_actions(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_moderation_queue ON core.user_moderation_actions(action, severity, created_at DESC);
REVOKE ALL ON TABLE core.user_moderation_actions FROM PUBLIC;

COMMIT;