-- Business OS: first-class business content/posts.
-- Products/services remain catalog records; posts are public communication owned by a business.

CREATE TABLE business_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  author_user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  caption TEXT NOT NULL DEFAULT '',
  media JSONB NOT NULL DEFAULT '[]'::jsonb,
  published_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_posts_business_scope
    FOREIGN KEY (business_id, organization_id)
    REFERENCES businesses(id, organization_id) ON DELETE CASCADE,
  CONSTRAINT chk_business_posts_caption_length
    CHECK (char_length(caption) <= 5000),
  CONSTRAINT chk_business_posts_media_array
    CHECK (jsonb_typeof(media) = 'array'),
  CONSTRAINT chk_business_posts_publication_state
    CHECK (
      (status = 'published' AND published_at IS NOT NULL)
      OR (status <> 'published')
    ),
  UNIQUE (id, business_id, organization_id)
);

CREATE INDEX idx_business_posts_management
  ON business_posts (business_id, organization_id, updated_at DESC, id DESC);

CREATE INDEX idx_business_posts_public
  ON business_posts (business_id, published_at DESC, id DESC)
  WHERE status = 'published';
