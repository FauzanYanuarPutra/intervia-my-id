DROP INDEX IF EXISTS events.uq_marketplace_event_outbox_event_key;

ALTER TABLE events.event_outbox
  DROP COLUMN IF EXISTS event_key;
