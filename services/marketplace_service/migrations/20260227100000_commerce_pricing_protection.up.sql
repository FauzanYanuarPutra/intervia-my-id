-- Pricing enrichment for listings and protection metadata for transactions.

ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS pricing_mode TEXT NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS original_price_cents BIGINT,
  ADD COLUMN IF NOT EXISTS promo_label TEXT,
  ADD COLUMN IF NOT EXISTS promo_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promo_end_at TIMESTAMPTZ;

UPDATE content_items
SET pricing_mode = 'request'
WHERE pricing_mode = 'fixed'
  AND COALESCE(price_cents, 0) <= 0;

DO $$
BEGIN
  ALTER TABLE content_items DROP CONSTRAINT IF EXISTS chk_content_items_pricing_mode;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE content_items
    ADD CONSTRAINT chk_content_items_pricing_mode
    CHECK (pricing_mode IN ('fixed', 'request'))
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE content_items DROP CONSTRAINT IF EXISTS chk_content_items_price_hierarchy;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE content_items
    ADD CONSTRAINT chk_content_items_price_hierarchy
    CHECK (
      original_price_cents IS NULL
      OR original_price_cents <= 0
      OR price_cents IS NULL
      OR price_cents <= 0
      OR original_price_cents >= price_cents
    )
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE content_items DROP CONSTRAINT IF EXISTS chk_content_items_promo_window;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE content_items
    ADD CONSTRAINT chk_content_items_promo_window
    CHECK (
      promo_start_at IS NULL
      OR promo_end_at IS NULL
      OR promo_end_at >= promo_start_at
    )
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_content_pricing_mode ON content_items(pricing_mode);
CREATE INDEX IF NOT EXISTS idx_content_promo_window ON content_items(promo_start_at, promo_end_at);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS protection_status TEXT NOT NULL DEFAULT 'awaiting_funding',
  ADD COLUMN IF NOT EXISTS snapshot_listing JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS safety_checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS risk_flags JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE transactions
SET protection_status = CASE transaction_status
  WHEN 'pending' THEN 'awaiting_funding'
  WHEN 'accepted' THEN 'funds_held'
  WHEN 'in_progress' THEN 'funds_held'
  WHEN 'delivered' THEN 'on_hold'
  WHEN 'completed' THEN 'released'
  WHEN 'cancelled' THEN 'refunded'
  WHEN 'disputed' THEN 'on_hold'
  ELSE protection_status
END;

UPDATE transactions t
SET snapshot_listing = jsonb_strip_nulls(
  jsonb_build_object(
    'content_id', c.id,
    'title', c.title,
    'slug', c.slug,
    'content_type', c.content_type,
    'cover_image', c.cover_image,
    'location', COALESCE(c.metadata->>'location', c.metadata->>'city', c.metadata->>'region'),
    'pricing_mode', c.pricing_mode,
    'price_cents', c.price_cents,
    'original_price_cents', c.original_price_cents,
    'promo_label', c.promo_label,
    'currency', c.currency
  )
)
FROM content_items c
WHERE t.content_id = c.id
  AND (t.snapshot_listing IS NULL OR t.snapshot_listing = '{}'::jsonb);

DO $$
BEGIN
  ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_transactions_protection_status;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE transactions
    ADD CONSTRAINT chk_transactions_protection_status
    CHECK (
      protection_status IN (
        'awaiting_funding',
        'funds_held',
        'on_hold',
        'released',
        'refunded'
      )
    )
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_protection_status ON transactions(protection_status);
CREATE INDEX IF NOT EXISTS idx_transactions_snapshot_gin ON transactions USING GIN(snapshot_listing);

SELECT 1;
