SET search_path = forum, reel, public, events;

-- Follow actions are user-to-user actions and therefore do not belong to a reel.
-- The original table made reel_id NOT NULL, which caused every profile follow
-- insert (reel_id = NULL) to fail at the database layer.
ALTER TABLE lajukan_reel_user_actions
  ALTER COLUMN reel_id DROP NOT NULL;
