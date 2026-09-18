-- Converge canonical Business OS order events onto the Marketplace transactional outbox.
-- The legacy public.outbox_events table is retained for rollback compatibility during
-- the expand/contract window, but new application code writes events.event_outbox.

ALTER TABLE events.event_outbox
  ADD COLUMN IF NOT EXISTS event_key TEXT NULL;

DO $$
BEGIN
  ALTER TABLE events.event_outbox
    ADD CONSTRAINT uq_event_outbox_event_key UNIQUE (event_key);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Preserve any durable order events created before this migration that have not
-- yet been published by copying them into the canonical publisher queue.
INSERT INTO events.event_outbox (
  aggregate_type,
  aggregate_id,
  event_type,
  payload,
  routing_key,
  status,
  retry_count,
  available_at,
  published_at,
  error_message,
  created_at,
  event_key
)
SELECT
  legacy.aggregate_type,
  legacy.aggregate_id::text,
  legacy.event_type,
  legacy.payload,
  legacy.event_type,
  'pending',
  0,
  NOW(),
  NULL,
  NULL,
  legacy.created_at,
  legacy.event_key
FROM public.outbox_events AS legacy
WHERE legacy.published_at IS NULL
ON CONFLICT (event_key) DO NOTHING;

-- An older application release may be restored while this expand migration
-- remains applied. Mirror those legacy writes transactionally so rollback does
-- not silently strand Business OS events outside the active publisher.
CREATE OR REPLACE FUNCTION events.mirror_legacy_order_outbox_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO events.event_outbox (
    aggregate_type,
    aggregate_id,
    event_type,
    payload,
    routing_key,
    status,
    retry_count,
    available_at,
    created_at,
    event_key
  )
  VALUES (
    NEW.aggregate_type,
    NEW.aggregate_id::text,
    NEW.event_type,
    NEW.payload,
    NEW.event_type,
    'pending',
    0,
    NOW(),
    NEW.created_at,
    NEW.event_key
  )
  ON CONFLICT (event_key) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mirror_legacy_order_outbox_event
  ON public.outbox_events;

CREATE TRIGGER trg_mirror_legacy_order_outbox_event
AFTER INSERT ON public.outbox_events
FOR EACH ROW
EXECUTE FUNCTION events.mirror_legacy_order_outbox_event();
