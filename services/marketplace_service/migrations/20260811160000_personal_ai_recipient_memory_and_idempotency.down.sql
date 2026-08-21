-- Lajukan Personal AI
-- Remove recipient consent + idempotency structures introduced by UP.

DROP TRIGGER IF EXISTS personal_ai_chat_requests_touch_updated_at
    ON public.personal_ai_chat_requests;

DROP TRIGGER IF EXISTS personal_ai_memory_preferences_touch_updated_at
    ON public.personal_ai_memory_preferences;

DROP INDEX IF EXISTS public.personal_ai_chat_requests_processing_lease_idx;
DROP INDEX IF EXISTS public.personal_ai_chat_requests_agent_updated_idx;
DROP TABLE IF EXISTS public.personal_ai_chat_requests;

DROP INDEX IF EXISTS public.personal_ai_memory_preferences_viewer_idx;
DROP TABLE IF EXISTS public.personal_ai_memory_preferences;

DROP FUNCTION IF EXISTS public.personal_ai_touch_updated_at();