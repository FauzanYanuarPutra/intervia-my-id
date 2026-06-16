-- Super app user trust profile controls.
-- Used by CRM/Ops to set transactional limits and approval stages per user.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS super_app_trust_profiles (
  user_id UUID PRIMARY KEY,
  tier TEXT NOT NULL DEFAULT 'rookie' CHECK (
    tier IN (
      'rookie',
      'verified',
      'trusted_pro',
      'elite',
      'influencer',
      'enterprise'
    )
  ),
  kyc_status TEXT NOT NULL DEFAULT 'none' CHECK (
    kyc_status IN ('none', 'basic', 'full', 'enhanced')
  ),
  crm_approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    crm_approval_status IN ('pending', 'approved', 'rejected', 'restricted')
  ),
  marketing_segment TEXT NOT NULL DEFAULT 'general',
  manual_hold BOOLEAN NOT NULL DEFAULT FALSE,
  manual_per_order_cap_cents BIGINT NULL CHECK (manual_per_order_cap_cents >= 0),
  manual_daily_cap_cents BIGINT NULL CHECK (manual_daily_cap_cents >= 0),
  manual_monthly_cap_cents BIGINT NULL CHECK (manual_monthly_cap_cents >= 0),
  legal_terms_version TEXT NULL,
  legal_terms_accepted_at TIMESTAMPTZ NULL,
  risk_strike_count INT NOT NULL DEFAULT 0 CHECK (risk_strike_count >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_super_app_trust_profiles_tier
ON super_app_trust_profiles(tier);

CREATE INDEX IF NOT EXISTS idx_super_app_trust_profiles_crm_approval
ON super_app_trust_profiles(crm_approval_status);

CREATE INDEX IF NOT EXISTS idx_super_app_trust_profiles_updated
ON super_app_trust_profiles(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_super_app_trust_profiles_metadata_gin
ON super_app_trust_profiles USING GIN (metadata);

SELECT 1;
