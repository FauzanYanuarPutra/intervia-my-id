-- Lajukan Marketplace
-- Roll back schema/index additions from identity projection consumer hardening.
--
-- DATA-LOSS NOTE:
-- The UP migration intentionally scrubbed raw email, phone and arbitrary
-- metadata from users_read_model. DOWN cannot reconstruct those values.

SET search_path = public, events;

DROP INDEX IF EXISTS public.idx_users_read_model_transaction_eligible;
DROP INDEX IF EXISTS events.idx_identity_event_inbox_claim;

ALTER TABLE public.users_read_model
  DROP COLUMN IF EXISTS identity_profile_operation,
  DROP COLUMN IF EXISTS identity_profile_event_id,
  DROP COLUMN IF EXISTS identity_profile_updated_at,
  DROP COLUMN IF EXISTS identity_user_operation,
  DROP COLUMN IF EXISTS identity_user_event_id,
  DROP COLUMN IF EXISTS identity_user_updated_at,
  DROP COLUMN IF EXISTS identity_user_active,
  DROP COLUMN IF EXISTS identity_user_phone_verified,
  DROP COLUMN IF EXISTS identity_user_email_verified,
  DROP COLUMN IF EXISTS identity_has_phone,
  DROP COLUMN IF EXISTS identity_has_email;