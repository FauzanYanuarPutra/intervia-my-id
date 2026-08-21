-- Lajukan Personal AI
-- Privacy policy: memory is opt-in for newly-created agents.
--
-- This changes only the DEFAULT. Existing rows keep their current explicit
-- memory_enabled value.

ALTER TABLE public.personal_ai_agents
  ALTER COLUMN memory_enabled SET DEFAULT FALSE;

COMMENT ON COLUMN public.personal_ai_agents.memory_enabled IS
  'Owner-controlled Personal AI memory switch. New agents default to opt-out/false; viewer consent is tracked separately.';