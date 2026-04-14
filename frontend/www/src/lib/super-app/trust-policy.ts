import type { JWTPayload } from 'jose';
import { getPostgresPool } from '@/lib/postgres';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';
const IDENTITY_URL = process.env.INTERNAL_API_URL || 'http://localhost:8080';

const CURRENT_TERMS_VERSION = process.env.SUPER_APP_TERMS_VERSION || '2026-03-09.v1';

const ABSOLUTE_PLATFORM_PER_ORDER_CAP_CENTS = 500_000_000;
const ABSOLUTE_PLATFORM_OPEN_EXPOSURE_CAP_CENTS = 900_000_000;

export type UserTrustTier =
  | 'rookie'
  | 'verified'
  | 'trusted_pro'
  | 'elite'
  | 'influencer'
  | 'enterprise';

export type UserKycStatus = 'none' | 'basic' | 'full' | 'enhanced';
export type UserCrmApprovalStatus = 'pending' | 'approved' | 'rejected' | 'restricted';

export type SuperAppTrustProfile = {
  user_id: string;
  tier: UserTrustTier;
  kyc_status: UserKycStatus;
  crm_approval_status: UserCrmApprovalStatus;
  marketing_segment: string;
  manual_hold: boolean;
  manual_per_order_cap_cents: number | null;
  manual_daily_cap_cents: number | null;
  manual_monthly_cap_cents: number | null;
  legal_terms_version: string | null;
  legal_terms_accepted_at: string | null;
  risk_strike_count: number;
  metadata: Record<string, unknown>;
  source: 'marketplace' | 'derived';
};

export type TrustPolicy = {
  per_order_cap_cents: number;
  daily_cap_cents: number;
  monthly_cap_cents: number;
  open_orders_limit: number;
  open_exposure_cap_cents: number;
  review_threshold_cents: number;
  marketing_nudges: string[];
};

export type TrustExposureMetrics = {
  daily_volume_cents: number;
  monthly_volume_cents: number;
  open_exposure_cents: number;
  open_orders_count: number;
};

export type TrustPolicyDecision = {
  allowed: boolean;
  requires_manual_review: boolean;
  rejection_reason?: string;
  rejection_code?: string;
  review_reasons: string[];
  upgrade_hints: string[];
  legal: {
    current_terms_version: string;
    accepted_terms_version: string | null;
    requires_terms_acceptance: boolean;
  };
  effective_policy: TrustPolicy;
};

type TierPolicyMap = Record<UserTrustTier, TrustPolicy>;
type IdentityVerificationSnapshot = {
  identity_verified: boolean;
  transaction_eligible: boolean;
  document_verified: boolean;
  liveness_verified: boolean;
  kyc_status: UserKycStatus;
  verification: Record<string, unknown>;
};

const BASE_TIER_POLICIES: TierPolicyMap = {
  rookie: {
    per_order_cap_cents: 5_000_000,
    daily_cap_cents: 10_000_000,
    monthly_cap_cents: 45_000_000,
    open_orders_limit: 2,
    open_exposure_cap_cents: 8_000_000,
    review_threshold_cents: 3_000_000,
    marketing_nudges: [
      'Lengkapi verifikasi identitas untuk naik limit transaksi.',
      'Gunakan metode pembayaran in-app untuk mempercepat approval.',
    ],
  },
  verified: {
    per_order_cap_cents: 20_000_000,
    daily_cap_cents: 45_000_000,
    monthly_cap_cents: 180_000_000,
    open_orders_limit: 4,
    open_exposure_cap_cents: 35_000_000,
    review_threshold_cents: 12_000_000,
    marketing_nudges: [
      'Aktifkan histori transaksi sehat selama 30 hari untuk tier Trusted Pro.',
      'Pertahankan rating tinggi agar proses dispatch prioritas tetap aktif.',
    ],
  },
  trusted_pro: {
    per_order_cap_cents: 80_000_000,
    daily_cap_cents: 180_000_000,
    monthly_cap_cents: 700_000_000,
    open_orders_limit: 8,
    open_exposure_cap_cents: 120_000_000,
    review_threshold_cents: 40_000_000,
    marketing_nudges: [
      'Jaga dispute ratio rendah untuk promosi ke Elite.',
      'Gabungkan transaksi bernilai besar via milestone escrow.',
    ],
  },
  elite: {
    per_order_cap_cents: 160_000_000,
    daily_cap_cents: 320_000_000,
    monthly_cap_cents: 1_100_000_000,
    open_orders_limit: 10,
    open_exposure_cap_cents: 220_000_000,
    review_threshold_cents: 70_000_000,
    marketing_nudges: [
      'Gunakan SLA premium untuk menjaga reputasi tier Elite.',
      'Siapkan dokumen legal untuk transaksi bernilai tinggi.',
    ],
  },
  influencer: {
    per_order_cap_cents: 120_000_000,
    daily_cap_cents: 240_000_000,
    monthly_cap_cents: 900_000_000,
    open_orders_limit: 8,
    open_exposure_cap_cents: 180_000_000,
    review_threshold_cents: 50_000_000,
    marketing_nudges: [
      'Tier Influencer fokus campaign, bukan exposure finansial tak terbatas.',
      'Tingkatkan verifikasi bisnis untuk limit enterprise-grade.',
    ],
  },
  enterprise: {
    per_order_cap_cents: 300_000_000,
    daily_cap_cents: 450_000_000,
    monthly_cap_cents: 1_500_000_000,
    open_orders_limit: 15,
    open_exposure_cap_cents: 350_000_000,
    review_threshold_cents: 120_000_000,
    marketing_nudges: [
      'Enterprise tetap tunduk hard-stop anti-fraud platform.',
      'Gunakan split settlement dan escrow bertahap untuk nominal besar.',
    ],
  },
};

function pickTierFromRoles(roles: string[]): UserTrustTier {
  const normalized = new Set((roles || []).map((item) => item.toLowerCase()));
  if (normalized.has('enterprise') || normalized.has('merchant_enterprise')) return 'enterprise';
  if (normalized.has('influencer') || normalized.has('creator')) return 'influencer';
  if (normalized.has('elite') || normalized.has('vip')) return 'elite';
  if (normalized.has('trusted_pro') || normalized.has('trusted') || normalized.has('pro')) {
    return 'trusted_pro';
  }
  if (normalized.has('verified') || normalized.has('driver') || normalized.has('provider')) {
    return 'verified';
  }
  return 'rookie';
}

function extractBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  if (typeof value === 'number') return value === 1;
  return false;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function kycRank(value: UserKycStatus): number {
  if (value === 'enhanced') return 4;
  if (value === 'full') return 3;
  if (value === 'basic') return 2;
  return 1;
}

function maxKycStatus(left: UserKycStatus, right: UserKycStatus): UserKycStatus {
  return kycRank(left) >= kycRank(right) ? left : right;
}

function deriveKycStatus(payload: JWTPayload | undefined): UserKycStatus {
  if (!payload) return 'none';
  const anyPayload = payload as Record<string, unknown>;
  const verification = (anyPayload.verification || {}) as Record<string, unknown>;
  const identityVerified =
    extractBoolean(verification.identity_verified) ||
    extractBoolean(anyPayload.identity_verified);
  const phoneVerified =
    extractBoolean(verification.phone_verified) || extractBoolean(anyPayload.phone_verified);
  const emailVerified =
    extractBoolean(verification.email_verified) || extractBoolean(anyPayload.email_verified);
  const documentVerified =
    extractBoolean(verification.document_verified) ||
    extractBoolean(anyPayload.document_verified);
  const livenessVerified =
    extractBoolean(verification.liveness_verified) ||
    extractBoolean(anyPayload.liveness_verified);
  const transactionEligible =
    extractBoolean(verification.transaction_eligible) ||
    extractBoolean(anyPayload.transaction_eligible);

  if (transactionEligible && phoneVerified && (identityVerified || documentVerified || livenessVerified)) {
    return 'enhanced';
  }
  if (identityVerified || (documentVerified && livenessVerified)) return 'full';
  if (phoneVerified || emailVerified) return 'basic';
  return 'none';
}

function normalizeTier(value: unknown, fallback: UserTrustTier): UserTrustTier {
  const normalized = `${value || ''}`.trim().toLowerCase();
  if (
    normalized === 'rookie' ||
    normalized === 'verified' ||
    normalized === 'trusted_pro' ||
    normalized === 'elite' ||
    normalized === 'influencer' ||
    normalized === 'enterprise'
  ) {
    return normalized;
  }
  if (normalized === 'trusted' || normalized === 'pro') return 'trusted_pro';
  return fallback;
}

function normalizeKyc(value: unknown, fallback: UserKycStatus): UserKycStatus {
  const normalized = `${value || ''}`.trim().toLowerCase();
  if (
    normalized === 'none' ||
    normalized === 'basic' ||
    normalized === 'full' ||
    normalized === 'enhanced'
  ) {
    return normalized;
  }
  return fallback;
}

function normalizeApproval(
  value: unknown,
  fallback: UserCrmApprovalStatus,
): UserCrmApprovalStatus {
  const normalized = `${value || ''}`.trim().toLowerCase();
  if (
    normalized === 'pending' ||
    normalized === 'approved' ||
    normalized === 'rejected' ||
    normalized === 'restricted'
  ) {
    return normalized;
  }
  return fallback;
}

function asNonNegativeInt(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed);
}

async function fetchTrustProfileFromMarketplace(input: {
  token: string;
  userId: string;
  fallbackTier: UserTrustTier;
  fallbackKycStatus: UserKycStatus;
}): Promise<SuperAppTrustProfile | null> {
  try {
    const res = await fetch(
      `${MARKETPLACE_URL}/v1/super-app/trust-profiles/${encodeURIComponent(input.userId)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${input.token}` },
        cache: 'no-store',
      },
    );
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { profile?: Record<string, unknown> };
    const profile = data.profile || {};
    return {
      user_id: input.userId,
      tier: normalizeTier(profile.tier, input.fallbackTier),
      kyc_status: normalizeKyc(profile.kyc_status, input.fallbackKycStatus),
      crm_approval_status: normalizeApproval(profile.crm_approval_status, 'pending'),
      marketing_segment:
        typeof profile.marketing_segment === 'string' && profile.marketing_segment.trim()
          ? profile.marketing_segment.trim().toLowerCase()
          : 'general',
      manual_hold: extractBoolean(profile.manual_hold),
      manual_per_order_cap_cents: asNonNegativeInt(profile.manual_per_order_cap_cents),
      manual_daily_cap_cents: asNonNegativeInt(profile.manual_daily_cap_cents),
      manual_monthly_cap_cents: asNonNegativeInt(profile.manual_monthly_cap_cents),
      legal_terms_version:
        typeof profile.legal_terms_version === 'string' ? profile.legal_terms_version : null,
      legal_terms_accepted_at:
        typeof profile.legal_terms_accepted_at === 'string'
          ? profile.legal_terms_accepted_at
          : null,
      risk_strike_count: asNonNegativeInt(profile.risk_strike_count) || 0,
      metadata:
        typeof profile.metadata === 'object' && profile.metadata
          ? (profile.metadata as Record<string, unknown>)
          : {},
      source: 'marketplace',
    };
  } catch {
    return null;
  }
}

async function fetchIdentityVerificationSnapshot(
  userId: string,
): Promise<IdentityVerificationSnapshot | null> {
  try {
    const res = await fetch(`${IDENTITY_URL}/users/public/${encodeURIComponent(userId)}`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const verification = asObject(data.verification) || {};
    return {
      identity_verified:
        extractBoolean(verification.identity_verified) ||
        extractBoolean(data.identity_verified),
      transaction_eligible:
        extractBoolean(verification.transaction_eligible) ||
        extractBoolean(data.transaction_eligible),
      document_verified:
        extractBoolean(verification.document_verified) ||
        extractBoolean(data.document_verified),
      liveness_verified:
        extractBoolean(verification.liveness_verified) ||
        extractBoolean(data.liveness_verified),
      kyc_status: normalizeKyc(
        verification.kyc_status || data.kyc_status,
        'none',
      ),
      verification,
    };
  } catch {
    return null;
  }
}

function deriveFallbackProfile(input: {
  userId: string;
  roles: string[];
  payload: JWTPayload | undefined;
  identitySnapshot?: IdentityVerificationSnapshot | null;
}): SuperAppTrustProfile {
  const derivedTier = pickTierFromRoles(input.roles || []);
  const derivedKycStatus = maxKycStatus(
    deriveKycStatus(input.payload),
    input.identitySnapshot?.kyc_status || 'none',
  );
  return {
    user_id: input.userId,
    tier: derivedTier,
    kyc_status: derivedKycStatus,
    crm_approval_status: 'pending',
    marketing_segment: derivedTier === 'influencer' ? 'community' : 'general',
    manual_hold: false,
    manual_per_order_cap_cents: null,
    manual_daily_cap_cents: null,
    manual_monthly_cap_cents: null,
    legal_terms_version: null,
    legal_terms_accepted_at: null,
    risk_strike_count: 0,
    metadata: input.identitySnapshot
      ? {
          identity_verification: {
            ...input.identitySnapshot.verification,
            identity_verified: input.identitySnapshot.identity_verified,
            transaction_eligible: input.identitySnapshot.transaction_eligible,
            document_verified: input.identitySnapshot.document_verified,
            liveness_verified: input.identitySnapshot.liveness_verified,
            kyc_status: input.identitySnapshot.kyc_status,
          },
        }
      : {},
    source: 'derived',
  };
}

export async function loadUserTrustProfile(input: {
  token: string;
  userId: string;
  roles: string[];
  payload: JWTPayload | undefined;
}): Promise<SuperAppTrustProfile> {
  const identitySnapshot = await fetchIdentityVerificationSnapshot(input.userId);
  const fallback = deriveFallbackProfile({
    ...input,
    identitySnapshot,
  });
  const fromMarketplace = await fetchTrustProfileFromMarketplace({
    token: input.token,
    userId: input.userId,
    fallbackTier: fallback.tier,
    fallbackKycStatus: fallback.kyc_status,
  });
  if (!fromMarketplace) return fallback;

  return {
    ...fromMarketplace,
    kyc_status: maxKycStatus(fromMarketplace.kyc_status, fallback.kyc_status),
    metadata: {
      ...(fallback.metadata || {}),
      ...(fromMarketplace.metadata || {}),
    },
  };
}

export async function loadTrustExposureMetrics(userId: string): Promise<TrustExposureMetrics> {
  const pool = getPostgresPool();
  if (!pool) {
    return {
      daily_volume_cents: 0,
      monthly_volume_cents: 0,
      open_exposure_cents: 0,
      open_orders_count: 0,
    };
  }

  try {
    const result = await pool.query<{
      daily_volume_cents: number;
      monthly_volume_cents: number;
      open_exposure_cents: number;
      open_orders_count: number;
    }>(
      `
      SELECT
        COALESCE(
          SUM(CASE
            WHEN created_at >= NOW() - INTERVAL '1 day'
              AND status NOT IN ('cancelled', 'disputed')
            THEN amount_estimate_cents
            ELSE 0
          END),
          0
        )::bigint AS daily_volume_cents,
        COALESCE(
          SUM(CASE
            WHEN created_at >= NOW() - INTERVAL '30 day'
              AND status NOT IN ('cancelled', 'disputed')
            THEN amount_estimate_cents
            ELSE 0
          END),
          0
        )::bigint AS monthly_volume_cents,
        COALESCE(
          SUM(CASE
            WHEN status IN (
              'pending_verification',
              'ready_for_dispatch',
              'dispatching',
              'in_progress',
              'delivered'
            )
            THEN GREATEST(amount_estimate_cents, amount_final_cents)
            ELSE 0
          END),
          0
        )::bigint AS open_exposure_cents,
        COALESCE(
          COUNT(*) FILTER (
            WHERE status IN (
              'pending_verification',
              'ready_for_dispatch',
              'dispatching',
              'in_progress',
              'delivered'
            )
          ),
          0
        )::bigint AS open_orders_count
      FROM super_app_orders
      WHERE requester_id = $1::uuid
        AND created_at >= NOW() - INTERVAL '31 day'
      `,
      [userId],
    );
    const row = result.rows[0];
    return {
      daily_volume_cents: Math.max(0, Number(row?.daily_volume_cents || 0)),
      monthly_volume_cents: Math.max(0, Number(row?.monthly_volume_cents || 0)),
      open_exposure_cents: Math.max(0, Number(row?.open_exposure_cents || 0)),
      open_orders_count: Math.max(0, Number(row?.open_orders_count || 0)),
    };
  } catch {
    return {
      daily_volume_cents: 0,
      monthly_volume_cents: 0,
      open_exposure_cents: 0,
      open_orders_count: 0,
    };
  }
}

export function buildEffectiveTrustPolicy(profile: SuperAppTrustProfile): TrustPolicy {
  const base = BASE_TIER_POLICIES[profile.tier] || BASE_TIER_POLICIES.rookie;
  let next: TrustPolicy = { ...base };

  if (profile.crm_approval_status !== 'approved') {
    next = {
      ...next,
      per_order_cap_cents: Math.min(next.per_order_cap_cents, 8_000_000),
      daily_cap_cents: Math.min(next.daily_cap_cents, 15_000_000),
      monthly_cap_cents: Math.min(next.monthly_cap_cents, 60_000_000),
      open_orders_limit: Math.min(next.open_orders_limit, 2),
      open_exposure_cap_cents: Math.min(next.open_exposure_cap_cents, 12_000_000),
      review_threshold_cents: Math.min(next.review_threshold_cents, 5_000_000),
    };
  }

  if (profile.kyc_status === 'none') {
    next = {
      ...next,
      per_order_cap_cents: Math.min(next.per_order_cap_cents, 3_000_000),
      daily_cap_cents: Math.min(next.daily_cap_cents, 6_000_000),
      monthly_cap_cents: Math.min(next.monthly_cap_cents, 20_000_000),
      open_exposure_cap_cents: Math.min(next.open_exposure_cap_cents, 5_000_000),
      open_orders_limit: Math.min(next.open_orders_limit, 1),
    };
  } else if (profile.kyc_status === 'basic') {
    next = {
      ...next,
      per_order_cap_cents: Math.min(next.per_order_cap_cents, 15_000_000),
      daily_cap_cents: Math.min(next.daily_cap_cents, 30_000_000),
      monthly_cap_cents: Math.min(next.monthly_cap_cents, 120_000_000),
    };
  }

  if (profile.risk_strike_count >= 3) {
    next = {
      ...next,
      per_order_cap_cents: Math.min(next.per_order_cap_cents, 10_000_000),
      daily_cap_cents: Math.min(next.daily_cap_cents, 20_000_000),
      monthly_cap_cents: Math.min(next.monthly_cap_cents, 80_000_000),
      open_orders_limit: Math.min(next.open_orders_limit, 2),
      open_exposure_cap_cents: Math.min(next.open_exposure_cap_cents, 15_000_000),
      review_threshold_cents: Math.min(next.review_threshold_cents, 8_000_000),
    };
  }

  if (profile.manual_per_order_cap_cents !== null) {
    next.per_order_cap_cents = Math.min(next.per_order_cap_cents, profile.manual_per_order_cap_cents);
  }
  if (profile.manual_daily_cap_cents !== null) {
    next.daily_cap_cents = Math.min(next.daily_cap_cents, profile.manual_daily_cap_cents);
  }
  if (profile.manual_monthly_cap_cents !== null) {
    next.monthly_cap_cents = Math.min(next.monthly_cap_cents, profile.manual_monthly_cap_cents);
  }

  next.per_order_cap_cents = Math.min(
    next.per_order_cap_cents,
    ABSOLUTE_PLATFORM_PER_ORDER_CAP_CENTS,
  );
  next.open_exposure_cap_cents = Math.min(
    next.open_exposure_cap_cents,
    ABSOLUTE_PLATFORM_OPEN_EXPOSURE_CAP_CENTS,
  );
  return next;
}

export function evaluateTrustPolicy(input: {
  profile: SuperAppTrustProfile;
  policy: TrustPolicy;
  exposure: TrustExposureMetrics;
  amountEstimateCents: number;
  riskScore: number;
  termsAcceptance?: {
    accepted: boolean;
    terms_version?: string;
    liability_ack?: boolean;
    risk_ack?: boolean;
  };
}): TrustPolicyDecision {
  const amount = Math.max(0, Math.round(input.amountEstimateCents || 0));
  const reviewReasons: string[] = [];
  const upgradeHints = [...input.policy.marketing_nudges];

  const requiresTermsAcceptance =
    input.profile.legal_terms_version !== CURRENT_TERMS_VERSION;
  if (requiresTermsAcceptance) {
    const terms = input.termsAcceptance;
    const validTerms =
      Boolean(terms?.accepted) &&
      terms?.terms_version === CURRENT_TERMS_VERSION &&
      Boolean(terms?.liability_ack) &&
      Boolean(terms?.risk_ack);
    if (!validTerms) {
      return {
        allowed: false,
        requires_manual_review: false,
        rejection_reason:
          'Persetujuan Terms, liability disclaimer, dan risk disclosure wajib sebelum transaksi.',
        rejection_code: 'terms_acceptance_required',
        review_reasons: [],
        upgrade_hints: upgradeHints,
        legal: {
          current_terms_version: CURRENT_TERMS_VERSION,
          accepted_terms_version: input.profile.legal_terms_version,
          requires_terms_acceptance: true,
        },
        effective_policy: input.policy,
      };
    }
  }

  if (input.profile.manual_hold) {
    return {
      allowed: false,
      requires_manual_review: true,
      rejection_reason:
        'Akun sedang dalam pembatasan sementara oleh tim risk/CRM. Silakan hubungi support.',
      rejection_code: 'manual_hold',
      review_reasons: ['manual_hold'],
      upgrade_hints: upgradeHints,
      legal: {
        current_terms_version: CURRENT_TERMS_VERSION,
        accepted_terms_version: input.profile.legal_terms_version,
        requires_terms_acceptance: requiresTermsAcceptance,
      },
      effective_policy: input.policy,
    };
  }

  if (
    input.profile.crm_approval_status === 'rejected' ||
    input.profile.crm_approval_status === 'restricted'
  ) {
    return {
      allowed: false,
      requires_manual_review: true,
      rejection_reason:
        'Status approval CRM belum mengizinkan transaksi normal. Menunggu evaluasi lanjutan.',
      rejection_code: 'crm_restricted',
      review_reasons: ['crm_restricted'],
      upgrade_hints: upgradeHints,
      legal: {
        current_terms_version: CURRENT_TERMS_VERSION,
        accepted_terms_version: input.profile.legal_terms_version,
        requires_terms_acceptance: requiresTermsAcceptance,
      },
      effective_policy: input.policy,
    };
  }

  if (amount > ABSOLUTE_PLATFORM_PER_ORDER_CAP_CENTS) {
    return {
      allowed: false,
      requires_manual_review: true,
      rejection_reason:
        'Nominal melebihi hard-stop platform. Gunakan skema milestone atau hubungi tim enterprise.',
      rejection_code: 'absolute_cap_exceeded',
      review_reasons: ['absolute_cap_exceeded'],
      upgrade_hints: upgradeHints,
      legal: {
        current_terms_version: CURRENT_TERMS_VERSION,
        accepted_terms_version: input.profile.legal_terms_version,
        requires_terms_acceptance: requiresTermsAcceptance,
      },
      effective_policy: input.policy,
    };
  }

  if (amount > input.policy.per_order_cap_cents) {
    return {
      allowed: false,
      requires_manual_review: true,
      rejection_reason:
        'Nominal transaksi melebihi batas tier saat ini. Selesaikan verifikasi/approval untuk naik limit.',
      rejection_code: 'tier_per_order_limit',
      review_reasons: ['tier_per_order_limit'],
      upgrade_hints: upgradeHints,
      legal: {
        current_terms_version: CURRENT_TERMS_VERSION,
        accepted_terms_version: input.profile.legal_terms_version,
        requires_terms_acceptance: requiresTermsAcceptance,
      },
      effective_policy: input.policy,
    };
  }

  if (input.exposure.open_orders_count >= input.policy.open_orders_limit) {
    return {
      allowed: false,
      requires_manual_review: false,
      rejection_reason:
        'Jumlah order aktif sudah mencapai batas. Selesaikan order berjalan sebelum membuat order baru.',
      rejection_code: 'open_orders_limit',
      review_reasons: ['open_orders_limit'],
      upgrade_hints: upgradeHints,
      legal: {
        current_terms_version: CURRENT_TERMS_VERSION,
        accepted_terms_version: input.profile.legal_terms_version,
        requires_terms_acceptance: requiresTermsAcceptance,
      },
      effective_policy: input.policy,
    };
  }

  if (input.exposure.daily_volume_cents + amount > input.policy.daily_cap_cents) {
    return {
      allowed: false,
      requires_manual_review: true,
      rejection_reason:
        'Batas volume harian terlampaui. Coba lagi besok atau ajukan peningkatan tier.',
      rejection_code: 'daily_limit_exceeded',
      review_reasons: ['daily_limit_exceeded'],
      upgrade_hints: upgradeHints,
      legal: {
        current_terms_version: CURRENT_TERMS_VERSION,
        accepted_terms_version: input.profile.legal_terms_version,
        requires_terms_acceptance: requiresTermsAcceptance,
      },
      effective_policy: input.policy,
    };
  }

  if (input.exposure.monthly_volume_cents + amount > input.policy.monthly_cap_cents) {
    return {
      allowed: false,
      requires_manual_review: true,
      rejection_reason:
        'Batas volume bulanan terlampaui. Hubungi CRM untuk evaluasi limit enterprise.',
      rejection_code: 'monthly_limit_exceeded',
      review_reasons: ['monthly_limit_exceeded'],
      upgrade_hints: upgradeHints,
      legal: {
        current_terms_version: CURRENT_TERMS_VERSION,
        accepted_terms_version: input.profile.legal_terms_version,
        requires_terms_acceptance: requiresTermsAcceptance,
      },
      effective_policy: input.policy,
    };
  }

  if (input.exposure.open_exposure_cents + amount > input.policy.open_exposure_cap_cents) {
    return {
      allowed: false,
      requires_manual_review: true,
      rejection_reason:
        'Exposure order aktif melebihi batas aman. Kurangi exposure agar dana semua pihak tetap terlindungi.',
      rejection_code: 'open_exposure_limit',
      review_reasons: ['open_exposure_limit'],
      upgrade_hints: upgradeHints,
      legal: {
        current_terms_version: CURRENT_TERMS_VERSION,
        accepted_terms_version: input.profile.legal_terms_version,
        requires_terms_acceptance: requiresTermsAcceptance,
      },
      effective_policy: input.policy,
    };
  }

  if (amount >= input.policy.review_threshold_cents) {
    reviewReasons.push('high_value_threshold');
  }
  if (input.riskScore >= 45) {
    reviewReasons.push('risk_score_high');
  }
  if (input.profile.crm_approval_status !== 'approved') {
    reviewReasons.push('crm_pending_approval');
  }

  if (reviewReasons.length > 0) {
    upgradeHints.push('Transaksi bernilai tinggi diproses dengan manual review untuk melindungi semua pihak.');
  }

  return {
    allowed: true,
    requires_manual_review: reviewReasons.length > 0,
    review_reasons: reviewReasons,
    upgrade_hints: upgradeHints,
    legal: {
      current_terms_version: CURRENT_TERMS_VERSION,
      accepted_terms_version: input.profile.legal_terms_version,
      requires_terms_acceptance: requiresTermsAcceptance,
    },
    effective_policy: input.policy,
  };
}

export async function persistTermsAcceptance(input: {
  token: string;
  userId: string;
  termsVersion: string;
}): Promise<boolean> {
  try {
    const res = await fetch(
      `${MARKETPLACE_URL}/v1/super-app/trust-profiles/${encodeURIComponent(input.userId)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${input.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          legal_terms_version: input.termsVersion,
          legal_terms_accepted_at: new Date().toISOString(),
        }),
        cache: 'no-store',
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

export function getCurrentSuperAppTermsVersion(): string {
  return CURRENT_TERMS_VERSION;
}
