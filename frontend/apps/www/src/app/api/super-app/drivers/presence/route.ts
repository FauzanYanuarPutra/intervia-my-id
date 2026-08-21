import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/serverAuth';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { getRedis } from '@/lib/redis';
import {
  getDispatchOrder,
  getDriverLocation,
  listDriverActiveOrders,
  publishOrderStreamEvent,
  setDriverOffline,
  setDriverOnline,
  type SuperAppService,
} from '@/lib/super-app/dispatch';
import { detectLocationAnomaly } from '@/lib/super-app/location-guard';
import {
  ingestDriverLocation,
  markDriverOfflineInGeospatial,
} from '@/lib/super-app/geospatial';
import { logSuperAppEvent } from '@/lib/super-app/observability';
import {
  persistSuperAppOrderSnapshot,
  syncSuperAppOrderToCrm,
  type SuperAppOrderRecord,
} from '@/lib/super-app/order-ops';

const DriverPresenceSchema = z.object({
  service: z.enum(['ride', 'car', 'food', 'send', 'mart', 'services']),
  online: z.boolean().default(true),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  heading_deg: z.number().min(0).max(360).optional(),
  speed_kmh: z.number().min(0).max(300).optional(),
  vehicle_type: z.string().max(80).optional(),
  order_id: z.string().min(8).max(120).optional(),
  sampled_at: z.string().datetime().optional(),
});
const ORDER_TTL_SECONDS = 24 * 60 * 60;

function canActAsDriver(roles: string[]): boolean {
  const normalized = new Set(roles.map((role) => role.toLowerCase()));
  return (
    normalized.has('admin') ||
    normalized.has('driver') ||
    normalized.has('provider') ||
    normalized.has('agent') ||
    normalized.has('freelancer') ||
    normalized.size === 0
  );
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    if (!canActAsDriver(auth.ctx.roles)) {
      return NextResponse.json({ error: 'Driver role required' }, { status: 403 });
    }

    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-driver-presence',
      ipLimit: 500,
      deviceLimit: 320,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:driver:presence:${auth.ctx.userId}:${security.ip}`,
      limit: 900,
      windowSeconds: 3600,
      message: 'Too many presence updates',
    });
    if (!rl.ok) return rl.response;

    const parsed = await parseJsonBodyWithSchema(req, DriverPresenceSchema);
    if (!parsed.ok) return parsed.response;

    const payload = parsed.data;
    const service = payload.service as SuperAppService;
    const driverId = auth.ctx.userId;

    if (!payload.online) {
      await setDriverOffline({ driverId, service });
      void markDriverOfflineInGeospatial(driverId);
      logSuperAppEvent('driver_presence_offline', {
        driver_id: driverId,
        service,
      });
      return NextResponse.json(
        {
          data: {
            driver_id: driverId,
            service,
            online: false,
          },
        },
        { status: 200 },
      );
    }

    const lat = payload.lat;
    const lng = payload.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: 'lat and lng are required when online=true' }, { status: 400 });
    }

    if (payload.sampled_at) {
      const sampledAt = new Date(payload.sampled_at).getTime();
      const now = Date.now();
      if (!Number.isFinite(sampledAt) || Math.abs(now - sampledAt) > 1000 * 60 * 15) {
        return NextResponse.json(
          { error: 'sampled_at timestamp is too skewed' },
          { status: 400 },
        );
      }
    }

    if (payload.order_id) {
      const dispatch = await getDispatchOrder(payload.order_id);
      if (!dispatch) {
        return NextResponse.json({ error: 'Dispatch order not found' }, { status: 404 });
      }
      if (dispatch.matched_driver_id !== driverId && !auth.ctx.roles.includes('admin')) {
        return NextResponse.json({ error: 'order_id is not assigned to this driver' }, { status: 403 });
      }
    }

    const previous = await getDriverLocation(driverId);
    const anomaly = detectLocationAnomaly({
      previous: previous
        ? {
            lat: previous.lat,
            lng: previous.lng,
            updatedAt: previous.updated_at,
          }
        : null,
      next: { lat, lng },
      hardRejectSpeedKmh: 220,
      hardRejectTeleportKm: 6,
    });
    if (anomaly.shouldReject) {
      logSuperAppEvent('driver_presence_rejected_anomaly', {
        driver_id: driverId,
        service,
        reason: anomaly.reason || 'unknown',
        speed_kmh: Number(anomaly.speedKmh.toFixed(2)),
        distance_km: Number(anomaly.distanceKm.toFixed(4)),
      });
      return NextResponse.json(
        { error: 'Location anomaly detected. Update rejected.' },
        { status: 422 },
      );
    }

    const location = await setDriverOnline({
      driverId,
      service,
      lat,
      lng,
      headingDeg: payload.heading_deg,
      speedKmh: payload.speed_kmh,
      vehicleType: payload.vehicle_type,
    });

    const geospatial = await ingestDriverLocation({
      driverId,
      service,
      lat,
      lng,
      headingDeg: payload.heading_deg,
      speedKmh: payload.speed_kmh,
      vehicleType: payload.vehicle_type,
      orderId: payload.order_id,
      sampleIntervalSeconds: 5,
      source: 'driver_presence',
    });

    const activeOrderIds = new Set<string>();
    if (payload.order_id) activeOrderIds.add(payload.order_id);
    const assignedOrders = await listDriverActiveOrders(driverId);
    for (const orderId of assignedOrders) activeOrderIds.add(orderId);

    await Promise.all(
      Array.from(activeOrderIds).map((orderId) =>
        publishOrderStreamEvent({
          orderId,
          event: {
            type: 'driver_location',
            order_id: orderId,
            driver_id: driverId,
            service,
            lat: location.lat,
            lng: location.lng,
            heading_deg: location.heading_deg ?? null,
            speed_kmh: location.speed_kmh ?? null,
            updated_at: location.updated_at,
            anomaly: geospatial.anomaly,
          },
        }),
      ),
    );
    if (payload.order_id) {
      const redis = getRedis();
      const orderRaw = await redis.get(`superapp:order:${payload.order_id}`);
      if (orderRaw) {
        try {
          const orderRecord = JSON.parse(orderRaw) as SuperAppOrderRecord;
          const shouldPromoteToInProgress =
            orderRecord.status !== 'in_progress' &&
            orderRecord.status !== 'delivered' &&
            orderRecord.status !== 'completed';
          if (shouldPromoteToInProgress) {
            const nextOrderRecord: SuperAppOrderRecord = {
              ...orderRecord,
              status: 'in_progress',
              lifecycle_stage: 'pickup_or_delivery_in_progress',
              matched_driver_id: driverId,
              last_event_at: new Date().toISOString(),
            };
            await redis.setex(
              `superapp:order:${payload.order_id}`,
              ORDER_TTL_SECONDS,
              JSON.stringify(nextOrderRecord),
            );
            void persistSuperAppOrderSnapshot({
              order: nextOrderRecord,
              actorId: driverId,
              actorRole: 'driver',
              eventType: 'driver.trip_started',
              eventPayload: {
                order_id: payload.order_id,
                dispatch_status: 'matched',
              },
            });
            void syncSuperAppOrderToCrm({
              token: auth.ctx.token,
              order: nextOrderRecord,
              actorId: driverId,
              actorRole: 'driver',
              eventType: 'driver.trip_started',
              dispatchStatus: 'matched',
              metadataPatch: {
                trip: {
                  started_at: nextOrderRecord.last_event_at,
                  driver_id: driverId,
                },
              },
            });
          }
        } catch (error) {
          console.warn('[SUPER_APP_DRIVER_PRESENCE_ORDER_SYNC_WARN]', error);
        }
      }
    }

    logSuperAppEvent('driver_presence_online_update', {
      driver_id: driverId,
      service,
      order_id: payload.order_id || null,
      active_order_count: activeOrderIds.size,
      anomaly: geospatial.anomaly.isAnomaly,
      sampled_point_inserted: geospatial.sampledPointInserted,
      persisted_pg: geospatial.persisted,
    });

    return NextResponse.json(
      {
        data: {
          ...location,
          online: true,
          anomaly: geospatial.anomaly,
          persisted_geospatial: geospatial.persisted,
          sampled_point_inserted: geospatial.sampledPointInserted,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[SUPER_APP_DRIVER_PRESENCE_ERROR]', error);
    return NextResponse.json({ error: 'Failed to update driver presence' }, { status: 500 });
  }
}
