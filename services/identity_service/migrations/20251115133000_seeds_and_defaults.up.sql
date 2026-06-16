-- 20251115133000_seeds_and_defaults.up.sql
-- ============================================================
-- PERMISSIONS (Global, Organization, Buyer)
-- ============================================================
INSERT INTO permissions (id, name, description)
VALUES -- GLOBAL / PLATFORM ADMIN
    (
        gen_random_uuid(),
        'system:manage',
        'Full system control'
    ),
    (
        gen_random_uuid(),
        'system:view_logs',
        'Read audit logs'
    ),
    (
        gen_random_uuid(),
        'system:update_roles',
        'Manage global roles & permissions'
    ),
    -- ORGANIZATION MANAGEMENT
    (
        gen_random_uuid(),
        'org:create',
        'Create organization'
    ),
    (
        gen_random_uuid(),
        'org:read',
        'Read organization'
    ),
    (
        gen_random_uuid(),
        'org:update',
        'Update organization'
    ),
    (
        gen_random_uuid(),
        'org:delete',
        'Delete organization'
    ),
    -- ORGANIZATION ADMINISTRATION
    (
        gen_random_uuid(),
        'org:invite_member',
        'Invite organization member'
    ),
    (
        gen_random_uuid(),
        'org:remove_member',
        'Remove organization member'
    ),
    (
        gen_random_uuid(),
        'org:update_member_role',
        'Change organization member role'
    ),
    -- BUYER
    (
        gen_random_uuid(),
        'buyer:read_own',
        'Read own buyer data'
    ),
    (
        gen_random_uuid(),
        'buyer:update_own',
        'Update own buyer data'
    ) ON CONFLICT(name) DO NOTHING;
-- ============================================================
-- ROLES
-- ============================================================
INSERT INTO roles (
        id,
        name,
        description,
        system,
        role_type
    )
VALUES -- System roles
    (
        gen_random_uuid(),
        'super_admin',
        'Platform Super Administrator with full access',
        TRUE,
        'global'
    ),
    (
        gen_random_uuid(),
        'read_only',
        'Read-only user',
        TRUE,
        'global'
    ),
    (
        gen_random_uuid(),
        'buyer',
        'Default buyer role',
        TRUE,
        'global'
    ),
    -- Organization roles
    (
        gen_random_uuid(),
        'org_admin',
        'Organization administrator',
        TRUE,
        'org'
    ),
    (
        gen_random_uuid(),
        'org_member',
        'Organization member',
        TRUE,
        'org'
    ) ON CONFLICT(name) DO NOTHING;
-- ============================================================
-- ROLE PERMISSIONS
-- ============================================================
-- super_admin gets all system:* permissions
WITH sp AS (
    SELECT id
    FROM permissions
    WHERE name LIKE 'system:%'
),
sr AS (
    SELECT id
    FROM roles
    WHERE name = 'super_admin'
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT sr.id,
    sp.id
FROM sr,
    sp ON CONFLICT DO NOTHING;
-- org_admin gets all org:* permissions
WITH rp AS (
    SELECT id
    FROM permissions
    WHERE name LIKE 'org:%'
),
rr AS (
    SELECT id,
        name
    FROM roles
    WHERE name IN ('org_admin', 'org_member')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT rr.id,
    rp.id
FROM rr
    JOIN rp ON TRUE
WHERE rr.name = 'org_admin' ON CONFLICT DO NOTHING;
-- org_member hanya read
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id,
    p.id
FROM roles r,
    permissions p
WHERE r.name = 'org_member'
    AND p.name IN ('org:read') ON CONFLICT DO NOTHING;
-- buyer gets all buyer:* permissions
WITH bp AS (
    SELECT id
    FROM permissions
    WHERE name LIKE 'buyer:%'
),
br AS (
    SELECT id
    FROM roles
    WHERE name = 'buyer'
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT br.id,
    bp.id
FROM br,
    bp ON CONFLICT DO NOTHING;