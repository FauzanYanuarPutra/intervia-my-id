SET search_path = forum, reel, public, events;

DELETE FROM forum.lajukan_reel_user_actions WHERE action = 'not_interested';

ALTER TABLE forum.lajukan_reel_user_actions
  DROP CONSTRAINT IF EXISTS lajukan_reel_user_actions_action_check;

ALTER TABLE forum.lajukan_reel_user_actions
  ADD CONSTRAINT lajukan_reel_user_actions_action_check
  CHECK (action IN ('like', 'save', 'follow'));

DROP TABLE IF EXISTS forum.lajukan_user_blocks;
DROP TABLE IF EXISTS forum.lajukan_trust_reports;
