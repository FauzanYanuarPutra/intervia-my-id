-- Irreversible by design: deleted demo identities and credentials must not be
-- recreated by a rollback. Structural roles and permissions were never removed.
SELECT 1;
