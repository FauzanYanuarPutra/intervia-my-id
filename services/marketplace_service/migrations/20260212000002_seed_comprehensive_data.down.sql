-- Remove all seed data (be careful - this deletes all test data)
-- Only run this if you want to clean up seed data

DELETE FROM content_items 
WHERE owner_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000005'
)
AND content_type IN ('product', 'service', 'job', 'property', 'image', 'user');

