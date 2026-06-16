-- Add explicit roles used by CMS/CRM frontends and map them to dev users.
-- This keeps login behavior predictable in local development.
INSERT INTO roles (id, name, description, system, role_type)
VALUES (
        gen_random_uuid(),
        'admin',
        'Platform admin role alias',
        TRUE,
        'global'
    ),
    (
        gen_random_uuid(),
        'content_admin',
        'CMS content administrator',
        TRUE,
        'global'
    ),
    (
        gen_random_uuid(),
        'sales',
        'CRM sales operator',
        TRUE,
        'global'
    ),
    (
        gen_random_uuid(),
        'support',
        'CRM support agent',
        TRUE,
        'global'
    ) ON CONFLICT (name) DO NOTHING;
-- Super admin account should always pass CMS/CRM role checks.
INSERT INTO core.user_roles (user_id, role_id)
SELECT u.id,
    r.id
FROM core.users u
    JOIN roles r ON r.name IN ('admin', 'content_admin', 'sales', 'support')
WHERE lower(u.email) = 'admin@lajukan.com' ON CONFLICT DO NOTHING;
-- Agent account gets CRM-capable roles for realistic testing.
INSERT INTO core.user_roles (user_id, role_id)
SELECT u.id,
    r.id
FROM core.users u
    JOIN roles r ON r.name IN ('sales', 'support')
WHERE lower(u.email) = 'agent@lajukan.com' ON CONFLICT DO NOTHING;
SELECT 1;