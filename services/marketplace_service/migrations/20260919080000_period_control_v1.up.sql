BEGIN;

CREATE TABLE business_accounting_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'closed' CHECK (status IN ('open','closed')),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  closed_by_user_id UUID NULL,
  closed_at TIMESTAMPTZ NULL,
  close_reason TEXT NULL CHECK (close_reason IS NULL OR char_length(btrim(close_reason)) BETWEEN 1 AND 2000),
  reopened_by_user_id UUID NULL,
  reopened_at TIMESTAMPTZ NULL,
  reopen_reason TEXT NULL CHECK (reopen_reason IS NULL OR char_length(btrim(reopen_reason)) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_accounting_periods_scope
    FOREIGN KEY (business_id,organization_id)
    REFERENCES businesses(id,organization_id)
    ON DELETE CASCADE,
  CONSTRAINT ck_business_accounting_periods_range
    CHECK (period_end >= period_start),
  CONSTRAINT ck_business_accounting_periods_state
    CHECK (
      (status='closed' AND closed_by_user_id IS NOT NULL AND closed_at IS NOT NULL AND close_reason IS NOT NULL)
      OR status='open'
    ),
  UNIQUE (id,business_id,organization_id),
  UNIQUE (business_id,period_start,period_end)
);

CREATE INDEX idx_business_accounting_periods_closed
  ON business_accounting_periods (business_id,organization_id,period_start,period_end)
  WHERE status='closed';

CREATE TABLE business_day_closes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  location_id UUID NOT NULL,
  business_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'closed' CHECK (status IN ('open','closed')),
  close_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(close_snapshot)='object'),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  closed_by_user_id UUID NULL,
  closed_at TIMESTAMPTZ NULL,
  close_reason TEXT NULL CHECK (close_reason IS NULL OR char_length(btrim(close_reason)) BETWEEN 1 AND 2000),
  reopened_by_user_id UUID NULL,
  reopened_at TIMESTAMPTZ NULL,
  reopen_reason TEXT NULL CHECK (reopen_reason IS NULL OR char_length(btrim(reopen_reason)) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_day_closes_location_scope
    FOREIGN KEY (location_id,business_id,organization_id)
    REFERENCES business_locations(id,business_id,organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT ck_business_day_closes_state
    CHECK (
      (status='closed' AND closed_by_user_id IS NOT NULL AND closed_at IS NOT NULL AND close_reason IS NOT NULL)
      OR status='open'
    ),
  UNIQUE (id,business_id,organization_id),
  UNIQUE (location_id,business_date)
);

CREATE INDEX idx_business_day_closes_closed
  ON business_day_closes (business_id,organization_id,location_id,business_date)
  WHERE status='closed';

CREATE TABLE business_close_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  idempotency_key UUID NOT NULL,
  request_hash CHAR(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  command_type TEXT NOT NULL CHECK (command_type IN (
    'close_period','reopen_period','close_day','reopen_day'
  )),
  target_type TEXT NOT NULL CHECK (target_type IN ('accounting_period','business_day')),
  target_id UUID NOT NULL,
  actor_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_close_commands_scope
    FOREIGN KEY (business_id,organization_id)
    REFERENCES businesses(id,organization_id)
    ON DELETE CASCADE,
  UNIQUE (business_id,idempotency_key)
);

CREATE INDEX idx_business_close_commands_target
  ON business_close_commands (business_id,organization_id,target_type,target_id,created_at DESC);

CREATE TABLE business_close_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('accounting_period','business_day')),
  target_id UUID NOT NULL,
  from_status TEXT NULL CHECK (from_status IS NULL OR from_status IN ('open','closed')),
  to_status TEXT NOT NULL CHECK (to_status IN ('open','closed')),
  reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 2000),
  actor_user_id UUID NOT NULL,
  command_id UUID NOT NULL UNIQUE REFERENCES business_close_commands(id) ON DELETE RESTRICT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_close_events_scope
    FOREIGN KEY (business_id,organization_id)
    REFERENCES businesses(id,organization_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_business_close_events_target
  ON business_close_events (business_id,organization_id,target_type,target_id,created_at,id);

CREATE TRIGGER trg_business_close_commands_append_only
BEFORE UPDATE OR DELETE ON business_close_commands
FOR EACH ROW EXECUTE FUNCTION reject_branch_inventory_evidence_mutation();

CREATE TRIGGER trg_business_close_events_append_only
BEFORE UPDATE OR DELETE ON business_close_events
FOR EACH ROW EXECUTE FUNCTION reject_branch_inventory_evidence_mutation();

COMMIT;
