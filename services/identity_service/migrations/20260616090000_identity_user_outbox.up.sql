SET search_path = core, identity, public, events, audit;

CREATE TABLE IF NOT EXISTS events.event_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  routing_key text NOT NULL,
  payload jsonb NOT NULL,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'publishing', 'published', 'failed')),
  retry_count integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz NULL,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_identity_event_outbox_pending
  ON events.event_outbox (status, available_at, created_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_identity_event_outbox_aggregate
  ON events.event_outbox (aggregate_type, aggregate_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.enqueue_identity_user_event() RETURNS trigger AS $$
DECLARE
  event_payload jsonb;
  aggregate_id text;
  action_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    event_payload := to_jsonb(OLD);
    IF TG_TABLE_NAME = 'user_profiles' THEN
      aggregate_id := OLD.user_id::text;
    ELSE
      aggregate_id := OLD.id::text;
    END IF;
  ELSE
    event_payload := to_jsonb(NEW);
    IF TG_TABLE_NAME = 'user_profiles' THEN
      aggregate_id := NEW.user_id::text;
    ELSE
      aggregate_id := NEW.id::text;
    END IF;
  END IF;

  action_name := CASE TG_OP
    WHEN 'INSERT' THEN 'created'
    WHEN 'UPDATE' THEN 'updated'
    WHEN 'DELETE' THEN 'deleted'
    ELSE lower(TG_OP)
  END;

  INSERT INTO events.event_outbox (
    aggregate_type,
    aggregate_id,
    event_type,
    routing_key,
    payload,
    headers
  )
  VALUES (
    'identity.user',
    aggregate_id,
    CASE
      WHEN TG_TABLE_NAME = 'user_profiles' THEN 'identity.user_profile.' || action_name
      ELSE 'identity.user.' || action_name
    END,
    'identity.user.' || action_name,
    jsonb_build_object(
      'schema_version', 1,
      'source', 'identity_service',
      'table', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
      'operation', TG_OP,
      'user_id', aggregate_id,
      'data', event_payload
    ),
    jsonb_build_object('content_type', 'application/json')
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_identity_users_outbox ON core.users;
CREATE TRIGGER trg_identity_users_outbox
AFTER INSERT OR UPDATE OR DELETE ON core.users
FOR EACH ROW EXECUTE FUNCTION public.enqueue_identity_user_event();

DROP TRIGGER IF EXISTS trg_identity_user_profiles_outbox ON core.user_profiles;
CREATE TRIGGER trg_identity_user_profiles_outbox
AFTER INSERT OR UPDATE OR DELETE ON core.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.enqueue_identity_user_event();
