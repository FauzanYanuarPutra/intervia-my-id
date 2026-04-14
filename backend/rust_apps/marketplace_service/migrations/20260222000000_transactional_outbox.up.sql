CREATE TABLE IF NOT EXISTS event_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  routing_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INT NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ NULL,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_outbox_pending
  ON event_outbox(status, available_at, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_event_outbox_aggregate
  ON event_outbox(aggregate_type, aggregate_id, created_at DESC);

CREATE OR REPLACE FUNCTION enqueue_marketplace_outbox_event()
RETURNS TRIGGER AS $$
DECLARE
  event_payload JSONB;
  event_aggregate_id TEXT;
  event_type_value TEXT;
  event_routing_key TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    event_payload := to_jsonb(OLD);
  ELSE
    event_payload := to_jsonb(NEW);
  END IF;

  event_aggregate_id := COALESCE(event_payload->>'id', 'unknown');
  event_type_value := format('%s.%s', lower(TG_TABLE_NAME), lower(TG_OP));

  IF TG_TABLE_NAME = 'content_items' THEN
    event_routing_key := 'search.content.sync';
  ELSIF TG_TABLE_NAME = 'transactions' OR TG_TABLE_NAME = 'reviews' THEN
    event_routing_key := 'search.transaction.sync';
  ELSE
    event_routing_key := 'search.generic.sync';
  END IF;

  INSERT INTO event_outbox (
    aggregate_type,
    aggregate_id,
    event_type,
    payload,
    routing_key
  )
  VALUES (
    lower(TG_TABLE_NAME),
    event_aggregate_id,
    event_type_value,
    event_payload,
    event_routing_key
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_outbox_content_items ON content_items;
CREATE TRIGGER trg_outbox_content_items
AFTER INSERT OR UPDATE OR DELETE ON content_items
FOR EACH ROW
EXECUTE FUNCTION enqueue_marketplace_outbox_event();

DROP TRIGGER IF EXISTS trg_outbox_transactions ON transactions;
CREATE TRIGGER trg_outbox_transactions
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW
EXECUTE FUNCTION enqueue_marketplace_outbox_event();

DROP TRIGGER IF EXISTS trg_outbox_reviews ON reviews;
CREATE TRIGGER trg_outbox_reviews
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW
EXECUTE FUNCTION enqueue_marketplace_outbox_event();
