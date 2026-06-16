SET search_path = forum, reel, public, events;

CREATE TABLE IF NOT EXISTS lajukan_groups (
  id text PRIMARY KEY,
  category_id text NOT NULL UNIQUE REFERENCES lajukan_forum_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  privacy text NOT NULL DEFAULT 'public' CHECK (privacy IN ('public', 'private', 'hidden')),
  posting_permission text NOT NULL DEFAULT 'member' CHECK (
    posting_permission IN ('public', 'member', 'moderator')
  ),
  membership_permission text NOT NULL DEFAULT 'open' CHECK (
    membership_permission IN ('open', 'approval', 'invite')
  ),
  cover_url text NULL,
  rules text [] NOT NULL DEFAULT '{}',
  created_by_user_id text NULL REFERENCES lajukan_forum_users(id) ON DELETE
  SET NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'blocked')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lajukan_groups_discovery_idx ON lajukan_groups (status, privacy, updated_at DESC);
CREATE INDEX IF NOT EXISTS lajukan_groups_search_idx ON lajukan_groups USING gin (
  to_tsvector(
    'simple',
    coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(slug, '')
  )
);
CREATE TABLE IF NOT EXISTS lajukan_group_members (
  group_id text NOT NULL REFERENCES lajukan_groups(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES lajukan_forum_users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'moderator', 'member')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'blocked')),
  notifications_enabled boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS lajukan_group_members_user_idx ON lajukan_group_members (user_id, status, updated_at DESC);
INSERT INTO lajukan_groups (
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
SELECT 'g-' || c.id,
  c.id,
  c.name,
  c.slug,
  c.description,
  'public',
  'public',
  'open',
  NULL,
  ARRAY [
    'Jaga diskusi tetap relevan dengan usaha.',
    'Dilarang spam dan ajakan transaksi berisiko di luar platform.',
    'Bagikan pengalaman nyata, bukan klaim kosong.'
  ],
  'u-1',
  'active',
  c.created_at,
  now()
FROM forum.lajukan_forum_categories c ON CONFLICT (category_id) DO NOTHING;
INSERT INTO lajukan_group_members (
    group_id,
    user_id,
    role,
    status,
    joined_at,
    updated_at
  )
SELECT g.id,
  u.id,
  CASE
    WHEN u.id = 'u-1' THEN 'owner'
    ELSE 'member'
  END,
  'active',
  now(),
  now()
FROM lajukan_groups g
  CROSS JOIN lajukan_forum_users u
WHERE g.slug IN (
    'announcements',
    'product-ux',
    'marketplace-projects',
    'community-events',
    'support-help'
  ) ON CONFLICT (group_id, user_id) DO NOTHING;
