-- Additive lifecycle fields for schema-driven create/edit drafts.
-- Existing public listings remain public through content_status = 'active'.

ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS listing_intent text NULL
    CHECK (listing_intent IS NULL OR listing_intent IN ('offer', 'request')),
  ADD COLUMN IF NOT EXISTS current_step integer NOT NULL DEFAULT 1
    CHECK (current_step BETWEEN 1 AND 20),
  ADD COLUMN IF NOT EXISTS listing_status text NOT NULL DEFAULT 'draft'
    CHECK (listing_status IN ('draft', 'in_review', 'published', 'rejected', 'archived')),
  ADD COLUMN IF NOT EXISTS completion_percentage integer NOT NULL DEFAULT 0
    CHECK (completion_percentage BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS draft_version integer NOT NULL DEFAULT 1
    CHECK (draft_version >= 1),
  ADD COLUMN IF NOT EXISTS last_saved_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS published_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS contact_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS business_profile_id uuid NULL,
  ADD COLUMN IF NOT EXISTS draft_idempotency_key text NULL;

UPDATE content_items
SET
  listing_status = CASE
    WHEN lower(content_status) = 'active' THEN 'published'
    WHEN lower(content_status) = 'paused' THEN 'archived'
    WHEN lower(content_status) = 'archived' THEN 'archived'
    ELSE 'draft'
  END,
  listing_intent = COALESCE(
    listing_intent,
    CASE
      WHEN lower(COALESCE(metadata->>'listing_intent', metadata->>'intent', metadata->>'market_side', metadata->>'listing_side', '')) IN ('request', 'demand', 'need', 'buyer') THEN 'request'
      WHEN lower(COALESCE(metadata->>'listing_intent', metadata->>'intent', metadata->>'market_side', metadata->>'listing_side', '')) IN ('offer', 'supply', 'sell', 'seller') THEN 'offer'
      WHEN pricing_mode = 'request' THEN 'request'
      ELSE 'offer'
    END
  ),
  published_at = CASE
    WHEN lower(content_status) = 'active' AND published_at IS NULL THEN COALESCE(updated_at, created_at)
    ELSE published_at
  END,
  last_saved_at = COALESCE(last_saved_at, updated_at, created_at),
  attributes = CASE
    WHEN attributes <> '{}'::jsonb THEN attributes
    WHEN jsonb_typeof(metadata->'attributes') = 'object' THEN metadata->'attributes'
    ELSE '{}'::jsonb
  END,
  contact_snapshot = CASE
    WHEN contact_snapshot <> '{}'::jsonb THEN contact_snapshot
    WHEN jsonb_typeof(metadata->'contact_snapshot') = 'object' THEN metadata->'contact_snapshot'
    ELSE '{}'::jsonb
  END
WHERE listing_status = 'draft'
   OR listing_intent IS NULL
   OR last_saved_at IS NULL
   OR published_at IS NULL
   OR attributes = '{}'::jsonb
   OR contact_snapshot = '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_content_items_owner_draft_status
  ON content_items (owner_id, listing_status, updated_at DESC)
  WHERE listing_status IN ('draft', 'in_review', 'rejected');

CREATE INDEX IF NOT EXISTS idx_content_items_public_listing_status
  ON content_items (listing_status, updated_at DESC)
  WHERE listing_status = 'published';

CREATE UNIQUE INDEX IF NOT EXISTS idx_content_items_draft_idempotency
  ON content_items (owner_id, draft_idempotency_key)
  WHERE draft_idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_items_attributes_gin
  ON content_items USING GIN (attributes);
