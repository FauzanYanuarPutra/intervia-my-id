import { describe, expect, it } from 'vitest';
import {
  buildEffectiveTrustPolicy,
  evaluateTrustPolicy,
  type SuperAppTrustProfile,
  type TrustExposureMetrics,
} from './trust-policy';

function baseExposure(): TrustExposureMetrics {
  return {
    daily_volume_cents: 0,
    monthly_volume_cents: 0,
    open_exposure_cents: 0,
    open_orders_count: 0,
  };
}

function profile(overrides: Partial<SuperAppTrustProfile>): SuperAppTrustProfile {
  return {
    user_id: '5f940613-8f14-4358-a505-0ead99553a50',
    tier: 'rookie',
    kyc_status: 'none',
    crm_approval_status: 'pending',
    marketing_segment: 'general',
    manual_hold: false,
    manual_per_order_cap_cents: null,
    manual_daily_cap_cents: null,
    manual_monthly_cap_cents: null,
    legal_terms_version: null,
    legal_terms_accepted_at: null,
    risk_strike_count: 0,
    metadata: {},
    source: 'derived',
    ...overrides,
  };
}

describe('super-app trust policy', () => {
  it('blocks order when terms are missing', () => {
    const user = profile({
      tier: 'verified',
      kyc_status: 'full',
      crm_approval_status: 'approved',
      legal_terms_version: null,
    });
    const decision = evaluateTrustPolicy({
      profile: user,
      policy: buildEffectiveTrustPolicy(user),
      exposure: baseExposure(),
      amountEstimateCents: 2_000_000,
      riskScore: 10,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.rejection_code).toBe('terms_acceptance_required');
  });

  it('allows verified transaction inside caps when terms are accepted', () => {
    const user = profile({
      tier: 'verified',
      kyc_status: 'full',
      crm_approval_status: 'approved',
      legal_terms_version: '2026-03-09.v1',
    });
    const decision = evaluateTrustPolicy({
      profile: user,
      policy: buildEffectiveTrustPolicy(user),
      exposure: baseExposure(),
      amountEstimateCents: 1_500_000,
      riskScore: 15,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.requires_manual_review).toBe(false);
  });

  it('hard-stops extreme amount for enterprise tier', () => {
    const user = profile({
      tier: 'enterprise',
      kyc_status: 'enhanced',
      crm_approval_status: 'approved',
      legal_terms_version: '2026-03-09.v1',
    });
    const decision = evaluateTrustPolicy({
      profile: user,
      policy: buildEffectiveTrustPolicy(user),
      exposure: baseExposure(),
      amountEstimateCents: 800_000_000,
      riskScore: 20,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.rejection_code).toBe('absolute_cap_exceeded');
  });
});
