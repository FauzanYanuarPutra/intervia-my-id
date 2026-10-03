SET search_path = forum, reel, public, events;

-- Only restore NOT NULL when no non-reel actions remain. This keeps rollback
-- explicit instead of silently deleting or rewriting follow rows.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM lajukan_reel_user_actions
    WHERE reel_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot restore reel_id NOT NULL while user-to-user actions exist';
  END IF;

  ALTER TABLE lajukan_reel_user_actions
    ALTER COLUMN reel_id SET NOT NULL;
END $$;
