-- Contract rollback is intentionally fail-closed once a canonical-only order
-- event exists. Such an event has no legacy row to recover after dropping event_key.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM events.event_outbox AS canonical
    LEFT JOIN public.outbox_events AS legacy
      ON legacy.event_key = canonical.event_key
    WHERE canonical.event_key IS NOT NULL
      AND legacy.event_key IS NULL
  ) THEN
    RAISE EXCEPTION
      'refusing to remove Business OS outbox convergence after canonical-only events exist';
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_mirror_legacy_order_outbox_event
  ON public.outbox_events;

DROP FUNCTION IF EXISTS events.mirror_legacy_order_outbox_event();

-- Unpublished mirrored rows can safely return to the legacy queue. Published
-- canonical history is retained; dropping event_key only removes the bridge key.
DELETE FROM events.event_outbox AS canonical
USING public.outbox_events AS legacy
WHERE canonical.event_key = legacy.event_key
  AND canonical.published_at IS NULL;

ALTER TABLE events.event_outbox
  DROP CONSTRAINT IF EXISTS uq_event_outbox_event_key,
  DROP COLUMN IF EXISTS event_key;
