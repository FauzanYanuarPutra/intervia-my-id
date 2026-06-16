CREATE TABLE IF NOT EXISTS sectors (
  id TEXT PRIMARY KEY,
  name_id TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_id TEXT NULL,
  description_en TEXT NULL,
  color TEXT NULL,
  icon_key TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sectors_active ON sectors(is_active);
CREATE INDEX IF NOT EXISTS idx_sectors_sort ON sectors(sort_order, name_en);

CREATE TABLE IF NOT EXISTS banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  image_url TEXT NULL,
  link_url TEXT NULL,
  headline TEXT NULL,
  subheadline TEXT NULL,
  start_at TIMESTAMPTZ NULL,
  end_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banners_location ON banners(location);
CREATE INDEX IF NOT EXISTS idx_banners_status ON banners(status);
CREATE INDEX IF NOT EXISTS idx_banners_active_window ON banners(start_at, end_at);
