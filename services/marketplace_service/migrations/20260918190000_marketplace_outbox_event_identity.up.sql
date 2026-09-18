ALTER TABLE events.event_outbox
  ADD COLUMN IF NOT EXISTS event_key TEXT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_event_outbox_event_key
  ON events.event_outbox (event_key)
  WHERE event_key IS NOT NULL;
