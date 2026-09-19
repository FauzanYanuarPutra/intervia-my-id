BEGIN;
DROP TABLE IF EXISTS internal_moderation.content_appeals;
DROP TABLE IF EXISTS internal_moderation.content_moderation_events;
DROP TABLE IF EXISTS internal_moderation.content_moderation_cases;
DROP TABLE IF EXISTS internal_moderation.content_reports;
DROP FUNCTION IF EXISTS internal_moderation.prevent_event_mutation();
DROP FUNCTION IF EXISTS internal_moderation.touch_updated_at();
COMMIT;