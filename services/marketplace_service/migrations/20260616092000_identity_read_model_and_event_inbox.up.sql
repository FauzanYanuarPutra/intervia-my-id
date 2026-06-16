SET search_path = public, events;

CREATE TABLE IF NOT EXISTS users_read_model (
  user_id uuid PRIMARY KEY,
  email citext NULL,
  phone text NULL,
  username citext NULL,
  full_name text NULL,
  avatar_url text NULL,
  email_verified boolean NOT NULL DEFAULT false,
  phone_verified boolean NOT NULL DEFAULT false,
  identity_verified boolean NOT NULL DEFAULT false,
  transaction_eligible boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  identity_version bigint NOT NULL DEFAULT 0,
  identity_updated_at timestamptz NULL,
  identity_deleted_at timestamptz NULL,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_read_model_email ON users_read_model (email);
CREATE INDEX IF NOT EXISTS idx_users_read_model_phone ON users_read_model (phone);
CREATE INDEX IF NOT EXISTS idx_users_read_model_username ON users_read_model (username);
CREATE INDEX IF NOT EXISTS idx_users_read_model_search ON users_read_model USING gin (
  to_tsvector('simple', coalesce(full_name, '') || ' ' || coalesce(username::text, '') || ' ' || coalesce(email::text, ''))
);

CREATE TABLE IF NOT EXISTS events.event_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  retry_count integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL,
  error_message text NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, event_id)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_event_inbox_pending
  ON events.event_inbox (status, available_at, received_at)
  WHERE status IN ('pending', 'failed');
