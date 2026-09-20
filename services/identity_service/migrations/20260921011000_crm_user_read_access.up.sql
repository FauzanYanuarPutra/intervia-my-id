-- CRM staff need read-only access to the canonical identity user directory.
-- This does not grant mutation privileges; user moderation remains separately guarded.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('admin', 'moderator', 'sales', 'support', 'super_admin')
  AND p.name = 'user.read'
ON CONFLICT DO NOTHING;
