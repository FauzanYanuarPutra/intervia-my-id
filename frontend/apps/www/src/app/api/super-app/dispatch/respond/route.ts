import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/serverAuth';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { withIdempotency } from '@/lib/idempotency';
import { getRedis } from '@/lib/redis';
import { getDispatchOrder, getDriverLocation, publishOrderStreamEvent, resolveDispatchWinner } from '@/lib/super-app/dispatch';
import { upsertDispatchOrderSnapshot } from '@/lib/super-app/geospatial';
import { logSuperAppEvent } from '@/lib/super-app/observability';
import {
  persistSuperAppOrderSnapshot,
  syncSuperAppOrderToCrm,
  type SuperAppOrderRecord,
} from '@/lib/super-app/order-ops';

const RespondSchema = z.object({
  order_id: z.string().min(8).max(120),
  accept: z.boolean(),
});
const ORDER_TTL_SECONDS = 24 * 60 * 60;

function getAcceptFreshnessSeconds(): number {
  const parsed = Number.parseInt(process.env.SUPER_APP_DRIVER_ACCEPT_FRESHNESS_SEC || '35', 10);
  if (!Number.isFinite(parsed)) return 35;
  return Math.max(10, Math.min(180, parsed));
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-dispatch-respond',
      ipLimit: 300,
      deviceLimit: 220,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:dispatch:respond:${auth.ctx.userId}:${security.ip}`,
      limit: 300,
      windowSeconds: 3600,
      message: 'Too many dispatch responses',
    });
    if (!rl.ok) return rl.response;

    const handleRespond = async (): Promise<Response> => {
      const parsed = await parseJsonBodyWithSchema(req, RespondSchema);
      if (!parsed.ok) return parsed.response;

      const payload = parsed.data;
      const state = await getDispatchOrder(payload.order_id);
      if (!state) {
        return NextResponse.json({ error: 'Dispatch order not found' }, { status: 404 });
      }
      if (state.status === 'matched') {
        if (state.matched_driver_id === auth.ctx.userId) {
          return NextResponse.json(
            {
              data: {
                order_id: payload.order_id,
                accepted: true,
                winner_driver_id: state.matched_driver_id,
                status: 'matched',
              },
            },
            { status: 200 },
          );
        }
        return NextResponse.json(
          {
            data: {
              order_id: payload.order_id,
              accepted: false,
              winner_driver_id: state.matched_driver_id || null,
              reason: 'already_taken',
            },
          },
          { status: 409 },
        );
      }
      if (state.status === 'expired') {
        return NextResponse.json(
          {
            data: {
              order_id: payload.order_id,
              accepted: false,
              reason: 'dispatch_closed',
            },
          },
          { status: 409 },
        );
      }
      if (!state.notified_driver_ids.includes(auth.ctx.userId)) {
        return NextResponse.json(
          {
            error: 'Driver is not part of this dispatch candidate list',
          },
          { status: 403 },
        );
      }

      if (!payload.accept) {
        logSuperAppEvent('dispatch_response_skip', {
          order_id: payload.order_id,
          driver_id: auth.ctx.userId,
        });
        return NextResponse.json(
          {
            data: {
              order_id: payload.order_id,
              accepted: false,
              status: state.status,
            },
          },
          { status: 200 },
        );
      }

      const liveLocation = await getDriverLocation(auth.ctx.userId);
      if (!liveLocation) {
        return NextResponse.json(
          {
            data: {
              order_id: payload.order_id,
              accepted: false,
              reason: 'driver_offline',
            },
          },
          { status: 409 },
        );
      }
      if (liveLocation.service !== state.service) {
        return NextResponse.json(
          {
            data: {
              order_id: payload.order_id,
              accepted: false,
              reason: 'driver_service_mismatch',
            },
          },
          { status: 409 },
        );
      }
      const freshnessSeconds = Math.max(
        0,
        Math.round((Date.now() - new Date(liveLocation.updated_at).getTime()) / 1000),
      );
      if (freshnessSeconds > getAcceptFreshnessSeconds()) {
        return NextResponse.json(
          {
            data: {
              order_id: payload.order_id,
              accepted: false,
              reason: 'driver_location_stale',
            },
          },
          { status: 409 },
        );
      }

      const winner = await resolveDispatchWinner({
        orderId: payload.order_id,
        driverId: auth.ctx.userId,
      });

      if (!winner.ok) {
        logSuperAppEvent('dispatch_response_already_taken', {
          order_id: payload.order_id,
          driver_id: auth.ctx.userId,
          winner_driver_id: winner.winnerDriverId || null,
        });
        return NextResponse.json(
          {
            data: {
              order_id: payload.order_id,
              accepted: false,
              winner_driver_id: winner.winnerDriverId || null,
              reason: 'already_taken',
            },
          },
          { status: 409 },
        );
      }

      const latestState = await getDispatchOrder(payload.order_id);
      if (latestState) {
        void upsertDispatchOrderSnapshot({
          orderId: latestState.order_id,
          service: latestState.service,
          requesterId: latestState.requester_id,
          status: latestState.status,
          pickup: latestState.pickup,
          radiusM: latestState.last_radius_m,
          notifiedDriverIds: latestState.notified_driver_ids,
          matchedDriverId: latestState.matched_driver_id,
          matchedAt: latestState.matched_at,
        });
      }

      await publishOrderStreamEvent({
        orderId: payload.order_id,
        event: {
          type: 'driver_matched',
          order_id: payload.order_id,
          matched_driver_id: winner.winnerDriverId,
          matched_at: new Date().toISOString(),
        },
      });
      const redis = getRedis();
      const orderRaw = await redis.get(`superapp:order:${payload.order_id}`);
      if (orderRaw) {
        try {
          const orderRecord = JSON.parse(orderRaw) as SuperAppOrderRecord;
          const nextOrderRecord: SuperAppOrderRecord = {
            ...orderRecord,
            lifecycle_stage: 'driver_assigned',
            matched_driver_id: winner.winnerDriverId || auth.ctx.userId,
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
            actorRole: 'driver',
            eventType: 'dispatch.driver_assigned',
            eventPayload: {
              dispatch_status: 'matched',
              matched_driver_id: winner.winnerDriverId || auth.ctx.userId,
            },
          });
          void syncSuperAppOrderToCrm({
            token: auth.ctx.token,
            order: nextOrderRecord,
            actorId: auth.ctx.userId,
            actorRole: 'driver',
            eventType: 'dispatch.driver_assigned',
            dispatchStatus: 'matched',
            metadataPatch: {
              dispatch: {
                status: 'matched',
                matched_driver_id: winner.winnerDriverId || auth.ctx.userId,
              },
            },
          });
        } catch (error) {
          console.warn('[SUPER_APP_DISPATCH_RESPOND_ORDER_SYNC_WARN]', error);
        }
      }

      logSuperAppEvent('dispatch_response_accept', {
        order_id: payload.order_id,
        driver_id: auth.ctx.userId,
      });

      return NextResponse.json(
        {
          data: {
            order_id: payload.order_id,
            accepted: true,
            winner_driver_id: winner.winnerDriverId,
            status: 'matched',
          },
        },
        { status: 200 },
      );
    };

    if (req.headers.get('x-idempotency-key')) {
      return withIdempotency(req, {
        scope: 'super-app-dispatch-respond',
        actorHint: auth.ctx.userId,
        ttlSeconds: 60 * 30,
        forward: handleRespond,
      });
    }

    return (await handleRespond()) as NextResponse;
  } catch (error) {
    console.error('[SUPER_APP_DISPATCH_RESPOND_ERROR]', error);
    return NextResponse.json({ error: 'Failed to respond dispatch' }, { status: 500 });
  }
}
