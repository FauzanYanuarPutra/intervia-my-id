import crypto from 'node:crypto';
import { getRedis } from '@/lib/redis';

export type SuperAppService =
  | 'ride'
  | 'car'
  | 'food'
  | 'send'
  | 'mart'
  | 'services';

export type DriverLocationRecord = {
  driver_id: string;
  service: SuperAppService;
  lat: number;
  lng: number;
  heading_deg?: number;
  speed_kmh?: number;
  vehicle_type?: string;
  updated_at: string;
};

export type NearbyDriverCandidate = DriverLocationRecord & {
  distance_m: number;
  eta_minutes: number;
  location_age_s: number;
  match_score: number;
};

export type DispatchOrderState = {
  order_id: string;
  requester_id: string;
  service: SuperAppService;
  pickup: { lat: number; lng: number };
  status: 'searching' | 'matched' | 'expired';
  status_reason?: 'no_driver_available' | 'search_timeout' | 'manual';
  matched_driver_id?: string;
  matched_at?: string;
  created_at: string;
  last_search_at: string;
  search_attempts: number;
  max_radius_empty_rounds: number;
  last_radius_m: number;
  notified_driver_ids: string[];
};

function geoKey(service: SuperAppService): string {
  return `superapp:geo:${service}`;
}

function driverLocationKey(driverId: string): string {
  return `superapp:driver:location:${driverId}`;
}

function driverInboxKey(driverId: string): string {
  return `superapp:driver:dispatch:${driverId}`;
}

function dispatchOrderKey(orderId: string): string {
  return `superapp:dispatch:order:${orderId}`;
}

function dispatchWinnerKey(orderId: string): string {
  return `superapp:dispatch:winner:${orderId}`;
}

function driverOrdersKey(driverId: string): string {
  return `superapp:driver:orders:${driverId}`;
}

function orderStreamChannel(orderId: string): string {
  return `superapp:stream:order:${orderId}`;
}

function parseNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getDriverFreshnessSeconds(): number {
  const parsed = Number.parseInt(process.env.SUPER_APP_DRIVER_FRESHNESS_SEC || '25', 10);
  if (!Number.isFinite(parsed)) return 25;
  return Math.max(5, Math.min(120, parsed));
}

function estimateEtaMinutes(distanceM: number, speedKmh?: number): number {
  const speed = Math.max(8, Math.min(70, speedKmh || 24));
  const minutes = (distanceM / 1000 / speed) * 60;
  return Math.max(1, Math.ceil(minutes));
}

function buildMatchScore(input: {
  distanceM: number;
  etaMinutes: number;
  locationAgeSeconds: number;
  speedKmh?: number;
}): number {
  const speedPenalty = Math.max(0, 35 - Math.max(0, input.speedKmh || 0)) * 4;
  const freshnessPenalty = input.locationAgeSeconds * 11;
  return Math.round(
    input.distanceM + input.etaMinutes * 120 + freshnessPenalty + speedPenalty,
  );
}

export async function setDriverOnline(input: {
  driverId: string;
  service: SuperAppService;
  lat: number;
  lng: number;
  headingDeg?: number;
  speedKmh?: number;
  vehicleType?: string;
}): Promise<DriverLocationRecord> {
  const redis = getRedis();
  const now = new Date().toISOString();
  const payload: DriverLocationRecord = {
    driver_id: input.driverId,
    service: input.service,
    lat: input.lat,
    lng: input.lng,
    heading_deg: input.headingDeg,
    speed_kmh: input.speedKmh,
    vehicle_type: input.vehicleType,
    updated_at: now,
  };

  await redis.call('GEOADD', geoKey(input.service), input.lng, input.lat, input.driverId);
  await redis.setex(driverLocationKey(input.driverId), 120, JSON.stringify(payload));
  return payload;
}

export async function setDriverOffline(input: {
  driverId: string;
  service: SuperAppService;
}): Promise<void> {
  const redis = getRedis();
  await redis.call('ZREM', geoKey(input.service), input.driverId);
  await redis.del(driverLocationKey(input.driverId));
}

export async function bindDriverToOrder(input: {
  driverId: string;
  orderId: string;
  ttlSeconds?: number;
}): Promise<void> {
  const redis = getRedis();
  const ttl = Math.max(300, input.ttlSeconds || 7200);
  const key = driverOrdersKey(input.driverId);
  await redis.sadd(key, input.orderId);
  await redis.expire(key, ttl);
}

export async function unbindDriverFromOrder(input: {
  driverId: string;
  orderId: string;
}): Promise<void> {
  const redis = getRedis();
  await redis.srem(driverOrdersKey(input.driverId), input.orderId);
}

export async function listDriverActiveOrders(driverId: string): Promise<string[]> {
  const redis = getRedis();
  const members = await redis.smembers(driverOrdersKey(driverId));
  return (members || []).map((value) => String(value || '').trim()).filter(Boolean);
}

export async function publishOrderStreamEvent(input: {
  orderId: string;
  event: Record<string, unknown>;
}): Promise<void> {
  const redis = getRedis();
  await redis.publish(orderStreamChannel(input.orderId), JSON.stringify(input.event));
}

export function getOrderStreamChannel(orderId: string): string {
  return orderStreamChannel(orderId);
}

export async function getDriverLocation(driverId: string): Promise<DriverLocationRecord | null> {
  const redis = getRedis();
  const raw = await redis.get(driverLocationKey(driverId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DriverLocationRecord;
  } catch {
    return null;
  }
}

export async function getNearbyDrivers(input: {
  service: SuperAppService;
  lat: number;
  lng: number;
  radiusM: number;
  limit: number;
}): Promise<NearbyDriverCandidate[]> {
  const redis = getRedis();
  const freshnessSec = getDriverFreshnessSeconds();
  const raw = (await redis.call(
    'GEOSEARCH',
    geoKey(input.service),
    'FROMLONLAT',
    input.lng,
    input.lat,
    'BYRADIUS',
    input.radiusM,
    'm',
    'WITHDIST',
    'ASC',
    'COUNT',
    input.limit,
  )) as Array<[string, string]>;

  const candidateRows = (raw || [])
    .map((row) => ({
      driverId: String(row?.[0] || '').trim(),
      distanceM: parseNumber(row?.[1], 999999),
    }))
    .filter((row) => Boolean(row.driverId));
  if (candidateRows.length === 0) return [];

  const locationPipeline = redis.multi();
  for (const row of candidateRows) {
    locationPipeline.get(driverLocationKey(row.driverId));
  }
  const locationReplies = await locationPipeline.exec();
  if (!locationReplies) return [];

  const loaded = candidateRows
    .map((row, index) => {
      const reply = locationReplies[index];
      const payloadRaw = reply?.[1];
      if (typeof payloadRaw !== 'string' || !payloadRaw) return null;

      let payload: DriverLocationRecord | null = null;
      try {
        payload = JSON.parse(payloadRaw) as DriverLocationRecord;
      } catch {
        payload = null;
      }
      if (!payload) return null;

      const updatedAtMs = new Date(payload.updated_at || '').getTime();
      if (!Number.isFinite(updatedAtMs)) return null;

      const locationAgeSeconds = Math.max(0, Math.round((Date.now() - updatedAtMs) / 1000));
      if (locationAgeSeconds > freshnessSec) return null;

      return {
        driverId: row.driverId,
        distanceM: Math.max(0, Math.round(row.distanceM)),
        payload,
        locationAgeSeconds,
      };
    })
    .filter(
      (
        item,
      ): item is {
        driverId: string;
        distanceM: number;
        payload: DriverLocationRecord;
        locationAgeSeconds: number;
      } => Boolean(item),
    );
  if (loaded.length === 0) return [];

  const orderCountPipeline = redis.multi();
  for (const row of loaded) {
    orderCountPipeline.scard(driverOrdersKey(row.driverId));
  }
  const orderCountReplies = await orderCountPipeline.exec();
  if (!orderCountReplies) return [];

  const candidates: NearbyDriverCandidate[] = [];
  for (let i = 0; i < loaded.length; i += 1) {
    const row = loaded[i];
    const activeOrderCount = parseNumber(orderCountReplies[i]?.[1], 0);
    if (activeOrderCount > 0) continue;

    const etaMinutes = estimateEtaMinutes(row.distanceM, row.payload.speed_kmh);
    const matchScore = buildMatchScore({
      distanceM: row.distanceM,
      etaMinutes,
      locationAgeSeconds: row.locationAgeSeconds,
      speedKmh: row.payload.speed_kmh,
    });

    candidates.push({
      ...row.payload,
      distance_m: row.distanceM,
      eta_minutes: etaMinutes,
      location_age_s: row.locationAgeSeconds,
      match_score: matchScore,
    });
  }

  return candidates.sort((a, b) => {
    if (a.match_score !== b.match_score) return a.match_score - b.match_score;
    if (a.eta_minutes !== b.eta_minutes) return a.eta_minutes - b.eta_minutes;
    return a.distance_m - b.distance_m;
  });
}

export function buildRadiusPlan(initialRadiusM?: number, maxRadiusM?: number): number[] {
  const defaults = [100, 300, 600, 1000, 2000, 3500];
  const initial = Math.max(50, Math.min(5000, initialRadiusM || 300));
  const maxRadius = Math.max(initial, Math.min(10000, maxRadiusM || 3500));

  const plan = new Set<number>();
  plan.add(initial);
  for (const radius of defaults) {
    if (radius >= initial && radius <= maxRadius) plan.add(radius);
  }
  if (maxRadius > initial) plan.add(maxRadius);
  return Array.from(plan).sort((a, b) => a - b);
}

export async function createOrUpdateDispatchOrder(input: {
  orderId: string;
  requesterId: string;
  service: SuperAppService;
  pickup: { lat: number; lng: number };
  radiusM: number;
  status?: DispatchOrderState['status'];
  statusReason?: DispatchOrderState['status_reason'];
  reachedMaxRadiusWithoutCandidate?: boolean;
  resetNotifiedDrivers?: boolean;
  appendNotifiedDriverIds?: string[];
}): Promise<DispatchOrderState> {
  const redis = getRedis();
  const existingRaw = await redis.get(dispatchOrderKey(input.orderId));

  let existing: DispatchOrderState | null = null;
  if (existingRaw) {
    try {
      existing = JSON.parse(existingRaw) as DispatchOrderState;
    } catch {
      existing = null;
    }
  }

  const mergedSource = input.resetNotifiedDrivers
    ? [...(input.appendNotifiedDriverIds || [])]
    : [
        ...(existing?.notified_driver_ids || []),
        ...(input.appendNotifiedDriverIds || []),
      ];
  const notifiedMerged = Array.from(new Set(mergedSource)).slice(0, 500);
  const now = new Date().toISOString();
  const nextStatus = input.status || existing?.status || 'searching';
  const nextSearchAttempts = Math.max(0, (existing?.search_attempts || 0) + 1);
  const nextMaxRadiusEmptyRounds = input.reachedMaxRadiusWithoutCandidate
    ? Math.max(0, (existing?.max_radius_empty_rounds || 0) + 1)
    : 0;
  const nextStatusReason =
    nextStatus === 'expired'
      ? input.statusReason || existing?.status_reason || 'manual'
      : undefined;

  const next: DispatchOrderState = existing
    ? {
        ...existing,
        status: nextStatus,
        status_reason: nextStatusReason,
        last_search_at: now,
        search_attempts: nextSearchAttempts,
        max_radius_empty_rounds: nextMaxRadiusEmptyRounds,
        last_radius_m: input.radiusM,
        notified_driver_ids: notifiedMerged,
      }
    : {
        order_id: input.orderId,
        requester_id: input.requesterId,
        service: input.service,
        pickup: input.pickup,
        status: nextStatus,
        status_reason: nextStatusReason,
        created_at: now,
        last_search_at: now,
        search_attempts: 1,
        max_radius_empty_rounds: input.reachedMaxRadiusWithoutCandidate ? 1 : 0,
        last_radius_m: input.radiusM,
        notified_driver_ids: notifiedMerged,
      };

  await redis.setex(dispatchOrderKey(input.orderId), 3600, JSON.stringify(next));
  return next;
}

export async function pushDispatchNotifications(input: {
  orderId: string;
  service: SuperAppService;
  requesterId: string;
  radiusM: number;
  pickup: { lat: number; lng: number };
  candidates: NearbyDriverCandidate[];
}): Promise<number> {
  const redis = getRedis();
  let sent = 0;
  for (const candidate of input.candidates) {
    const message = {
      id: crypto.randomUUID(),
      type: 'super_app_dispatch',
      order_id: input.orderId,
      service: input.service,
      requester_id: input.requesterId,
      radius_m: input.radiusM,
      distance_m: candidate.distance_m,
      pickup: input.pickup,
      created_at: new Date().toISOString(),
    };
    const key = driverInboxKey(candidate.driver_id);
    await redis.lpush(key, JSON.stringify(message));
    await redis.ltrim(key, 0, 99);
    await redis.expire(key, 3600);
    sent += 1;
  }
  return sent;
}

export async function getDriverDispatchInbox(input: {
  driverId: string;
  limit: number;
}): Promise<Array<Record<string, unknown>>> {
  const redis = getRedis();
  const rawItems = await redis.lrange(driverInboxKey(input.driverId), 0, Math.max(0, input.limit - 1));
  const parsed: Array<Record<string, unknown>> = [];
  for (const raw of rawItems || []) {
    try {
      const payload = JSON.parse(raw) as Record<string, unknown>;
      parsed.push(payload);
    } catch {
      // ignore broken payload
    }
  }
  return parsed;
}

export async function resolveDispatchWinner(input: {
  orderId: string;
  driverId: string;
}): Promise<{ ok: boolean; winnerDriverId?: string }> {
  const redis = getRedis();
  const set = await redis.set(
    dispatchWinnerKey(input.orderId),
    input.driverId,
    'EX',
    3600,
    'NX',
  );
  if (set === 'OK') {
    const raw = await redis.get(dispatchOrderKey(input.orderId));
    if (raw) {
      try {
        const state = JSON.parse(raw) as DispatchOrderState;
        state.status = 'matched';
        state.status_reason = undefined;
        state.matched_driver_id = input.driverId;
        state.matched_at = new Date().toISOString();
        await redis.setex(dispatchOrderKey(input.orderId), 3600, JSON.stringify(state));
      } catch {
        // ignore parse fail
      }
    }
    await bindDriverToOrder({
      driverId: input.driverId,
      orderId: input.orderId,
    });
    return { ok: true, winnerDriverId: input.driverId };
  }

  const winnerDriverId = await redis.get(dispatchWinnerKey(input.orderId));
  return { ok: false, winnerDriverId: winnerDriverId || undefined };
}

export async function getDispatchOrder(orderId: string): Promise<DispatchOrderState | null> {
  const redis = getRedis();
  const raw = await redis.get(dispatchOrderKey(orderId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DispatchOrderState;
  } catch {
    return null;
  }
}
