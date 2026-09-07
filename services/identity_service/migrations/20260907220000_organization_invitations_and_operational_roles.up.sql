-- Username-first organization invitations and business-scoped operational roles.
-- Existing owner/org_admin semantics remain unchanged.

SET search_path = core, identity, public, events, audit;

INSERT INTO core.roles (id, name, description, system, role_type)
VALUES
  (gen_random_uuid(), 'org_manager', 'Business manager with day-to-day operational access', TRUE, 'org'),
  (gen_random_uuid(), 'org_cashier', 'Cashier and order-entry operator', TRUE, 'org'),
  (gen_random_uuid(), 'org_inventory', 'Inventory and purchasing operator', TRUE, 'org'),
  (gen_random_uuid(), 'org_accounting', 'Finance and bookkeeping operator', TRUE, 'org'),
  (gen_random_uuid(), 'org_viewer', 'Read-only business workspace member', TRUE, 'org')
ON CONFLICT (name) DO NOTHING;

INSERT INTO core.permissions (id, name, description)
VALUES
  (gen_random_uuid(), 'org:operate_sales', 'Create and manage business sales/orders'),
  (gen_random_uuid(), 'org:manage_inventory', 'Manage inventory, stock movements and purchasing'),
  (gen_random_uuid(), 'org:manage_finance', 'Manage bookkeeping, expenses, reconciliation and finance'),
  (gen_random_uuid(), 'org:read_reports', 'Read organization reports and dashboards')
ON CONFLICT (name) DO NOTHING;

-- Manager receives broad operational access but not ownership/system privileges.
INSERT INTO core.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM core.roles r
JOIN core.permissions p ON p.name IN (
  'org:read', 'org:update', 'org:invite_member', 'org:remove_member', 'org:update_member_role',
  'org:operate_sales', 'org:manage_inventory', 'org:manage_finance', 'org:read_reports'
)
WHERE r.name = 'org_manager'
ON CONFLICT DO NOTHING;

INSERT INTO core.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM core.roles r JOIN core.permissions p ON p.name IN ('org:read', 'org:operate_sales')
WHERE r.name = 'org_cashier' ON CONFLICT DO NOTHING;

INSERT INTO core.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM core.roles r JOIN core.permissions p ON p.name IN ('org:read', 'org:manage_inventory', 'org:read_reports')
WHERE r.name = 'org_inventory' ON CONFLICT DO NOTHING;

INSERT INTO core.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM core.roles r JOIN core.permissions p ON p.name IN ('org:read', 'org:manage_finance', 'org:read_reports')
WHERE r.name = 'org_accounting' ON CONFLICT DO NOTHING;

INSERT INTO core.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM core.roles r JOIN core.permissions p ON p.name IN ('org:read', 'org:read_reports')
WHERE r.name = 'org_viewer' ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS core.organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
  invitee_user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
  role_id UUID NOT NULL REFERENCES core.roles(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_org_invitation_pending_user
  ON core.organization_invitations (org_id, invitee_user_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_org_invitation_invitee_status
  ON core.organization_invitations (invitee_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_invitation_org_status
  ON core.organization_invitations (org_id, status, created_at DESC);

DROP TRIGGER IF EXISTS organization_invitations_update_timestamp ON core.organization_invitations;
CREATE TRIGGER organization_invitations_update_timestamp
BEFORE UPDATE ON core.organization_invitations
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
