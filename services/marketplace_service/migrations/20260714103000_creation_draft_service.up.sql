CREATE TABLE IF NOT EXISTS creation_drafts (
  id text PRIMARY KEY,
  owner_id uuid NOT NULL,
  target text NOT NULL CHECK (
    target IN (
      'offering_listing',
      'looking_for_listing',
      'business_profile',
      'community_post',
      'reel',
      'business_opportunity',
      'job_listing'
    )
  ),
  status text NOT NULL DEFAULT 'ready' CHECK (
    status IN ('generating', 'ready', 'editing', 'consumed', 'expired', 'discarded')
  ),
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
  draft_version integer NOT NULL DEFAULT 1 CHECK (draft_version >= 1),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  field_metadata jsonb NOT NULL DEFAULT '[]'::jsonb,
  title text NOT NULL,
  summary text NULL,
  completeness_score integer NOT NULL DEFAULT 0 CHECK (
    completeness_score BETWEEN 0 AND 100
  ),
  missing_required_fields text[] NOT NULL DEFAULT ARRAY[]::text[],
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_conversation_id text NULL,
  created_by text NOT NULL DEFAULT 'ai' CHECK (created_by IN ('ai', 'user', 'admin')),
  idempotency_key text NULL,
  resource_id text NULL,
  resource_url text NULL,
  expires_at timestamptz NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  consumed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CHECK (id ~ '^drf_[a-f0-9]{32}$'),
  CHECK (jsonb_typeof(payload) = 'object'),
  CHECK (jsonb_typeof(media) = 'array'),
  CHECK (jsonb_typeof(field_metadata) = 'array'),
  CHECK (jsonb_typeof(warnings) = 'array')
);

CREATE TABLE IF NOT EXISTS creation_draft_versions (
  draft_id text NOT NULL REFERENCES creation_drafts(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version >= 1),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by text NOT NULL CHECK (updated_by IN ('ai', 'user', 'admin')),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (draft_id, version)
);

CREATE INDEX IF NOT EXISTS idx_creation_drafts_owner_status_updated
  ON creation_drafts (owner_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_creation_drafts_active_expiry
  ON creation_drafts (expires_at)
  WHERE status IN ('generating', 'ready', 'editing');

CREATE UNIQUE INDEX IF NOT EXISTS idx_creation_drafts_owner_idempotency
  ON creation_drafts (owner_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

