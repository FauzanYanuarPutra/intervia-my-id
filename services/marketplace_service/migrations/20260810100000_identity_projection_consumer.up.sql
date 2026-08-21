-- Lajukan Marketplace
-- Identity projection consumer hardening.
--
-- Goals:
--   1. Keep only minimum identity facts required by marketplace authorization.
--   2. Do not replicate raw email/phone values into the marketplace read model.
--   3. Keep independent monotonic guards for core.users and core.user_profiles.
--   4. Fail closed until an authoritative identity user event arrives.
--
-- IMPORTANT:
-- This migration intentionally scrubs contact values and arbitrary profile
-- metadata from users_read_model. Those values cannot be reconstructed by DOWN.

SET search_path = public, events;

ALTER TABLE public.users_read_model
  ADD COLUMN IF NOT EXISTS identity_has_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_has_phone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_user_email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_user_phone_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_user_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_user_updated_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS identity_user_event_id uuid NULL,
  ADD COLUMN IF NOT EXISTS identity_user_operation text NULL,
  ADD COLUMN IF NOT EXISTS identity_profile_updated_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS identity_profile_event_id uuid NULL,
  ADD COLUMN IF NOT EXISTS identity_profile_operation text NULL;

-- Backfill only privacy-safe facts from the legacy projection.
--
-- Do NOT seed identity_user_updated_at / identity_profile_updated_at with the
-- marketplace row timestamp. Leaving them NULL ensures the first authoritative
-- identity event is accepted even when its source timestamp is older than a
-- marketplace-local updated_at value.
UPDATE public.users_read_model
SET
  identity_has_email =
    NULLIF(btrim(COALESCE(email::text, '')), '') IS NOT NULL,

  identity_has_phone =
    length(regexp_replace(COALESCE(phone::text, ''), '[^0-9]', '', 'g')) >= 8,

  identity_user_email_verified = COALESCE(email_verified, false),
  identity_user_phone_verified = COALESCE(phone_verified, false),

  -- Fail closed until core.users has been projected by the consumer.
  identity_user_active = false,

  -- Raw contact values are deliberately not part of the marketplace projection.
  email = NULL,
  phone = NULL,

  -- Retain only the normalized verification envelope. Arbitrary profile
  -- metadata must come from its owning service, not this cross-service read model.
  metadata = jsonb_build_object(
    'verification',
    jsonb_build_object(
      'email_verified', COALESCE(email_verified, false),
      'phone_verified', COALESCE(phone_verified, false),

      'document_verified',
        lower(COALESCE(metadata #>> '{verification,document_verified}', 'false'))
          IN ('true', '1', 'yes'),

      'liveness_verified',
        lower(COALESCE(metadata #>> '{verification,liveness_verified}', 'false'))
          IN ('true', '1', 'yes'),

      'identity_verified', COALESCE(identity_verified, false),

      -- Eligibility is intentionally reset and must be recomputed from fresh
      -- identity facts by the projection consumer.
      'transaction_eligible', false,

      'kyc_status',
        CASE
          WHEN lower(COALESCE(metadata #>> '{verification,kyc_status}', ''))
                 IN ('none', 'basic', 'full', 'enhanced')
            THEN lower(metadata #>> '{verification,kyc_status}')
          WHEN COALESCE(identity_verified, false)
            THEN 'basic'
          ELSE 'none'
        END
    )
  ),

  transaction_eligible = false;

COMMENT ON COLUMN public.users_read_model.identity_has_email IS
  'Contact-presence fact from identity_service; raw email is deliberately not projected.';

COMMENT ON COLUMN public.users_read_model.identity_has_phone IS
  'Contact-presence fact from identity_service; raw phone is deliberately not projected.';

COMMENT ON COLUMN public.users_read_model.identity_user_email_verified IS
  'Latest projected email-verification fact from identity_service core.users.';

COMMENT ON COLUMN public.users_read_model.identity_user_phone_verified IS
  'Latest projected phone-verification fact from identity_service core.users.';

COMMENT ON COLUMN public.users_read_model.identity_user_active IS
  'Latest projected active/deactivated state from identity_service core.users.';

COMMENT ON COLUMN public.users_read_model.identity_user_updated_at IS
  'Latest applied core.users source timestamp; per-source monotonic/out-of-order guard.';

COMMENT ON COLUMN public.users_read_model.identity_user_event_id IS
  'Event id associated with the latest applied core.users projection.';

COMMENT ON COLUMN public.users_read_model.identity_user_operation IS
  'Operation associated with the latest applied core.users projection.';

COMMENT ON COLUMN public.users_read_model.identity_profile_updated_at IS
  'Latest applied core.user_profiles source timestamp; per-source monotonic/out-of-order guard.';

COMMENT ON COLUMN public.users_read_model.identity_profile_event_id IS
  'Event id associated with the latest applied core.user_profiles projection.';

COMMENT ON COLUMN public.users_read_model.identity_profile_operation IS
  'Operation associated with the latest applied core.user_profiles projection.';

-- Claim-path index for the identity projection inbox worker. `source` and
-- `status` are constants in the partial predicate, so they do not need to be
-- repeated as leading index keys.
CREATE INDEX IF NOT EXISTS idx_identity_event_inbox_claim
  ON events.event_inbox (available_at, received_at)
  WHERE source = 'identity_service'
    AND status IN ('pending', 'failed', 'processing');

-- Hot authorization path: only rows that are already eligible are indexed.
CREATE INDEX IF NOT EXISTS idx_users_read_model_transaction_eligible
  ON public.users_read_model (user_id)
  WHERE transaction_eligible = true
    AND status = 'active'
    AND identity_deleted_at IS NULL;