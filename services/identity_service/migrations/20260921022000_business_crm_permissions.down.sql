DELETE FROM role_permissions rp
USING permissions p
WHERE rp.permission_id = p.id
  AND p.name IN (
    'business:read',
    'business:moderate',
    'business:case:manage',
    'business:report:read',
    'business:verify',
    'business:appeal:review',
    'business:notifications:read'
  );

DELETE FROM permissions
WHERE name IN (
  'business:read',
  'business:moderate',
  'business:case:manage',
  'business:report:read',
  'business:verify',
  'business:appeal:review',
  'business:notifications:read'
);
