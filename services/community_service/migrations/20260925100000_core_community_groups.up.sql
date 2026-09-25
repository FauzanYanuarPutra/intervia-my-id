SET search_path = forum, reel, public, events;

-- Official topic groups keep the community experience useful from day one.
-- They are platform-owned spaces, not fictional demo users/content.
INSERT INTO forum.lajukan_forum_users (
  id,
  username,
  name,
  avatar_url,
  title,
  reputation,
  base_reputation,
  badges,
  metadata,
  created_at,
  updated_at
)
VALUES (
  'system-lajukan-community',
  'lajukan.community',
  'Lajukan Community',
  '/default-avatar.svg',
  'Official Community',
  1000,
  1000,
  ARRAY['official', 'community'],
  '{"system":true,"seed_pack":"core_community_groups_20260925"}'::jsonb,
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    title = EXCLUDED.title,
    metadata = EXCLUDED.metadata,
    updated_at = now();

INSERT INTO forum.lajukan_forum_categories (
  id, name, slug, description, icon, color, position, created_at, updated_at
)
VALUES
  ('core-cat-umkm', 'UMKM & Bisnis', 'umkm-bisnis',
   'Tempat bertanya, berbagi pengalaman, dan membangun usaha bareng.',
   'community', '#10b981', 900, now(), now()),
  ('core-cat-supplier', 'Supplier & Sourcing', 'supplier-sourcing',
   'Cari supplier, bahan, alat, packaging, dan pengalaman sourcing.',
   'shopping', '#6366f1', 901, now(), now()),
  ('core-cat-operasional', 'Operasional Usaha', 'operasional-usaha',
   'Diskusi stok, proses kerja, tim, dan rutinitas operasional.',
   'briefcase', '#f59e0b', 902, now(), now()),
  ('core-cat-marketing', 'Marketing & Growth', 'marketing-growth',
   'Bahas promosi, konten, branding, pelanggan, dan pertumbuhan.',
   'sparkles', '#ef4444', 903, now(), now()),
  ('core-cat-help', 'Tanya & Bantu', 'tanya-bantu',
   'Tempat bertanya dan membantu sesama pelaku usaha.',
   'help', '#0ea5e9', 904, now(), now())
ON CONFLICT (slug) DO NOTHING;

INSERT INTO forum.lajukan_groups (
  id,
  category_id,
  name,
  slug,
  description,
  privacy,
  posting_permission,
  membership_permission,
  cover_url,
  rules,
  created_by_user_id,
  status,
  created_at,
  updated_at
)
VALUES
  ('core-group-umkm', 'core-cat-umkm', 'UMKM & Bisnis', 'umkm-bisnis',
   'Ruang ngobrol pelaku usaha untuk tanya, berbagi pengalaman, dan cari solusi praktis.',
   'public', 'member', 'open', NULL,
   ARRAY['Jaga diskusi tetap relevan dengan usaha.',
         'Bagikan pengalaman dan konteks yang jelas.',
         'Hindari spam dan klaim yang menyesatkan.'],
   'system-lajukan-community', 'active', now(), now()),
  ('core-group-supplier', 'core-cat-supplier', 'Supplier & Sourcing', 'supplier-sourcing',
   'Cari supplier, bahan, alat, packaging, dan rekomendasi sourcing dari pengalaman nyata.',
   'public', 'member', 'open', NULL,
   ARRAY['Sebutkan konteks kebutuhan agar rekomendasi lebih berguna.',
         'Jaga kualitas dan kejujuran informasi supplier.',
         'Jangan spam promosi berulang.'],
   'system-lajukan-community', 'active', now(), now()),
  ('core-group-operasional', 'core-cat-operasional', 'Operasional Usaha', 'operasional-usaha',
   'Diskusi stok, tim, proses kerja, pricing, dan rutinitas operasional.',
   'public', 'member', 'open', NULL,
   ARRAY['Utamakan solusi yang bisa dipraktikkan.',
         'Jaga data bisnis yang bersifat sensitif.',
         'Berikan konteks sebelum menyimpulkan.'],
   'system-lajukan-community', 'active', now(), now()),
  ('core-group-marketing', 'core-cat-marketing', 'Marketing & Growth', 'marketing-growth',
   'Bahas promosi, konten, branding, pelanggan, dan cara bertumbuh.',
   'public', 'member', 'open', NULL,
   ARRAY['Bagikan hasil dan pelajaran, bukan spam.',
         'Hormati eksperimen dan sudut pandang anggota lain.',
         'Jangan mengklaim hasil tanpa konteks.'],
   'system-lajukan-community', 'active', now(), now()),
  ('core-group-help', 'core-cat-help', 'Tanya & Bantu', 'tanya-bantu',
   'Tempat bertanya dan membantu sesama pelaku usaha dari masalah kecil sampai besar.',
   'public', 'member', 'open', NULL,
   ARRAY['Jelaskan masalah dengan konteks secukupnya.',
         'Jawab dengan sopan dan konstruktif.',
         'Tandai solusi yang sudah terbukti membantu.'],
   'system-lajukan-community', 'active', now(), now())
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    privacy = EXCLUDED.privacy,
    posting_permission = EXCLUDED.posting_permission,
    membership_permission = EXCLUDED.membership_permission,
    rules = EXCLUDED.rules,
    status = 'active',
    updated_at = now();

INSERT INTO forum.lajukan_group_members (
  group_id, user_id, role, status, joined_at, updated_at
)
SELECT group_id, 'system-lajukan-community', 'owner', 'active', now(), now()
FROM (
  VALUES
    ('core-group-umkm'),
    ('core-group-supplier'),
    ('core-group-operasional'),
    ('core-group-marketing'),
    ('core-group-help')
) AS groups(group_id)
ON CONFLICT (group_id, user_id) DO UPDATE
SET role = 'owner',
    status = 'active',
    updated_at = now();
