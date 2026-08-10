-- Remove disposable development/demo identities without touching RBAC defaults.
-- This migration is intentionally additive: previously applied seed migrations
-- remain immutable, while both existing and freshly-created databases end empty.

SET search_path = core, identity, public, events, audit;

CREATE TEMP TABLE seed_identity_user_targets (
  id uuid PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO seed_identity_user_targets (id)
VALUES
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000004'),
  ('00000000-0000-0000-0000-000000000005'),
  ('00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000102'),
  ('00000000-0000-0000-0000-000000000103'),
  ('00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000000202'),
  ('00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000000401'),
  ('00000000-0000-0000-0000-000000000511'),
  ('00000000-0000-0000-0000-000000000512'),
  ('00000000-0000-0000-0000-000000000513'),
  ('00000000-0000-0000-0000-000000000514'),
  ('00000000-0000-0000-0000-000000000515'),
  ('00000000-0000-0000-0000-000000000516'),
  ('00000000-0000-0000-0000-000000000517'),
  ('00000000-0000-0000-0000-000000000518'),
  ('00000000-0000-0000-0000-000000000701'),
  ('00000000-0000-0000-0000-000000000702'),
  ('00000000-0000-0000-0000-000000000703'),
  ('00000000-0000-0000-0000-000000000704'),
  ('00000000-0000-0000-0000-000000000705'),
  ('00000000-0000-0000-0000-000000000706'),
  ('00000000-0000-0000-0000-000000000707'),
  ('00000000-0000-0000-0000-000000000708'),
  ('00000000-0000-0000-0000-000000000709'),
  ('00000000-0000-0000-0000-000000000710');

-- Older dev_seed code could reuse a non-standard UUID for this exact account.
INSERT INTO seed_identity_user_targets (id)
SELECT u.id
FROM core.users u
JOIN core.user_profiles p ON p.user_id = u.id
WHERE lower(COALESCE(u.email::text, '')) = 'agent@lajukan.com'
  AND p.full_name = 'Lajukan CRM Agent'
  AND (
    SELECT COUNT(DISTINCT r.name)
    FROM core.user_roles ur
    JOIN core.roles r ON r.id = ur.role_id
    WHERE ur.user_id = u.id
      AND r.name IN ('sales', 'support')
  ) = 2
ON CONFLICT DO NOTHING;

-- A demo identity may have been used to create real organization data. Refuse
-- to orphan that data silently; cleanup can resume after ownership is moved.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM core.organizations o
    JOIN seed_identity_user_targets target ON target.id = o.owner_user_id
    WHERE o.deleted_at IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM core.organization_users ou
    JOIN seed_identity_user_targets target ON target.id = ou.user_id
  ) THEN
    RAISE EXCEPTION
      'seed identity cleanup stopped: transfer organization ownership/membership from seeded users first';
  END IF;
END
$$;

-- Prevent old pending create/update events from recreating downstream ghosts.
DELETE FROM events.event_outbox outbox
USING seed_identity_user_targets target
WHERE outbox.aggregate_type = 'identity.user'
  AND outbox.aggregate_id = target.id::text
  AND outbox.status IN ('pending', 'publishing', 'failed');

DELETE FROM core.group_users child
USING seed_identity_user_targets target
WHERE child.user_id = target.id;

DELETE FROM core.sessions child
USING seed_identity_user_targets target
WHERE child.user_id = target.id;

DELETE FROM core.user_identities child
USING seed_identity_user_targets target
WHERE child.user_id = target.id;

DELETE FROM core.user_roles child
USING seed_identity_user_targets target
WHERE child.user_id = target.id;

-- Delete profiles explicitly so the identity outbox emits profile tombstones.
DELETE FROM core.user_profiles child
USING seed_identity_user_targets target
WHERE child.user_id = target.id;

-- The user delete emits the final identity tombstone for read-model consumers.
DELETE FROM core.users child
USING seed_identity_user_targets target
WHERE child.id = target.id;

