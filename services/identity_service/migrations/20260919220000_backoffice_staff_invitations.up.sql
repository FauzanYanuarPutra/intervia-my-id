-- Backoffice staff invitation and least-privilege access grants.
-- Existing Lajukan users are selected by username/email, then explicitly accept
-- the invitation before Google backoffice access is activated.

CREATE TABLE IF NOT EXISTS core.backoffice_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitee_user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
  application TEXT NOT NULL CHECK (application IN ('crm','cms')),
  role_names TEXT[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected','revoked','expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT backoffice_invitation_roles_nonempty CHECK (cardinality(role_names) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_backoffice_pending_invitation
  ON core.backoffice_invitations (invitee_user_id, application)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_backoffice_invitation_invitee
  ON core.backoffice_invitations (invitee_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_backoffice_invitation_inviter
  ON core.backoffice_invitations (invited_by, status, created_at DESC);

DROP TRIGGER IF EXISTS backoffice_invitations_update_timestamp
  ON core.backoffice_invitations;
CREATE TRIGGER backoffice_invitations_update_timestamp
BEFORE UPDATE ON core.backoffice_invitations
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
