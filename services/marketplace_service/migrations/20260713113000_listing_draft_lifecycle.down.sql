DROP INDEX IF EXISTS idx_content_items_attributes_gin;
DROP INDEX IF EXISTS idx_content_items_draft_idempotency;
DROP INDEX IF EXISTS idx_content_items_public_listing_status;
DROP INDEX IF EXISTS idx_content_items_owner_draft_status;

ALTER TABLE content_items
  DROP COLUMN IF EXISTS draft_idempotency_key,
  DROP COLUMN IF EXISTS business_profile_id,
  DROP COLUMN IF EXISTS contact_snapshot,
  DROP COLUMN IF EXISTS attributes,
  DROP COLUMN IF EXISTS published_at,
  DROP COLUMN IF EXISTS last_saved_at,
  DROP COLUMN IF EXISTS draft_version,
  DROP COLUMN IF EXISTS completion_percentage,
  DROP COLUMN IF EXISTS listing_status,
  DROP COLUMN IF EXISTS current_step,
  DROP COLUMN IF EXISTS listing_intent;
