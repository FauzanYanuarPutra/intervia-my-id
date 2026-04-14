import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  requireAuthMock,
  enforceAuthRouteSecurityMock,
  enforceRateLimitMock,
  parseJsonBodyWithSchemaMock,
  setDriverOfflineMock,
  setDriverOnlineMock,
  getDispatchOrderMock,
  getDriverLocationMock,
  listDriverActiveOrdersMock,
  publishOrderStreamEventMock,
  ingestDriverLocationMock,
  markDriverOfflineInGeospatialMock,
  logSuperAppEventMock,
  getRedisMock,
  persistSuperAppOrderSnapshotMock,
  syncSuperAppOrderToCrmMock,
} = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  enforceAuthRouteSecurityMock: vi.fn(),
  enforceRateLimitMock: vi.fn(),
  parseJsonBodyWithSchemaMock: vi.fn(),
  setDriverOfflineMock: vi.fn(),
  setDriverOnlineMock: vi.fn(),
  getDispatchOrderMock: vi.fn(),
  getDriverLocationMock: vi.fn(),
  listDriverActiveOrdersMock: vi.fn(),
  publishOrderStreamEventMock: vi.fn(),
  ingestDriverLocationMock: vi.fn(),
  markDriverOfflineInGeospatialMock: vi.fn(),
  logSuperAppEventMock: vi.fn(),
  getRedisMock: vi.fn(),
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
  getDispatchOrder: getDispatchOrderMock,
  getDriverLocation: getDriverLocationMock,
  listDriverActiveOrders: listDriverActiveOrdersMock,
  publishOrderStreamEvent: publishOrderStreamEventMock,
  setDriverOffline: setDriverOfflineMock,
  setDriverOnline: setDriverOnlineMock,
}));

vi.mock('@/lib/super-app/geospatial', () => ({
  ingestDriverLocation: ingestDriverLocationMock,
  markDriverOfflineInGeospatial: markDriverOfflineInGeospatialMock,
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
  new Request('http://localhost/api/super-app/drivers/presence', {
    method: 'POST',
    body: '{}',
  }) as unknown as import('next/server').NextRequest;

describe('POST /api/super-app/drivers/presence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    requireAuthMock.mockResolvedValue({
      ok: true,
      ctx: { userId: 'driver-1', roles: ['driver'] },
    });
    enforceAuthRouteSecurityMock.mockResolvedValue({
      ok: true,
      ip: '127.0.0.1',
    });
    enforceRateLimitMock.mockResolvedValue({
      ok: true,
    });
    listDriverActiveOrdersMock.mockResolvedValue([]);
    publishOrderStreamEventMock.mockResolvedValue(undefined);
    ingestDriverLocationMock.mockResolvedValue({
      persisted: true,
      sampledPointInserted: true,
      anomaly: {
        isAnomaly: false,
        shouldReject: false,
        speedKmh: 34,
        distanceKm: 0.04,
      },
    });
    getRedisMock.mockReturnValue({
      get: vi.fn().mockResolvedValue(null),
      setex: vi.fn().mockResolvedValue('OK'),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects update when anomaly is too high', async () => {
    parseJsonBodyWithSchemaMock.mockResolvedValue({
      ok: true,
      data: {
        service: 'ride',
        online: true,
        lat: -6.02,
        lng: 107.02,
      },
    });
    getDriverLocationMock.mockResolvedValue({
      lat: -6.2088,
      lng: 106.8456,
      updated_at: '2026-03-08T09:00:00.000Z',
    });
    vi.setSystemTime(new Date('2026-03-08T09:00:10.000Z'));

    const res = await POST(makeReq());
    expect(res.status).toBe(422);
    expect(setDriverOnlineMock).not.toHaveBeenCalled();
  });

  it('accepts valid update and publishes location stream event', async () => {
    parseJsonBodyWithSchemaMock.mockResolvedValue({
      ok: true,
      data: {
        service: 'ride',
        online: true,
        lat: -6.20881,
        lng: 106.84561,
        order_id: 'order-12345678',
      },
    });
    getDriverLocationMock.mockResolvedValue(null);
    getDispatchOrderMock.mockResolvedValue({
      order_id: 'order-12345678',
      requester_id: 'user-1',
      service: 'ride',
      pickup: { lat: -6.2, lng: 106.8 },
      status: 'matched',
      matched_driver_id: 'driver-1',
      created_at: '2026-03-08T09:00:00.000Z',
      last_radius_m: 1000,
      notified_driver_ids: [],
    });
    listDriverActiveOrdersMock.mockResolvedValue(['order-12345678']);
    setDriverOnlineMock.mockResolvedValue({
      driver_id: 'driver-1',
      service: 'ride',
      lat: -6.20881,
      lng: 106.84561,
      updated_at: '2026-03-08T09:00:30.000Z',
    });

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(setDriverOnlineMock).toHaveBeenCalledTimes(1);
    expect(ingestDriverLocationMock).toHaveBeenCalledTimes(1);
    expect(publishOrderStreamEventMock).toHaveBeenCalledTimes(1);
  });
});
