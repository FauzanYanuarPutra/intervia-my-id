-- Perbaikan script pembersih data seed
DELETE FROM content_items 
WHERE owner_id IN ( -- Gunakan owner_id
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000005'
)
AND content_type IN ('product', 'service', 'job', 'property', 'image', 'user', 'news', 'article'); -- Gunakan content_type
