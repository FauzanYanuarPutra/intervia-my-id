BEGIN;

-- Business Work Orchestration V1
-- Human work sits above canonical sales/inventory/finance sources without
-- duplicating those domains. Work items may link to a source record and use
-- a unique source pair to make recommendation synchronization idempotent.


INSERT INTO business_permissions (permission_key, description) VALUES
  ('work.view', 'View operational work assigned to the business'),
  ('work.manage', 'Create, assign, prioritize and manage operational work')
ON CONFLICT (permission_key) DO NOTHING;

-- Keep the timestamp trigger dependency self-contained and idempotent.
-- This migration is the first consumer of public.update_timestamp() in the
-- current marketplace migration chain, so define it before creating the trigger.
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$;

CREATE TABLE business_work_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  location_id UUID NULL,
  work_type TEXT NOT NULL
    CHECK (work_type IN (
      'restock','stock_check','receive','cash','order','finance',
      'approval','setup','follow_up','custom'
    )),
  title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 240),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo','in_progress','done','snoozed','cancelled')),
  priority SMALLINT NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  assignee_user_id UUID NULL,
  created_by_user_id UUID NOT NULL,
  due_at TIMESTAMPTZ NULL,
  source_type TEXT NULL,
  source_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_business_work_items_business_scope
    FOREIGN KEY (business_id, organization_id)
    REFERENCES businesses(id, organization_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_business_work_items_location_scope
    FOREIGN KEY (location_id, business_id, organization_id)
    REFERENCES business_locations(id, business_id, organization_id)
    ON DELETE RESTRICT,

  CONSTRAINT ck_business_work_items_source_pair
    CHECK ((source_type IS NULL) = (source_id IS NULL)),

  CONSTRAINT ck_business_work_items_completion
    CHECK (
      (status = 'done' AND completed_at IS NOT NULL)
      OR (status <> 'done')
    )
);

CREATE UNIQUE INDEX ux_business_work_items_source
  ON business_work_items (business_id, source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

CREATE INDEX idx_business_work_items_scope
  ON business_work_items (business_id, organization_id, status, priority DESC, due_at, created_at DESC);

CREATE INDEX idx_business_work_items_assignee
  ON business_work_items (business_id, assignee_user_id, status, priority DESC, due_at)
  WHERE assignee_user_id IS NOT NULL;

CREATE INDEX idx_business_work_items_open_source
  ON business_work_items (business_id, source_type, status)
  WHERE source_type IS NOT NULL AND status NOT IN ('done','cancelled');

DROP TRIGGER IF EXISTS business_work_items_update_timestamp ON business_work_items;
CREATE TRIGGER business_work_items_update_timestamp
BEFORE UPDATE ON business_work_items
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE OR REPLACE FUNCTION reject_business_work_item_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'business_work_items are not hard-deleted; cancel the work item instead';
END;
$$;

DROP TRIGGER IF EXISTS business_work_items_no_delete ON business_work_items;
CREATE TRIGGER business_work_items_no_delete
BEFORE DELETE ON business_work_items
FOR EACH ROW EXECUTE FUNCTION reject_business_work_item_hard_delete();

INSERT INTO business_role_permissions (role_id, permission_key)
SELECT role.id, permission.permission_key
FROM business_roles role
JOIN business_permissions permission
  ON permission.permission_key IN ('work.view','work.manage')
WHERE role.role_key = 'owner'
ON CONFLICT DO NOTHING;

COMMIT;