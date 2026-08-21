-- SECURITY / PRIVACY ROLLBACK POLICY
--
-- Deliberately keep the privacy-safe opt-in default on rollback.
-- Re-enabling memory by default would silently expand data processing for
-- newly-created agents. If product policy ever changes, do it in a new,
-- explicitly-reviewed forward migration instead of a rollback.

ALTER TABLE public.personal_ai_agents
  ALTER COLUMN memory_enabled SET DEFAULT FALSE;