import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  requireAuthMock,
  enforceAuthRouteSecurityMock,
  enforceRateLimitMock,
  parseJsonBodyWithSchemaMock,
  getRedisMock,
  getDispatchOrderMock,
  getNearbyDriversMock,
  createOrUpdateDispatchOrderMock,
  pushDispatchNotificationsMock,
  upsertDispatchOrderSnapshotMock,
  logSuperAppEventMock,
  persistSuperAppOrderSnapshotMock,
  syncSuperAppOrderToCrmMock,
} = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  enforceAuthRouteSecurityMock: vi.fn(),
  enforceRateLimitMock: vi.fn(),
  parseJsonBodyWithSchemaMock: vi.fn(),
  getRedisMock: vi.fn(),
  getDispatchOrderMock: vi.fn(),
  getNearbyDriversMock: vi.fn(),
  createOrUpdateDispatchOrderMock: vi.fn(),
  pushDispatchNotificationsMock: vi.fn(),
  upsertDispatchOrderSnapshotMock: vi.fn(),
  logSuperAppEventMock: vi.fn(),
  persistSuperAppOrderSnapshotMock: vi.fn(),
  syncSuperAppOrderToCrmMock: vi.fn(),
}));

vi.mock('@/lib/serverAuth', () => ({
  requireAuth: requireAuthMock,
}));

vi.mock('@/lib/authSecurity', () => ({
  enforceAuthRouteSecurity: enforceAuthRouteSecurityMock,
}));

vi.mock('@/lib/rateLimit', () => ({
  enforceRateLimit: enforceRateLimitMock,
}));

vi.mock('@/lib/serverRequest', () => ({
  parseJsonBodyWithSchema: parseJsonBodyWithSchemaMock,
}));

vi.mock('@/lib/redis', () => ({
  getRedis: getRedisMock,
}));

vi.mock('@/lib/super-app/dispatch', () => ({
  buildRadiusPlan: vi.fn(() => [120, 300]),
  getDispatchOrder: getDispatchOrderMock,
  getNearbyDrivers: getNearbyDriversMock,
  createOrUpdateDispatchOrder: createOrUpdateDispatchOrderMock,
  pushDispatchNotifications: pushDispatchNotificationsMock,
}));

vi.mock('@/lib/super-app/geospatial', () => ({
  upsertDispatchOrderSnapshot: upsertDispatchOrderSnapshotMock,
}));

vi.mock('@/lib/super-app/observability', () => ({
  logSuperAppEvent: logSuperAppEventMock,
}));

vi.mock('@/lib/super-app/order-ops', () => ({
  persistSuperAppOrderSnapshot: persistSuperAppOrderSnapshotMock,
  syncSuperAppOrderToCrm: syncSuperAppOrderToCrmMock,
}));

import { POST } from './route';

const makeReq = () =>
  new Request('http://localhost/api/super-app/dispatch/match', {
    method: 'POST',
    body: '{}',
  }) as unknown as import('next/server').NextRequest;

describe('POST /api/super-app/dispatch/match', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue({
      ok: true,
      ctx: { userId: 'user-1', roles: [] },
    });
    enforceAuthRouteSecurityMock.mockResolvedValue({
      ok: true,
      ip: '127.0.0.1',
    });
    enforceRateLimitMock.mockResolvedValue({
      ok: true,
    });
  });

  it('rejects when requested service mismatches stored order service', async () => {
    parseJsonBodyWithSchemaMock.mockResolvedValue({
      ok: true,
      data: {
        order_id: 'order-12345678',
        service: 'car',
        pickup_lat: -6.11,
        pickup_lng: 106.81,
      },
    });
    getRedisMock.mockReturnValue({
      get: vi.fn().mockResolvedValue(
        JSON.stringify({
          order_id: 'order-12345678',
          user_id: 'user-1',
          service: 'ride',
          status: 'ready_for_dispatch',
          payload: {
            pickup_lat: -6.2,
            pickup_lng: 106.8,
          },
        }),
      ),
      setex: vi.fn().mockResolvedValue('OK'),
    });

    const res = await POST(makeReq());
    expect(res.status).toBe(400);
    expect(getNearbyDriversMock).not.toHaveBeenCalled();
  });

  it('uses pickup coordinates from stored order payload', async () => {
    parseJsonBodyWithSchemaMock.mockResolvedValue({
      ok: true,
      data: {
        order_id: 'order-12345678',
        service: 'ride',
        pickup_lat: -7.1,
        pickup_lng: 107.1,
      },
    });
    getRedisMock.mockReturnValue({
      get: vi.fn().mockResolvedValue(
        JSON.stringify({
          order_id: 'order-12345678',
          user_id: 'user-1',
          service: 'ride',
          status: 'ready_for_dispatch',
          payload: {
            pickup_lat: -6.222222,
            pickup_lng: 106.812345,
          },
        }),
      ),
      setex: vi.fn().mockResolvedValue('OK'),
    });
    getDispatchOrderMock.mockResolvedValue(null);
    getNearbyDriversMock.mockResolvedValue([
      {
        driver_id: 'driver-1',
        service: 'ride',
        lat: -6.223,
        lng: 106.813,
        distance_m: 190,
        eta_minutes: 2,
        location_age_s: 3,
        match_score: 320,
        updated_at: '2026-03-08T12:00:00.000Z',
      },
    ]);
    createOrUpdateDispatchOrderMock.mockResolvedValue({
      order_id: 'order-12345678',
      requester_id: 'user-1',
      service: 'ride',
      pickup: { lat: -6.222222, lng: 106.812345 },
      status: 'searching',
      created_at: '2026-03-08T12:00:00.000Z',
      last_search_at: '2026-03-08T12:00:00.000Z',
      search_attempts: 1,
      max_radius_empty_rounds: 0,
      last_radius_m: 120,
      notified_driver_ids: ['driver-1'],
    });
    pushDispatchNotificationsMock.mockResolvedValue(1);
    upsertDispatchOrderSnapshotMock.mockResolvedValue(true);

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(getNearbyDriversMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lat: -6.222222,
        lng: 106.812345,
      }),
    );
  });
});
