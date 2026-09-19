-- Backoffice least-privilege roles.
INSERT INTO roles (id, name, description, system, role_type)
VALUES
  (gen_random_uuid(), 'moderator', 'CRM content moderation operator with restricted destructive access', TRUE, 'global')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (id, name, description)
VALUES
  (gen_random_uuid(), 'content:moderate', 'Review, approve, reject and restrict user-generated content'),
  (gen_random_uuid(), 'content:report:read', 'Review user content reports'),
  (gen_random_uuid(), 'content:appeal:read', 'Review moderation appeals'),
  (gen_random_uuid(), 'backoffice:staff:invite', 'Invite existing Lajukan users into CRM/CMS backoffice'),
  (gen_random_uuid(), 'backoffice:staff:manage', 'Manage backoffice staff access and revoke grants')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'moderator'
  AND p.name IN ('content:moderate','content:report:read','content:appeal:read')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'super_admin'
  AND p.name IN ('backoffice:staff:invite','backoffice:staff:manage')
ON CONFLICT DO NOTHING;
