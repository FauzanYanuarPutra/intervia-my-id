-- Promote the canonical backoffice admin bootstrap account to the initial
-- platform-owner identity used across CMS and CRM.
--
-- The password remains deployment-secret only; this migration only updates the
-- role contract and ensures the existing super_admin role is available.

INSERT INTO roles (id, name, description, system, role_type)
VALUES (
    gen_random_uuid(),
    'super_admin',
    'Platform Super Administrator with full access',
    TRUE,
    'global'
)
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
  AND p.name LIKE 'system:%'
ON CONFLICT DO NOTHING;

UPDATE core.backoffice_bootstrap_slots
SET role_names = ARRAY[
    'super_admin',
    'admin',
    'content_admin',
    'sales',
    'support'
],
    updated_at = NOW()
WHERE slot = 'admin';
