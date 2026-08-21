import { getPostgresPool } from '@/lib/postgres';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SUPER_APP_ORDER_STATUSES = new Set([
  'pending_verification',
  'scheduled',
  'ready_for_dispatch',
  'dispatching',
  'in_progress',
  'delivered',
  'completed',
  'cancelled',
  'disputed',
] as const);

export type SuperAppOrderStatus =
  | 'pending_verification'
  | 'scheduled'
  | 'ready_for_dispatch'
  | 'dispatching'
  | 'in_progress'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'disputed';

export type SuperAppOrderRecord = {
  order_id: string;
  user_id: string;
  service: string;
  status: string;
  risk_score: number;
  risk_flags: string[];
  guardrails: string[];
  created_at: string;
  payload: Record<string, unknown>;
  lifecycle_stage?: string;
  matched_driver_id?: string | null;
  last_event_at?: string;
};

export type SuperAppCrmSyncInput = {
  token: string;
  order: SuperAppOrderRecord;
  actorId: string;
  actorRole: 'customer' | 'driver' | 'admin' | 'system';
  eventType: string;
  dispatchStatus?: 'searching' | 'matched' | 'expired' | null;
  metadataPatch?: Record<string, unknown>;
};

function asUuid(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return UUID_RE.test(normalized) ? normalized : null;
}

export function normalizeSuperAppOrderStatus(status: string): SuperAppOrderStatus {
  if (SUPER_APP_ORDER_STATUSES.has(status as SuperAppOrderStatus)) {
    return status as SuperAppOrderStatus;
  }
  return 'pending_verification';
}

function deriveCrmStage(status: string): 'lead' | 'qualified' | 'negotiation' | 'won' | 'lost' {
  const normalized = normalizeSuperAppOrderStatus(status);
  if (normalized === 'pending_verification') return 'lead';
  if (normalized === 'scheduled' || normalized === 'ready_for_dispatch' || normalized === 'dispatching') {
    return 'qualified';
  }
  if (normalized === 'in_progress' || normalized === 'delivered') return 'negotiation';
  if (normalized === 'completed') return 'won';
  return 'lost';
}

function parseMoneyCents(value: unknown): number | null {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount);
}

export async function persistSuperAppOrderSnapshot(input: {
  order: SuperAppOrderRecord;
  actorId?: string;
  actorRole?: string;
  eventType?: string;
  eventPayload?: Record<string, unknown>;
}): Promise<boolean> {
  try {
    const pool = getPostgresPool();
    if (!pool) return false;

    const orderId = asUuid(input.order.order_id);
    const requesterId = asUuid(input.order.user_id);
    if (!orderId || !requesterId) return false;

    const payload = input.order.payload || {};
    const merchantId = asUuid(typeof payload.merchant_id === 'string' ? payload.merchant_id : null);
    const providerId = asUuid(typeof payload.provider_id === 'string' ? payload.provider_id : null);
    const partnerId = asUuid(input.order.matched_driver_id || null);
    const amountEstimateCents = parseMoneyCents(payload.amount_estimate_cents) || 0;
    const amountFinalCents = parseMoneyCents(payload.amount_final_cents) || 0;
    const paymentMode =
      payload.payment_method === 'bank_transfer'
        ? 'bank_transfer'
        : payload.payment_method === 'cod'
          ? 'cod'
          : 'wallet';
    const currencyRaw = typeof payload.currency === 'string' ? payload.currency.toUpperCase() : 'IDR';
    const currency = currencyRaw.length === 3 ? currencyRaw : 'IDR';
    const riskScore =
      typeof input.order.risk_score === 'number' && Number.isFinite(input.order.risk_score)
        ? Math.max(0, Math.min(100, Math.round(input.order.risk_score)))
        : 0;
    const status = normalizeSuperAppOrderStatus(input.order.status);
    const metadata = {
      ...(typeof payload.client_meta === 'object' && payload.client_meta ? (payload.client_meta as Record<string, unknown>) : {}),
      super_app: {
        lifecycle_stage: input.order.lifecycle_stage || null,
        dispatch_status: input.eventPayload?.dispatch_status || null,
        event_type: input.eventType || null,
      },
      ...(input.eventPayload || {}),
    };

    await pool.query(
      `
        INSERT INTO super_app_orders (
          id,
          requester_id,
          partner_id,
          merchant_id,
          provider_id,
          service_type,
          status,
          payment_mode,
          currency,
          amount_estimate_cents,
          amount_final_cents,
          pickup_address,
          pickup_lat,
          pickup_lng,
          dropoff_address,
          dropoff_lat,
          dropoff_lng,
          risk_score,
          risk_flags,
          metadata,
          created_at,
          updated_at
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20::jsonb,NOW(),NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          partner_id = COALESCE(EXCLUDED.partner_id, super_app_orders.partner_id),
          merchant_id = COALESCE(EXCLUDED.merchant_id, super_app_orders.merchant_id),
          provider_id = COALESCE(EXCLUDED.provider_id, super_app_orders.provider_id),
          service_type = EXCLUDED.service_type,
          status = EXCLUDED.status,
          payment_mode = EXCLUDED.payment_mode,
          currency = EXCLUDED.currency,
          amount_estimate_cents = EXCLUDED.amount_estimate_cents,
          amount_final_cents = CASE
            WHEN EXCLUDED.amount_final_cents > 0 THEN EXCLUDED.amount_final_cents
            ELSE super_app_orders.amount_final_cents
          END,
          pickup_address = COALESCE(EXCLUDED.pickup_address, super_app_orders.pickup_address),
          pickup_lat = COALESCE(EXCLUDED.pickup_lat, super_app_orders.pickup_lat),
          pickup_lng = COALESCE(EXCLUDED.pickup_lng, super_app_orders.pickup_lng),
          dropoff_address = COALESCE(EXCLUDED.dropoff_address, super_app_orders.dropoff_address),
          dropoff_lat = COALESCE(EXCLUDED.dropoff_lat, super_app_orders.dropoff_lat),
          dropoff_lng = COALESCE(EXCLUDED.dropoff_lng, super_app_orders.dropoff_lng),
          risk_score = EXCLUDED.risk_score,
          risk_flags = EXCLUDED.risk_flags,
          metadata = COALESCE(super_app_orders.metadata, '{}'::jsonb) || EXCLUDED.metadata,
          updated_at = NOW()
      `,
      [
        orderId,
        requesterId,
        partnerId,
        merchantId,
        providerId,
        input.order.service,
        status,
        paymentMode,
        currency,
        amountEstimateCents,
        amountFinalCents,
        typeof payload.pickup_address === 'string' ? payload.pickup_address : null,
        typeof payload.pickup_lat === 'number' ? payload.pickup_lat : null,
        typeof payload.pickup_lng === 'number' ? payload.pickup_lng : null,
        typeof payload.dropoff_address === 'string' ? payload.dropoff_address : null,
        typeof payload.dropoff_lat === 'number' ? payload.dropoff_lat : null,
        typeof payload.dropoff_lng === 'number' ? payload.dropoff_lng : null,
        riskScore,
        JSON.stringify(Array.isArray(input.order.risk_flags) ? input.order.risk_flags : []),
        JSON.stringify(metadata),
      ],
    );

    if (input.eventType) {
      await pool.query(
        `
          INSERT INTO super_app_order_events (
            order_id,
            actor_id,
            actor_role,
            event_type,
            payload
          )
          VALUES ($1, $2, $3, $4, $5::jsonb)
        `,
        [
          orderId,
          asUuid(input.actorId || null),
          input.actorRole || 'system',
          input.eventType,
          JSON.stringify(input.eventPayload || {}),
        ],
      );
    }

    return true;
  } catch (error) {
    console.error('[SUPER_APP_ORDER_PERSIST_ERROR]', error);
    return false;
  }
}

export async function syncSuperAppOrderToCrm(input: SuperAppCrmSyncInput): Promise<boolean> {
  try {
    if (!input.token) return false;

    const order = input.order;
    const payload = order.payload || {};
    const matchDriverId = asUuid(order.matched_driver_id || null);
    const contactUserId = matchDriverId || null;
    const valueCents = parseMoneyCents(payload.amount_estimate_cents) || 0;
    const currency =
      typeof payload.currency === 'string' && payload.currency.trim().length === 3
        ? payload.currency.trim().toUpperCase()
        : 'IDR';
    const crmPayload = {
      chat_room_id: `superapp:order:${order.order_id}`,
      source: 'super_app',
      stage: deriveCrmStage(order.status),
      name: `Super App ${order.service.toUpperCase()} #${order.order_id.slice(0, 8)}`,
      sector: order.service,
      contact_user_id: contactUserId || undefined,
      value_cents: valueCents,
      currency,
      metadata: {
        super_app: {
          order_id: order.order_id,
          service: order.service,
          status: order.status,
          lifecycle_stage: order.lifecycle_stage || null,
          dispatch_status: input.dispatchStatus || null,
          event_type: input.eventType,
          actor_id: input.actorId,
          actor_role: input.actorRole,
          matched_driver_id: order.matched_driver_id || null,
          risk_score: order.risk_score,
          risk_flags: order.risk_flags || [],
          created_at: order.created_at,
          updated_at: order.last_event_at || new Date().toISOString(),
        },
        ...(input.metadataPatch || {}),
      },
    };

    const res = await fetch(`${MARKETPLACE_URL}/v1/crm/leads`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(crmPayload),
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn('[SUPER_APP_CRM_SYNC_FAILED]', res.status, body.slice(0, 250));
      return false;
    }
    return true;
  } catch (error) {
    console.error('[SUPER_APP_CRM_SYNC_ERROR]', error);
    return false;
  }
}
