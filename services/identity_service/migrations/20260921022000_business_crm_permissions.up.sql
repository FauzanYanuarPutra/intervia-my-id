BEGIN;

INSERT INTO permissions (id, name, description)
VALUES
  (gen_random_uuid(), 'business:read', 'Read business profiles, map references and publication review queue'),
  (gen_random_uuid(), 'business:moderate', 'Approve, restrict, restore or reject public business visibility'),
  (gen_random_uuid(), 'business:case:manage', 'Assign business moderation cases and manage case evidence'),
  (gen_random_uuid(), 'business:report:read', 'Review user reports about businesses'),
  (gen_random_uuid(), 'business:verify', 'Review business verification requests'),
  (gen_random_uuid(), 'business:appeal:review', 'Review business moderation appeals'),
  (gen_random_uuid(), 'business:notifications:read', 'Read and manage internal business moderation notifications')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'moderator'
  AND p.name IN (
    'business:read',
    'business:moderate',
    'business:case:manage',
    'business:report:read',
    'business:verify',
    'business:appeal:review',
    'business:notifications:read'
  )
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('admin', 'super_admin')
  AND p.name IN (
    'business:read',
    'business:moderate',
    'business:case:manage',
    'business:report:read',
    'business:verify',
    'business:appeal:review',
    'business:notifications:read'
  )
ON CONFLICT DO NOTHING;

COMMIT;
