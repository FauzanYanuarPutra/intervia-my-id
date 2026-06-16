import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/serverAuth';
import { authSecurityHeaders, enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { parseJsonBody } from '@/lib/serverRequest';
import { withIdempotency } from '@/lib/idempotency';
import { getRedis } from '@/lib/redis';
import {
  persistSuperAppOrderSnapshot,
  syncSuperAppOrderToCrm,
  type SuperAppOrderRecord,
} from '@/lib/super-app/order-ops';
import { getDefaultLocations } from '@/lib/super-app/locations';
import {
  getOrderTemplate,
  saveOrderTemplate,
  touchOrderTemplateUsed,
} from '@/lib/super-app/templates';
import { buildFoodOrderQuote } from '@/lib/super-app/food-catalog';
import { buildMartOrderQuote } from '@/lib/super-app/mart-catalog';
import {
  buildEffectiveTrustPolicy,
  evaluateTrustPolicy,
  getCurrentSuperAppTermsVersion,
  loadTrustExposureMetrics,
  loadUserTrustProfile,
  persistTermsAcceptance,
  type TrustPolicy,
} from '@/lib/super-app/trust-policy';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';

const ORDER_TTL_SECONDS = 24 * 60 * 60;
const MIN_SCHEDULE_LEAD_MINUTES = 3;
const MAX_SCHEDULE_DAYS = 30;
const SUPER_APP_CONSUMER_PER_ORDER_CAP_CENTS = 500_000_000;
const SUPER_APP_CONSUMER_DAILY_CAP_CENTS = 5_000_000_000;
const SUPER_APP_CONSUMER_MONTHLY_CAP_CENTS = 50_000_000_000;
const SUPER_APP_CONSUMER_OPEN_EXPOSURE_CAP_CENTS = 900_000_000;
const SUPER_APP_CONSUMER_OPEN_ORDERS_LIMIT = 24;
const SUPER_APP_CONSUMER_REVIEW_THRESHOLD_CENTS = 25_000_000;

const CreateSuperAppOrderSchema = z.object({
  service: z.enum(['ride', 'car', 'food', 'send', 'mart', 'services']),
  pickup_address: z.string().min(3).max(240).optional(),
  dropoff_address: z.string().min(3).max(240).optional(),
  pickup_lat: z.number().min(-90).max(90).optional(),
  pickup_lng: z.number().min(-180).max(180).optional(),
  dropoff_lat: z.number().min(-90).max(90).optional(),
  dropoff_lng: z.number().min(-180).max(180).optional(),
  customer_lat: z.number().min(-90).max(90).optional(),
  customer_lng: z.number().min(-180).max(180).optional(),
  merchant_id: z.string().uuid().optional(),
  food_items: z
    .array(
      z.object({
        item_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .max(25)
    .optional(),
  mart_store_id: z.string().uuid().optional(),
  mart_items: z
    .array(
      z.object({
        item_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(50),
      }),
    )
    .max(80)
    .optional(),
  provider_id: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
  payment_method: z.enum(['wallet', 'bank_transfer', 'cod', 'qris', 'cash']).default('wallet'),
  amount_estimate_cents: z.number().int().min(0).max(5_000_000_000).optional(),
  currency: z.string().min(3).max(3).default('IDR'),
  scheduled_at: z.string().max(64).optional(),
  template_id: z.string().uuid().optional(),
  template_name: z.string().min(2).max(80).optional(),
  save_template: z.boolean().optional(),
  waypoints: z
    .array(
      z.object({
        address: z.string().min(3).max(240).optional(),
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
        notes: z.string().max(120).optional(),
      }),
    )
    .max(6)
    .optional(),
  terms_acceptance: z
    .object({
      accepted: z.boolean(),
      terms_version: z.string().min(6).max(80),
      liability_ack: z.boolean(),
      risk_ack: z.boolean(),
    })
    .optional(),
  client_meta: z.record(z.string(), z.unknown()).optional(),
});

type WaypointInput = {
  address?: string;
  lat?: number;
  lng?: number;
  notes?: string;
};

type WalletAccountLike = {
  environment?: string | null;
  currency?: string | null;
  available_balance_cents?: number | string | null;
};

type WalletBalanceLookup =
  | {
      ok: true;
      available_balance_cents: number;
      currency: string;
      environment: 'development' | 'live';
    }
  | {
      ok: false;
      code: 'wallet_balance_unavailable';
    };

function normalizeOrderPaymentMethod(value: unknown): 'wallet' | 'bank_transfer' | 'cod' {
  const normalized = `${value || 'wallet'}`
    .trim()
    .toLowerCase();
  if (normalized === 'qris') return 'bank_transfer';
  if (normalized === 'cash') return 'cod';
  if (normalized === 'bank_transfer' || normalized === 'cod') return normalized;
  return 'wallet';
}

function normalizeMoneyCents(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.floor(amount));
}

function normalizeWalletEnvironment(value: unknown): 'development' | 'live' {
  const normalized = `${value || ''}`
    .trim()
    .toLowerCase();
  if (normalized === 'live' || normalized === 'production' || normalized === 'prod') {
    return 'live';
  }
  return 'development';
}

function pickWalletAccount(payload: unknown): WalletAccountLike | null {
  if (!payload || typeof payload !== 'object') return null;
  const objectPayload = payload as Record<string, unknown>;
  const accounts = Array.isArray(objectPayload.accounts)
    ? (objectPayload.accounts as WalletAccountLike[])
    : [];
  if (accounts.length === 0) return null;

  const defaultEnvironment = normalizeWalletEnvironment(objectPayload.default_environment);
  return (
    accounts.find(
      (account) => normalizeWalletEnvironment(account.environment) === defaultEnvironment,
    ) ||
    accounts.find(
      (account) => normalizeWalletEnvironment(account.environment) === 'development',
    ) ||
    accounts[0] ||
    null
  );
}

function buildConsumerSuperAppTrustPolicy(policy: TrustPolicy): TrustPolicy {
  const nextHints = policy.marketing_nudges.filter(
    (hint) => !/naik limit|peningkatan tier|limit enterprise/i.test(hint),
  );

  return {
    ...policy,
    per_order_cap_cents: Math.max(
      policy.per_order_cap_cents,
      SUPER_APP_CONSUMER_PER_ORDER_CAP_CENTS,
    ),
    daily_cap_cents: Math.max(policy.daily_cap_cents, SUPER_APP_CONSUMER_DAILY_CAP_CENTS),
    monthly_cap_cents: Math.max(
      policy.monthly_cap_cents,
      SUPER_APP_CONSUMER_MONTHLY_CAP_CENTS,
    ),
    open_orders_limit: Math.max(policy.open_orders_limit, SUPER_APP_CONSUMER_OPEN_ORDERS_LIMIT),
    open_exposure_cap_cents: Math.max(
      policy.open_exposure_cap_cents,
      SUPER_APP_CONSUMER_OPEN_EXPOSURE_CAP_CENTS,
    ),
    review_threshold_cents: Math.max(
      policy.review_threshold_cents,
      SUPER_APP_CONSUMER_REVIEW_THRESHOLD_CENTS,
    ),
    marketing_nudges: [
      'Booking super app mengutamakan kesiapan pembayaran, bukan limit belanja tier.',
      ...nextHints,
    ],
  };
}

async function loadWalletBalanceForOrder(input: {
  token: string;
  security: { ip: string; deviceFingerprint: string };
}): Promise<WalletBalanceLookup> {
  try {
    const upstream = await fetch(`${process.env.INTERNAL_MARKETPLACE_URL || process.env.MARKETPLACE_URL || process.env.NEXT_PUBLIC_MARKETPLACE_URL || 'http://localhost:8081'}/v1/wallet/balance`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${input.token}`,
        ...authSecurityHeaders(input.security),
      },
      cache: 'no-store',
    });
    if (!upstream.ok) {
      return { ok: false, code: 'wallet_balance_unavailable' };
    }

    const payload = await upstream.json().catch(() => ({}));
    const account = pickWalletAccount(payload);
    if (!account) {
      return { ok: false, code: 'wallet_balance_unavailable' };
    }

    return {
      ok: true,
      available_balance_cents: normalizeMoneyCents(account.available_balance_cents),
      currency: `${account.currency || 'IDR'}`.trim().toUpperCase() || 'IDR',
      environment: normalizeWalletEnvironment(account.environment),
    };
  } catch {
    return { ok: false, code: 'wallet_balance_unavailable' };
  }
}

function detectRiskFlags(input: {
  notes?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  amountEstimateCents?: number;
}): string[] {
  const flags: string[] = [];
  const text = `${input.notes || ''}`.toLowerCase();
  if (/(wa\.me|whatsapp|telegram|t\.me|transfer langsung|bayar langsung)/i.test(text)) {
    flags.push('off_platform_payment_signal');
  }
  if (/(rekening pribadi|jangan lewat aplikasi|cash di luar)/i.test(text)) {
    flags.push('payment_bypass_intent');
  }
  if (input.pickupAddress && input.dropoffAddress) {
    const samePoint =
      input.pickupAddress.trim().toLowerCase() === input.dropoffAddress.trim().toLowerCase();
    if (samePoint) flags.push('pickup_dropoff_identical');
  }
  if ((input.amountEstimateCents || 0) >= 2_500_000_000) {
    flags.push('high_amount_order');
  }
  return flags;
}

function computeRiskScore(flags: string[]): number {
  let score = 0;
  for (const flag of flags) {
    if (flag === 'off_platform_payment_signal') score += 45;
    else if (flag === 'payment_bypass_intent') score += 35;
    else if (flag === 'high_amount_order') score += 20;
    else if (flag === 'pickup_dropoff_identical') score += 10;
  }
  return Math.min(100, score);
}

function baseGuardrails(service: string): string[] {
  const guardrails = [
    'KYC + device fingerprint required',
    'In-app communication and masked contact',
    'Escrow or controlled release flow',
    'Dispute and audit log trail enabled',
  ];
  if (service === 'ride' || service === 'car' || service === 'send') {
    guardrails.push('Pickup/dropoff verification code required');
  }
  if (service === 'food' || service === 'mart') {
    guardrails.push('Merchant trust tier validation required');
  }
  return guardrails;
}

function trustGuardrails(input: {
  tier: string;
  crmApproval: string;
  requiresManualReview: boolean;
  reviewReasons: string[];
}): string[] {
  const output = [
    `Tier policy active: ${input.tier}`,
    `CRM approval status: ${input.crmApproval}`,
    'Hard-stop anti-fraud caps remain active for every tier',
    'High-value exposure must use staged release / escrow controls',
  ];
  if (input.requiresManualReview) {
    output.push('Manual review queue required before dispatch release');
  }
  if (input.reviewReasons.includes('crm_pending_approval')) {
    output.push('CRM pending approval: dispatch stays under compliance review');
  }
  return output;
}

function hasNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasPair(lat?: number, lng?: number): boolean {
  return hasNumber(lat) && hasNumber(lng);
}

function formatPinnedAddress(label: string, lat?: number, lng?: number): string | undefined {
  if (!hasPair(lat, lng)) return undefined;
  const latText = Number(lat).toFixed(5);
  const lngText = Number(lng).toFixed(5);
  return `${label} location (${latText}, ${lngText})`;
}

function parseScheduledAt(raw?: string): { date?: Date; error?: string } {
  if (!raw) return {};
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return { error: 'scheduled_at must be a valid ISO date string' };
  }
  const now = Date.now();
  const minLeadMs = MIN_SCHEDULE_LEAD_MINUTES * 60 * 1000;
  const maxMs = MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000;
  if (parsed.getTime() > now + maxMs) {
    return { error: `scheduled_at must be within ${MAX_SCHEDULE_DAYS} days` };
  }
  if (parsed.getTime() <= now + minLeadMs) {
    return {};
  }
  return { date: parsed };
}

function normalizeWaypoints(input?: WaypointInput[]): WaypointInput[] {
  if (!Array.isArray(input)) return [];
  const cleaned = input
    .map((item) => ({
      address: typeof item.address === 'string' ? item.address.trim() : undefined,
      lat: hasNumber(item.lat) ? item.lat : undefined,
      lng: hasNumber(item.lng) ? item.lng : undefined,
      notes: typeof item.notes === 'string' ? item.notes.trim() : undefined,
    }))
    .filter((item) => {
      const hasAddress = Boolean(item.address && item.address.length >= 3);
      const hasCoords = hasPair(item.lat, item.lng);
      return hasAddress || hasCoords;
    })
    .slice(0, 6);

  return cleaned;
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function mergeTemplatePayload(
  template: Record<string, unknown>,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...payload };
  for (const [key, value] of Object.entries(template)) {
    if (isEmptyValue(merged[key])) {
      merged[key] = value;
    }
  }
  return merged;
}

function buildTemplatePayload(input: {
  payload: Record<string, unknown>;
  pickupAddress?: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffAddress?: string;
  dropoffLat?: number;
  dropoffLng?: number;
  waypoints?: WaypointInput[];
}): Record<string, unknown> {
  const base = input.payload || {};
  const result: Record<string, unknown> = {};
  const keys = [
    'pickup_address',
    'pickup_lat',
    'pickup_lng',
    'dropoff_address',
    'dropoff_lat',
    'dropoff_lng',
    'customer_lat',
    'customer_lng',
    'merchant_id',
    'food_items',
    'mart_store_id',
    'mart_items',
    'provider_id',
    'notes',
    'payment_method',
    'currency',
  ];

  for (const key of keys) {
    if (base[key] !== undefined) result[key] = base[key];
  }

  if (input.pickupAddress) result.pickup_address = input.pickupAddress;
  if (hasPair(input.pickupLat, input.pickupLng)) {
    result.pickup_lat = input.pickupLat;
    result.pickup_lng = input.pickupLng;
  }
  if (input.dropoffAddress) result.dropoff_address = input.dropoffAddress;
  if (hasPair(input.dropoffLat, input.dropoffLng)) {
    result.dropoff_lat = input.dropoffLat;
    result.dropoff_lng = input.dropoffLng;
  }
  if (Array.isArray(input.waypoints) && input.waypoints.length > 0) {
    result.waypoints = input.waypoints;
  }

  return result;
}

export async function POST(req: NextRequest) {
  try {
    if (PROMO_ONLY_MODE) {
      return NextResponse.json(
        { error: 'Orders are disabled for now' },
        { status: 404 },
      );
    }
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-orders',
      ipLimit: 180,
      deviceLimit: 140,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:orders:create:${auth.ctx.userId}:${security.ip}`,
      limit: 90,
      windowSeconds: 3600,
      message: 'Too many order requests. Please retry shortly.',
    });
    if (!rl.ok) return rl.response;
    const createOrderIntent = async (): Promise<Response> => {
      const parsedBody = await parseJsonBody(req);
      if (!parsedBody.ok) return parsedBody.response;

      const rawBody = parsedBody.data;
      const result = CreateSuperAppOrderSchema.safeParse(rawBody);
      if (!result.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
      }

      const explicitFields = new Set<string>();
      if (rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)) {
        for (const key of Object.keys(rawBody as Record<string, unknown>)) {
          explicitFields.add(key);
        }
      }

      let payload = result.data;
      let appliedTemplateId: string | null = null;

      if (payload.template_id) {
        const template = await getOrderTemplate(auth.ctx.userId, payload.template_id);
        if (!template) {
          return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }
        if (template.service !== payload.service) {
          return NextResponse.json(
            { error: 'Template service mismatch' },
            { status: 400 },
          );
        }
        const merged = mergeTemplatePayload(template.payload, payload) as typeof payload;
        if (!explicitFields.has('payment_method') && 'payment_method' in template.payload) {
          (merged as Record<string, unknown>).payment_method = template.payload.payment_method;
        }
        if (!explicitFields.has('currency') && 'currency' in template.payload) {
          (merged as Record<string, unknown>).currency = template.payload.currency;
        }
        payload = merged;
        appliedTemplateId = template.id;
      }

      const paymentMethod = normalizeOrderPaymentMethod(payload.payment_method);
      payload = {
        ...payload,
        payment_method: paymentMethod,
      };

      let amountEstimateCents = payload.amount_estimate_cents || 0;
      let pickupAddress = payload.pickup_address;
      let pickupLat = payload.pickup_lat;
      let pickupLng = payload.pickup_lng;
      let dropoffAddress = payload.dropoff_address;
      let dropoffLat = payload.dropoff_lat;
      let dropoffLng = payload.dropoff_lng;
      const customerLat = payload.customer_lat;
      const customerLng = payload.customer_lng;
      let foodOrderSnapshot: Record<string, unknown> | null = null;
      let martOrderSnapshot: Record<string, unknown> | null = null;
      let providerId = payload.provider_id;
      const service = payload.service;
      const allowWaypoints = service === 'ride' || service === 'car' || service === 'send';

      let waypoints = normalizeWaypoints(payload.waypoints);
      if (!allowWaypoints) {
        waypoints = [];
      }

      if (!dropoffAddress && !hasPair(dropoffLat, dropoffLng) && waypoints.length > 0) {
        const last = waypoints[waypoints.length - 1];
        dropoffAddress = dropoffAddress || last.address;
        dropoffLat = hasNumber(dropoffLat) ? dropoffLat : last.lat;
        dropoffLng = hasNumber(dropoffLng) ? dropoffLng : last.lng;
        waypoints = waypoints.slice(0, -1);
      }

      if (service === 'food') {
        if (!payload.merchant_id) {
          return NextResponse.json(
            { error: 'merchant_id is required for food orders' },
            { status: 400 },
          );
        }
        if (!Array.isArray(payload.food_items) || payload.food_items.length === 0) {
          return NextResponse.json(
            { error: 'food_items is required for food orders' },
            { status: 400 },
          );
        }
        try {
          const quote = await buildFoodOrderQuote({
            merchantId: payload.merchant_id,
            selections: payload.food_items,
          });
          amountEstimateCents = quote.total_cents;
          pickupAddress = quote.merchant.address;
          pickupLat = quote.merchant.lat;
          pickupLng = quote.merchant.lng;
          foodOrderSnapshot = {
            merchant: {
              id: quote.merchant.id,
              provider_user_id: quote.merchant.provider_user_id,
              name: quote.merchant.name,
              city: quote.merchant.city,
              address: quote.merchant.address,
              lat: quote.merchant.lat,
              lng: quote.merchant.lng,
            },
            items: quote.items,
            subtotal_cents: quote.subtotal_cents,
            delivery_fee_cents: quote.delivery_fee_cents,
            promo_discount_cents: quote.promo_discount_cents,
            promo: quote.promo,
            total_cents: quote.total_cents,
          };
        } catch (error) {
          const message =
            error instanceof Error && error.message
              ? error.message
              : 'Unable to validate food catalog order';
          return NextResponse.json({ error: message }, { status: 400 });
        }
      }

      if (service === 'mart') {
        if (!payload.mart_store_id) {
          return NextResponse.json(
            { error: 'mart_store_id is required for mart orders' },
            { status: 400 },
          );
        }
        if (!Array.isArray(payload.mart_items) || payload.mart_items.length === 0) {
          return NextResponse.json(
            { error: 'mart_items is required for mart orders' },
            { status: 400 },
          );
        }
        try {
          const quote = await buildMartOrderQuote({
            storeId: payload.mart_store_id,
            selections: payload.mart_items,
          });
          amountEstimateCents = quote.total_cents;
          pickupAddress = quote.store.address;
          pickupLat = quote.store.lat;
          pickupLng = quote.store.lng;
          providerId = quote.store.provider_user_id;
          martOrderSnapshot = {
            store: {
              id: quote.store.id,
              provider_user_id: quote.store.provider_user_id,
              name: quote.store.name,
              city: quote.store.city,
              address: quote.store.address,
              lat: quote.store.lat,
              lng: quote.store.lng,
            },
            items: quote.items,
            subtotal_cents: quote.subtotal_cents,
            service_fee_cents: quote.service_fee_cents,
            delivery_fee_cents: quote.delivery_fee_cents,
            promo_discount_cents: quote.promo_discount_cents,
            promo: quote.promo,
            total_cents: quote.total_cents,
          };
        } catch (error) {
          const message =
            error instanceof Error && error.message
              ? error.message
              : 'Unable to validate mart catalog order';
          return NextResponse.json({ error: message }, { status: 400 });
        }
      }

      const needsPickup = !hasPair(pickupLat, pickupLng) && !pickupAddress;
      const needsDropoff = !hasPair(dropoffLat, dropoffLng) && !dropoffAddress;
      if (needsPickup || needsDropoff) {
        const defaults = await getDefaultLocations(auth.ctx.userId);
        if (needsPickup && defaults.pickup) {
          pickupAddress = pickupAddress || defaults.pickup.address;
          pickupLat = hasNumber(pickupLat) ? pickupLat : defaults.pickup.lat;
          pickupLng = hasNumber(pickupLng) ? pickupLng : defaults.pickup.lng;
        }
        if (needsDropoff && defaults.dropoff) {
          dropoffAddress = dropoffAddress || defaults.dropoff.address;
          dropoffLat = hasNumber(dropoffLat) ? dropoffLat : defaults.dropoff.lat;
          dropoffLng = hasNumber(dropoffLng) ? dropoffLng : defaults.dropoff.lng;
        }
      }

      if (!hasPair(pickupLat, pickupLng) && hasPair(customerLat, customerLng)) {
        pickupLat = customerLat;
        pickupLng = customerLng;
      }

      if ((service === 'food' || service === 'mart') && !hasPair(dropoffLat, dropoffLng)) {
        if (hasPair(customerLat, customerLng)) {
          dropoffLat = customerLat;
          dropoffLng = customerLng;
        }
      }

      if (!pickupAddress) {
        pickupAddress = formatPinnedAddress('Pickup', pickupLat, pickupLng);
      }
      if (!dropoffAddress) {
        dropoffAddress = formatPinnedAddress('Dropoff', dropoffLat, dropoffLng);
      }

      if (!hasPair(pickupLat, pickupLng)) {
        return NextResponse.json(
          { error: 'pickup_lat and pickup_lng are required for this service' },
          { status: 400 },
        );
      }
      if (hasNumber(dropoffLat) !== hasNumber(dropoffLng)) {
        return NextResponse.json(
          { error: 'dropoff_lat and dropoff_lng must be provided together' },
          { status: 400 },
        );
      }
      if (hasNumber(payload.customer_lat) !== hasNumber(payload.customer_lng)) {
        return NextResponse.json(
          { error: 'customer_lat and customer_lng must be provided together' },
          { status: 400 },
        );
      }
      if (
        (service === 'food' || service === 'mart') &&
        (!dropoffAddress || dropoffAddress.trim().length < 3)
      ) {
        return NextResponse.json(
          { error: 'dropoff_address is required for food and mart orders' },
          { status: 400 },
        );
      }

      const schedule = parseScheduledAt(payload.scheduled_at);
      if (schedule.error) {
        return NextResponse.json({ error: schedule.error }, { status: 400 });
      }
      const scheduledAt = schedule.date;

      const riskFlags = detectRiskFlags({
        notes: payload.notes,
        pickupAddress,
        dropoffAddress,
        amountEstimateCents,
      });
      const riskScore = computeRiskScore(riskFlags);

      const trustProfile = await loadUserTrustProfile({
        token: auth.ctx.token,
        userId: auth.ctx.userId,
        roles: auth.ctx.roles,
        payload: auth.ctx.payload,
      });
      const trustPolicy = buildConsumerSuperAppTrustPolicy(buildEffectiveTrustPolicy(trustProfile));
      const trustExposure = await loadTrustExposureMetrics(auth.ctx.userId);
      const trustDecision = evaluateTrustPolicy({
        profile: trustProfile,
        policy: trustPolicy,
        exposure: trustExposure,
        amountEstimateCents,
        riskScore,
        termsAcceptance: payload.terms_acceptance,
      });

      if (!trustDecision.allowed) {
        const statusCode = trustDecision.rejection_code === 'terms_acceptance_required' ? 428 : 403;
        return NextResponse.json(
          {
            error: trustDecision.rejection_reason || 'Order blocked by trust policy.',
            code: trustDecision.rejection_code || 'trust_policy_blocked',
            trust: {
              tier: trustProfile.tier,
              kyc_status: trustProfile.kyc_status,
              crm_approval_status: trustProfile.crm_approval_status,
              marketing_segment: trustProfile.marketing_segment,
              risk_strike_count: trustProfile.risk_strike_count,
              review_reasons: trustDecision.review_reasons,
              upgrade_hints: trustDecision.upgrade_hints,
              legal: trustDecision.legal,
              exposure: trustExposure,
              policy: trustDecision.effective_policy,
            },
            terms: {
              required_version: getCurrentSuperAppTermsVersion(),
              requires_terms_acceptance: trustDecision.legal.requires_terms_acceptance,
            },
          },
          { status: statusCode },
        );
      }

      if (trustDecision.legal.requires_terms_acceptance) {
        const persisted = await persistTermsAcceptance({
          token: auth.ctx.token,
          userId: auth.ctx.userId,
          termsVersion: getCurrentSuperAppTermsVersion(),
        });
        if (!persisted) {
          return NextResponse.json(
            {
              error:
                'Legal terms acceptance could not be persisted. Please retry before creating order.',
              code: 'terms_persistence_failed',
            },
            { status: 503 },
          );
        }
      }

      if (paymentMethod === 'wallet' && amountEstimateCents > 0) {
        const walletBalance = await loadWalletBalanceForOrder({
          token: auth.ctx.token,
          security,
        });
        if (!walletBalance.ok) {
          return NextResponse.json(
            {
              error:
                'Saldo Lajukan belum bisa dicek sekarang. Coba lagi sebentar lagi atau pilih metode lain.',
              code: walletBalance.code,
            },
            { status: 503 },
          );
        }

        if (walletBalance.available_balance_cents < amountEstimateCents) {
          return NextResponse.json(
            {
              error:
                'Saldo Lajukan tidak cukup untuk membuat order ini. Top up dulu lalu coba lagi.',
              code: 'wallet_balance_insufficient',
              wallet: {
                available_balance_cents: walletBalance.available_balance_cents,
                required_balance_cents: amountEstimateCents,
                shortfall_cents: Math.max(
                  0,
                  amountEstimateCents - walletBalance.available_balance_cents,
                ),
                currency: walletBalance.currency,
                environment: walletBalance.environment,
              },
            },
            { status: 402 },
          );
        }
      }

      const dispatchReviewReasons = trustDecision.review_reasons.filter(
        (reason) => reason !== 'crm_pending_approval',
      );
      const requiresManualReview = dispatchReviewReasons.length > 0 || riskScore >= 45;
      const status = requiresManualReview
        ? 'pending_verification'
        : scheduledAt
          ? 'scheduled'
          : 'ready_for_dispatch';
      const lifecycleStage = scheduledAt ? 'order_scheduled' : 'customer_order_created';
      const trustSnapshot = {
        tier: trustProfile.tier,
        kyc_status: trustProfile.kyc_status,
        crm_approval_status: trustProfile.crm_approval_status,
        marketing_segment: trustProfile.marketing_segment,
        risk_strike_count: trustProfile.risk_strike_count,
        source: trustProfile.source,
        legal: trustDecision.legal,
        review_reasons: trustDecision.review_reasons,
        dispatch_review_reasons: dispatchReviewReasons,
        policy: trustDecision.effective_policy,
        exposure_before_create: trustExposure,
        upgrade_hints: trustDecision.upgrade_hints,
      };

      const orderId = crypto.randomUUID();
      const orderRecord: SuperAppOrderRecord = {
        order_id: orderId,
        user_id: auth.ctx.userId,
        service: payload.service,
        status,
        risk_score: riskScore,
        risk_flags: riskFlags,
        guardrails: Array.from(
          new Set([
            ...baseGuardrails(payload.service),
            ...trustGuardrails({
              tier: trustProfile.tier,
              crmApproval: trustProfile.crm_approval_status,
              requiresManualReview,
              reviewReasons: dispatchReviewReasons,
            }),
          ]),
        ),
        created_at: new Date().toISOString(),
        payload: {
          ...(payload as unknown as Record<string, unknown>),
          pickup_address: pickupAddress,
          pickup_lat: pickupLat,
          pickup_lng: pickupLng,
          dropoff_address: dropoffAddress,
          dropoff_lat: dropoffLat,
          dropoff_lng: dropoffLng,
          waypoints: waypoints,
          amount_estimate_cents: amountEstimateCents,
          provider_id: providerId,
          food_order_snapshot: foodOrderSnapshot,
          mart_order_snapshot: martOrderSnapshot,
          trust_snapshot: trustSnapshot,
          scheduled_at: scheduledAt ? scheduledAt.toISOString() : null,
        },
        lifecycle_stage: lifecycleStage,
        matched_driver_id: null,
        last_event_at: new Date().toISOString(),
      };

      const redis = getRedis();
      await redis.setex(
        `superapp:order:${orderId}`,
        ORDER_TTL_SECONDS,
        JSON.stringify(orderRecord),
      );

      if (appliedTemplateId) {
        void touchOrderTemplateUsed(auth.ctx.userId, appliedTemplateId);
      }

      if (payload.save_template || payload.template_name) {
        const templateName = payload.template_name || `${payload.service.toUpperCase()} Quick Order`;
        const templatePayload = buildTemplatePayload({
          payload: orderRecord.payload,
          pickupAddress,
          pickupLat,
          pickupLng,
          dropoffAddress,
          dropoffLat,
          dropoffLng,
          waypoints,
        });
        void saveOrderTemplate(auth.ctx.userId, {
          name: templateName,
          service: payload.service,
          payload: templatePayload,
        });
      }

      const persisted = await persistSuperAppOrderSnapshot({
        order: orderRecord,
        actorId: auth.ctx.userId,
        actorRole: 'customer',
        eventType: 'order.created',
        eventPayload: {
          status: orderRecord.status,
          lifecycle_stage: orderRecord.lifecycle_stage,
        },
      });
      if (!persisted) {
        console.warn('[SUPER_APP_ORDER_PERSIST_WARN] Snapshot write skipped for order', orderId);
      }
      void syncSuperAppOrderToCrm({
        token: auth.ctx.token,
        order: orderRecord,
        actorId: auth.ctx.userId,
        actorRole: 'customer',
        eventType: 'order.created',
        metadataPatch: {
          trust: {
            tier: trustProfile.tier,
            kyc_status: trustProfile.kyc_status,
            crm_approval_status: trustProfile.crm_approval_status,
            review_reasons: trustDecision.review_reasons,
            policy: trustDecision.effective_policy,
            legal_terms: trustDecision.legal,
          },
        },
      });

      return NextResponse.json(
        {
          data: orderRecord,
          safety: {
            requires_manual_review: requiresManualReview,
            recommendation: requiresManualReview
                ? 'Hold dispatch and trigger manual verification.'
                : 'Dispatch flow can continue with standard controls.',
            review_reasons: dispatchReviewReasons,
          },
          trust: trustSnapshot,
        },
        { status: 201 },
      );
    };

    if (req.headers.get('x-idempotency-key')) {
      return withIdempotency(req, {
        scope: 'super-app-orders-create',
        actorHint: auth.ctx.userId,
        ttlSeconds: 60 * 60,
        forward: createOrderIntent,
      });
    }

    return (await createOrderIntent()) as NextResponse;
  } catch (error) {
    console.error('[SUPER_APP_ORDER_CREATE_ERROR]', error);
    return NextResponse.json({ error: 'Failed to create super app order intent' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    if (PROMO_ONLY_MODE) {
      return NextResponse.json(
        { error: 'Orders are disabled for now' },
        { status: 404 },
      );
    }
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const orderId = (new URL(req.url).searchParams.get('id') || '').trim();
    if (!orderId) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const redis = getRedis();
    const raw = await redis.get(`superapp:order:${orderId}`);
    if (!raw) {
      return NextResponse.json({ error: 'Order intent not found' }, { status: 404 });
    }

    const orderRecord = JSON.parse(raw) as SuperAppOrderRecord;
    if (orderRecord.user_id !== auth.ctx.userId && !auth.ctx.roles.includes('admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ data: orderRecord }, { status: 200 });
  } catch (error) {
    console.error('[SUPER_APP_ORDER_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch super app order intent' }, { status: 500 });
  }
}
