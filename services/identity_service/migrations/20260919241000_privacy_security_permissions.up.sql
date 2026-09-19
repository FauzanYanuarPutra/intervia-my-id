INSERT INTO permissions (id, name, description) VALUES
(gen_random_uuid(), 'privacy:request:read', 'Read privacy and data-subject requests'),
(gen_random_uuid(), 'privacy:request:manage', 'Process privacy and data-subject requests'),
(gen_random_uuid(), 'security:incident:read', 'Read security incidents'),
(gen_random_uuid(), 'security:incident:manage', 'Manage security incidents and notification workflow')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'super_admin'
AND p.name IN ('privacy:request:read','privacy:request:manage','security:incident:read','security:incident:manage')
ON CONFLICT DO NOTHING;