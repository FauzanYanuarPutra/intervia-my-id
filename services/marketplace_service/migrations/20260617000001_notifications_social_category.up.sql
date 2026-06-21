-- Allow social activity notifications alongside system/finance/support alerts.

DO $$
BEGIN
  ALTER TABLE user_notifications DROP CONSTRAINT IF EXISTS chk_user_notifications_category;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE user_notifications
    ADD CONSTRAINT chk_user_notifications_category
    CHECK (category IN ('system', 'transaction', 'wallet', 'support', 'security', 'social'))
    NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

SELECT 1;
