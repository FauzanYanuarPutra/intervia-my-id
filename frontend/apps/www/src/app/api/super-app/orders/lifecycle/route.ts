import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/serverAuth';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { getRedis } from '@/lib/redis';
import { getDispatchOrder, publishOrderStreamEvent } from '@/lib/super-app/dispatch';
import {
  normalizeSuperAppOrderStatus,
  persistSuperAppOrderSnapshot,
  syncSuperAppOrderToCrm,
  type SuperAppOrderRecord,
} from '@/lib/super-app/order-ops';

const ORDER_TTL_SECONDS = 24 * 60 * 60;

const LifecycleSchema = z.object({
  order_id: z.string().min(8).max(120),
  event: z.enum([
    'pickup_confirmed',
    'delivery_started',
    'delivery_completed',
    'order_completed',
    'payment_recorded',
    'rating_submitted',
    'cancelled',
    'disputed',
  ]),
  payment_method: z.enum(['wallet', 'bank_transfer', 'cod']).optional(),
  amount_final_cents: z.number().int().min(0).max(5_000_000_000).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  review: z.string().max(500).optional(),
});

type LifecycleEvent = z.infer<typeof LifecycleSchema>['event'];

function isAdminLikeRole(roles: string[]): boolean {
  const normalized = new Set(roles.map((value) => value.toLowerCase()));
  return (
    normalized.has('admin') ||
    normalized.has('support') ||
    normalized.has('ops') ||
    normalized.has('super_admin')
  );
}

function isDriverLifecycleEvent(event: LifecycleEvent): boolean {
  return event === 'pickup_confirmed' || event === 'delivery_started' || event === 'delivery_completed';
}

function isCustomerLifecycleEvent(event: LifecycleEvent): boolean {
  return (
    event === 'order_completed' ||
    event === 'payment_recorded' ||
    event === 'rating_submitted' ||
    event === 'cancelled' ||
    event === 'disputed'
  );
}

function mapLifecycleStage(event: LifecycleEvent): string {
  if (event === 'pickup_confirmed') return 'pickup_confirmed';
  if (event === 'delivery_started') return 'delivery_in_progress';
  if (event === 'delivery_completed') return 'delivery_completed';
  if (event === 'order_completed') return 'order_completed';
  if (event === 'payment_recorded') return 'payment_completed';
  if (event === 'rating_submitted') return 'rating_submitted';
  if (event === 'cancelled') return 'order_cancelled';
  return 'order_disputed';
}

function mapStatusFromLifecycleEvent(event: LifecycleEvent): ReturnType<typeof normalizeSuperAppOrderStatus> {
  if (event === 'pickup_confirmed' || event === 'delivery_started') return 'in_progress';
  if (event === 'delivery_completed') return 'delivered';
  if (event === 'cancelled') return 'cancelled';
  if (event === 'disputed') return 'disputed';
  return 'completed';
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-order-lifecycle',
      ipLimit: 240,
      deviceLimit: 180,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:order:lifecycle:${auth.ctx.userId}:${security.ip}`,
      limit: 300,
      windowSeconds: 3600,
      message: 'Too many lifecycle updates',
    });
    if (!rl.ok) return rl.response;

    const parsed = await parseJsonBodyWithSchema(req, LifecycleSchema);
    if (!parsed.ok) return parsed.response;

    const payload = parsed.data;
    const redis = getRedis();
    const orderRaw = await redis.get(`superapp:order:${payload.order_id}`);
    if (!orderRaw) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    let orderRecord: SuperAppOrderRecord | null = null;
    try {
      orderRecord = JSON.parse(orderRaw) as SuperAppOrderRecord;
    } catch {
      orderRecord = null;
    }
    if (!orderRecord) {
      return NextResponse.json({ error: 'Order record is invalid' }, { status: 422 });
    }

    const dispatchState = await getDispatchOrder(payload.order_id);
    const isAdmin = isAdminLikeRole(auth.ctx.roles);
    const isRequester = orderRecord.user_id === auth.ctx.userId;
    const isMatchedDriver =
      Boolean(dispatchState?.matched_driver_id) &&
      dispatchState?.matched_driver_id === auth.ctx.userId;

    const canPerform =
      isAdmin ||
      (isDriverLifecycleEvent(payload.event) && isMatchedDriver) ||
      (isCustomerLifecycleEvent(payload.event) && isRequester);
    if (!canPerform) {
      return NextResponse.json({ error: 'Forbidden lifecycle transition' }, { status: 403 });
    }

    const nextPayload: Record<string, unknown> = {
      ...(orderRecord.payload || {}),
    };
    if (typeof payload.amount_final_cents === 'number') {
      nextPayload.amount_final_cents = payload.amount_final_cents;
    }
    if (payload.event === 'payment_recorded') {
      nextPayload.payment_status = 'paid';
      if (payload.payment_method) {
        nextPayload.payment_method = payload.payment_method;
      }
      nextPayload.payment_recorded_at = new Date().toISOString();
    }
    if (payload.event === 'rating_submitted') {
      if (typeof payload.rating === 'number') nextPayload.rating = payload.rating;
      if (typeof payload.review === 'string' && payload.review.trim()) {
        nextPayload.review = payload.review.trim();
      }
      nextPayload.rated_at = new Date().toISOString();
    }

    const nextStatus = mapStatusFromLifecycleEvent(payload.event);
    const nextRecord: SuperAppOrderRecord = {
      ...orderRecord,
      status: nextStatus,
      payload: nextPayload,
      lifecycle_stage: mapLifecycleStage(payload.event),
      matched_driver_id: dispatchState?.matched_driver_id || orderRecord.matched_driver_id || null,
      last_event_at: new Date().toISOString(),
    };

    await redis.setex(
      `superapp:order:${payload.order_id}`,
      ORDER_TTL_SECONDS,
      JSON.stringify(nextRecord),
    );

    await publishOrderStreamEvent({
      orderId: payload.order_id,
      event: {
        type: 'order_lifecycle',
        order_id: payload.order_id,
        lifecycle_event: payload.event,
        lifecycle_stage: nextRecord.lifecycle_stage,
        status: nextRecord.status,
        actor_id: auth.ctx.userId,
        ts: nextRecord.last_event_at,
      },
    });

    void persistSuperAppOrderSnapshot({
      order: nextRecord,
      actorId: auth.ctx.userId,
      actorRole: isAdmin ? 'admin' : isMatchedDriver ? 'driver' : 'customer',
      eventType: `order.${payload.event}`,
      eventPayload: {
        lifecycle_stage: nextRecord.lifecycle_stage,
        status: nextRecord.status,
        amount_final_cents: payload.amount_final_cents ?? null,
        payment_method: payload.payment_method ?? null,
        rating: payload.rating ?? null,
      },
    });
    void syncSuperAppOrderToCrm({
      token: auth.ctx.token,
      order: nextRecord,
      actorId: auth.ctx.userId,
      actorRole: isAdmin ? 'admin' : isMatchedDriver ? 'driver' : 'customer',
      eventType: `order.${payload.event}`,
      dispatchStatus: dispatchState?.status || null,
      metadataPatch: {
        lifecycle: {
          event: payload.event,
          status: nextRecord.status,
          stage: nextRecord.lifecycle_stage,
          amount_final_cents: payload.amount_final_cents ?? null,
          payment_method: payload.payment_method ?? null,
          rating: payload.rating ?? null,
        },
      },
    });

    return NextResponse.json(
      {
        data: {
          order_id: nextRecord.order_id,
          status: nextRecord.status,
          lifecycle_stage: nextRecord.lifecycle_stage,
          matched_driver_id: nextRecord.matched_driver_id || null,
          updated_at: nextRecord.last_event_at,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[SUPER_APP_ORDER_LIFECYCLE_ERROR]', error);
    return NextResponse.json({ error: 'Failed to update order lifecycle' }, { status: 500 });
  }
}
