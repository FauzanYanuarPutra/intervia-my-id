import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRedis } from '@/lib/redis';
import { requireAuth } from '@/lib/serverAuth';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import {
  buildRadiusPlan,
  createOrUpdateDispatchOrder,
  getDispatchOrder,
  getNearbyDrivers,
  publishOrderStreamEvent,
  pushDispatchNotifications,
  type SuperAppService,
} from '@/lib/super-app/dispatch';
import { upsertDispatchOrderSnapshot } from '@/lib/super-app/geospatial';
import { logSuperAppEvent } from '@/lib/super-app/observability';
import {
  persistSuperAppOrderSnapshot,
  syncSuperAppOrderToCrm,
  type SuperAppOrderRecord,
} from '@/lib/super-app/order-ops';

const MatchSchema = z.object({
  order_id: z.string().min(8).max(120),
  service: z.enum(['ride', 'car', 'food', 'send', 'mart', 'services']),
  pickup_lat: z.number().min(-90).max(90).optional(),
  pickup_lng: z.number().min(-180).max(180).optional(),
  initial_radius_m: z.number().min(50).max(5000).optional(),
  max_radius_m: z.number().min(100).max(10000).optional(),
  notify_limit: z.number().min(1).max(30).optional(),
  restart_search: z.boolean().optional(),
});

const ORDER_TTL_SECONDS = 24 * 60 * 60;

type StoredOrderRecord = SuperAppOrderRecord;

function clampIntEnv(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(process.env[name] || `${fallback}`, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function getMatchTimeoutSeconds(): number {
  return clampIntEnv('SUPER_APP_MATCH_TIMEOUT_SEC', 120, 30, 900);
}

function getMaxStalledRoundsAtMaxRadius(): number {
  return clampIntEnv('SUPER_APP_MATCH_MAX_STALLED_ROUNDS', 6, 2, 30);
}

function getRestartSearchCooldownSeconds(): number {
  return clampIntEnv('SUPER_APP_MATCH_RESTART_COOLDOWN_SEC', 15, 5, 120);
}

function serviceMaxRadius(service: SuperAppService): number {
  if (service === 'ride' || service === 'send') return 2200;
  if (service === 'car') return 3500;
  return 2800;
}

function serviceInitialRadius(service: SuperAppService): number {
  if (service === 'ride' || service === 'send') return 120;
  if (service === 'car') return 180;
  return 160;
}

function toNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolvePickupFromOrder(payload: Record<string, unknown> | undefined): {
  lat: number;
  lng: number;
} | null {
  if (!payload) return null;
  const lat = toNumber(payload.pickup_lat);
  const lng = toNumber(payload.pickup_lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat!) > 90 || Math.abs(lng!) > 180) return null;
  return { lat: lat!, lng: lng! };
}

function parseScheduledAtValue(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-dispatch-match',
      ipLimit: 240,
      deviceLimit: 180,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:dispatch:match:${auth.ctx.userId}:${security.ip}`,
      limit: 180,
      windowSeconds: 3600,
      message: 'Too many matching requests',
    });
    if (!rl.ok) return rl.response;

    const parsed = await parseJsonBodyWithSchema(req, MatchSchema);
    if (!parsed.ok) return parsed.response;

    const payload = parsed.data;
    const notifyLimit = payload.notify_limit ?? 12;
    const matchTimeoutSeconds = getMatchTimeoutSeconds();
    const maxStalledRoundsAtMaxRadius = getMaxStalledRoundsAtMaxRadius();
    const restartSearchCooldownSeconds = getRestartSearchCooldownSeconds();
    const redis = getRedis();
    const orderRaw = await redis.get(`superapp:order:${payload.order_id}`);
    if (!orderRaw) {
      return NextResponse.json({ error: 'Order intent not found' }, { status: 404 });
    }

    let orderRecord: StoredOrderRecord | null = null;
    try {
      orderRecord = JSON.parse(orderRaw) as StoredOrderRecord;
    } catch {
      orderRecord = null;
    }
    if (!orderRecord) {
      return NextResponse.json({ error: 'Order record is invalid' }, { status: 422 });
    }

    const isAdmin = auth.ctx.roles.includes('admin');
    if (!isAdmin && orderRecord.user_id !== auth.ctx.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const scheduledAt = parseScheduledAtValue(orderRecord.payload?.scheduled_at);
    if (!isAdmin && scheduledAt && scheduledAt.getTime() > Date.now()) {
      return NextResponse.json(
        {
          error: 'Order is scheduled for later dispatch',
          available_at: scheduledAt.toISOString(),
        },
        { status: 409 },
      );
    }

    if (orderRecord.status === 'scheduled' && (!scheduledAt || scheduledAt.getTime() <= Date.now())) {
      orderRecord = {
        ...orderRecord,
        status: 'ready_for_dispatch',
        lifecycle_stage: 'ready_for_dispatch',
        last_event_at: new Date().toISOString(),
      };
      await redis.setex(
        `superapp:order:${payload.order_id}`,
        ORDER_TTL_SECONDS,
        JSON.stringify(orderRecord),
      );
      void persistSuperAppOrderSnapshot({
        order: orderRecord,
        actorId: auth.ctx.userId,
        actorRole: isAdmin ? 'admin' : 'customer',
        eventType: 'dispatch.ready',
        eventPayload: {
          status: orderRecord.status,
          lifecycle_stage: orderRecord.lifecycle_stage,
        },
      });
      void syncSuperAppOrderToCrm({
        token: auth.ctx.token,
        order: orderRecord,
        actorId: auth.ctx.userId,
        actorRole: isAdmin ? 'admin' : 'customer',
        eventType: 'dispatch.ready',
        dispatchStatus: null,
        metadataPatch: {
          dispatch: {
            status: 'ready_for_dispatch',
          },
        },
      });
    }

    if (!isAdmin && orderRecord.status !== 'ready_for_dispatch') {
      return NextResponse.json(
        { error: 'Order requires verification before dispatch' },
        { status: 409 },
      );
    }

    const service = orderRecord.service as SuperAppService;
    if (payload.service !== service) {
      return NextResponse.json(
        { error: 'Service mismatch between request and order record' },
        { status: 400 },
      );
    }

    const pickupFromOrder = resolvePickupFromOrder(orderRecord.payload);
    const pickup = pickupFromOrder ||
      (payload.pickup_lat !== undefined && payload.pickup_lng !== undefined
        ? { lat: payload.pickup_lat, lng: payload.pickup_lng }
        : null);
    if (!pickup) {
      return NextResponse.json(
        { error: 'pickup coordinates are not available for dispatch' },
        { status: 400 },
      );
    }

    const currentState = await getDispatchOrder(payload.order_id);
    const restartSearch = Boolean(payload.restart_search);
    if (currentState?.status === 'matched' && currentState.matched_driver_id) {
      return NextResponse.json(
        {
          data: {
            order_id: payload.order_id,
            status: currentState.status,
            status_reason: currentState.status_reason || null,
            radius_used_m: currentState.last_radius_m,
            candidates: [],
            notified_count: 0,
            search_attempts: currentState.search_attempts,
            unavailable_message: null,
          },
        },
        { status: 200 },
      );
    }
    if (restartSearch && currentState?.status !== 'expired') {
      return NextResponse.json(
        { error: 'restart_search is only allowed when dispatch status is expired' },
        { status: 409 },
      );
    }
    if (restartSearch && currentState?.last_search_at) {
      const elapsed = Math.max(
        0,
        Math.round((Date.now() - new Date(currentState.last_search_at).getTime()) / 1000),
      );
      if (elapsed < restartSearchCooldownSeconds) {
        return NextResponse.json(
          { error: 'Please wait before restarting search', retry_after_seconds: restartSearchCooldownSeconds - elapsed },
          { status: 429 },
        );
      }
    }

    const cappedMaxRadius = Math.min(
      payload.max_radius_m || serviceMaxRadius(service),
      serviceMaxRadius(service),
    );
    const radiusPlan = buildRadiusPlan(
      payload.initial_radius_m || serviceInitialRadius(service),
      cappedMaxRadius,
    );
    const alreadyNotified = new Set(
      restartSearch ? [] : currentState?.notified_driver_ids || [],
    );

    let selectedCandidates = [] as Awaited<ReturnType<typeof getNearbyDrivers>>;
    let usedRadius = radiusPlan[0];
    for (const radius of radiusPlan) {
      const nearby = await getNearbyDrivers({
        service,
        lat: pickup.lat,
        lng: pickup.lng,
        radiusM: radius,
        limit: notifyLimit,
      });
      if (nearby.length > 0) {
        selectedCandidates = nearby;
        usedRadius = radius;
        break;
      }
      usedRadius = radius;
    }

    const newCandidates = selectedCandidates.filter(
      (item) => !alreadyNotified.has(item.driver_id),
    );
    const maxRadius = radiusPlan[radiusPlan.length - 1];
    const stalledAtMaxRadius = usedRadius >= maxRadius && newCandidates.length === 0;
    const nextStalledRounds = stalledAtMaxRadius
      ? (currentState?.max_radius_empty_rounds || 0) + 1
      : 0;
    const elapsedSeconds = currentState?.created_at
      ? Math.max(0, Math.round((Date.now() - new Date(currentState.created_at).getTime()) / 1000))
      : 0;
    const timeoutReached = elapsedSeconds >= matchTimeoutSeconds;
    const shouldExpire =
      stalledAtMaxRadius &&
      (timeoutReached || nextStalledRounds >= maxStalledRoundsAtMaxRadius);
    const nextStatus = shouldExpire ? 'expired' : 'searching';
    const statusReason = shouldExpire
      ? (timeoutReached ? 'search_timeout' : 'no_driver_available')
      : undefined;

    const notifiedDriverIds = newCandidates.map((item) => item.driver_id);
    const orderState = await createOrUpdateDispatchOrder({
      orderId: payload.order_id,
      requesterId: orderRecord.user_id,
      service,
      pickup,
      radiusM: usedRadius,
      status: nextStatus,
      statusReason,
      reachedMaxRadiusWithoutCandidate: stalledAtMaxRadius,
      resetNotifiedDrivers: restartSearch,
      appendNotifiedDriverIds: notifiedDriverIds,
    });

    const notifiedCount =
      newCandidates.length > 0
        ? await pushDispatchNotifications({
            orderId: payload.order_id,
            service,
            requesterId: orderRecord.user_id,
            radiusM: usedRadius,
            pickup,
            candidates: newCandidates,
          })
        : 0;

    void upsertDispatchOrderSnapshot({
      orderId: payload.order_id,
      service,
      requesterId: orderRecord.user_id,
      status: orderState.status,
      pickup,
      radiusM: usedRadius,
      notifiedDriverIds: orderState.notified_driver_ids,
      matchedDriverId: orderState.matched_driver_id,
      matchedAt: orderState.matched_at,
    });
    if (orderState.status === 'expired' && currentState?.status !== 'expired') {
      await publishOrderStreamEvent({
        orderId: payload.order_id,
        event: {
          type: 'dispatch_expired',
          order_id: payload.order_id,
          status: 'expired',
          status_reason: orderState.status_reason || null,
          search_attempts: orderState.search_attempts,
          radius_used_m: usedRadius,
          ts: new Date().toISOString(),
        },
      });
    }

    const nextOrderRecord: StoredOrderRecord = {
      ...orderRecord,
      lifecycle_stage:
        orderState.status === 'expired'
          ? 'driver_search_expired'
          : 'driver_searching',
      last_event_at: new Date().toISOString(),
    };
    await redis.setex(
      `superapp:order:${payload.order_id}`,
      ORDER_TTL_SECONDS,
      JSON.stringify(nextOrderRecord),
    );
    void persistSuperAppOrderSnapshot({
      order: nextOrderRecord,
      actorId: auth.ctx.userId,
      actorRole: auth.ctx.roles.includes('admin') ? 'admin' : 'customer',
      eventType:
        orderState.status === 'expired'
          ? 'dispatch.search_expired'
          : 'dispatch.searching',
      eventPayload: {
        dispatch_status: orderState.status,
        status_reason: orderState.status_reason || null,
        radius_used_m: usedRadius,
        search_attempts: orderState.search_attempts,
        notified_count: notifiedCount,
      },
    });
    void syncSuperAppOrderToCrm({
      token: auth.ctx.token,
      order: nextOrderRecord,
      actorId: auth.ctx.userId,
      actorRole: auth.ctx.roles.includes('admin') ? 'admin' : 'customer',
      eventType:
        orderState.status === 'expired'
          ? 'dispatch.search_expired'
          : 'dispatch.searching',
      dispatchStatus: orderState.status,
      metadataPatch: {
        dispatch: {
          status: orderState.status,
          status_reason: orderState.status_reason || null,
          radius_used_m: usedRadius,
          search_attempts: orderState.search_attempts,
          notified_count: notifiedCount,
        },
      },
    });

    logSuperAppEvent('dispatch_match_executed', {
      order_id: payload.order_id,
      requester_id: orderRecord.user_id,
      actor_id: auth.ctx.userId,
      radius_used_m: usedRadius,
      candidates_found: selectedCandidates.length,
      newly_notified: notifiedCount,
      search_attempts: orderState.search_attempts,
      status: orderState.status,
      status_reason: orderState.status_reason || null,
      restart_search: restartSearch,
    });

    return NextResponse.json(
      {
        data: {
          order_id: payload.order_id,
          status: orderState.status,
          status_reason: orderState.status_reason || null,
          radius_used_m: usedRadius,
          candidates: selectedCandidates,
          notified_count: notifiedCount,
          search_attempts: orderState.search_attempts,
          unavailable_message:
            orderState.status === 'expired'
              ? 'No active nearby drivers right now. Please try again shortly or adjust pickup point.'
              : null,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[SUPER_APP_DISPATCH_MATCH_ERROR]', error);
    return NextResponse.json({ error: 'Failed to run dispatch matching' }, { status: 500 });
  }
}
