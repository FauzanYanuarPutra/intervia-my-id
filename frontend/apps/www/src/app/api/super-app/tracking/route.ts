import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { getRedis } from '@/lib/redis';
import { getDispatchOrder, getDriverLocation } from '@/lib/super-app/dispatch';

type LatLng = { lat: number; lng: number };

type StoredOrderRecord = {
  user_id: string;
  service: string;
  created_at?: string;
  payload?: Record<string, unknown>;
};

function hashToOffset(seed: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return (hash % mod) / 10000;
}

function buildFallbackRoute(orderId: string): { pickup: LatLng; partner: LatLng; dropoff: LatLng } {
  const baseLat = -6.2088;
  const baseLng = 106.8456;
  const latOffset = hashToOffset(orderId, 90);
  const lngOffset = hashToOffset(`${orderId}:lng`, 90);

  const pickup = { lat: baseLat + latOffset, lng: baseLng + lngOffset };
  const partner = { lat: pickup.lat - 0.0092, lng: pickup.lng - 0.0065 };
  const dropoff = { lat: pickup.lat + 0.0048, lng: pickup.lng + 0.0031 };
  return { pickup, partner, dropoff };
}

function toNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readPoint(payload: Record<string, unknown>, latKey: string, lngKey: string): LatLng | null {
  const lat = toNumber(payload[latKey]);
  const lng = toNumber(payload[lngKey]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat: lat!, lng: lng! };
}

function parseViewerPoint(url: URL): LatLng | null {
  const lat = toNumber(url.searchParams.get('viewer_lat'));
  const lng = toNumber(url.searchParams.get('viewer_lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat: lat!, lng: lng! };
}

function interpolate(a: LatLng, b: LatLng, t: number): LatLng {
  const ratio = Math.max(0, Math.min(1, t));
  return {
    lat: a.lat + (b.lat - a.lat) * ratio,
    lng: a.lng + (b.lng - a.lng) * ratio,
  };
}

function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  return r * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

function estimateEtaMinutes(distanceKm: number, speedKmh: number): number {
  if (distanceKm <= 0.03) return 0;
  const minutes = (distanceKm / Math.max(8, speedKmh)) * 60;
  return Math.max(1, Math.ceil(minutes));
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const url = new URL(req.url);
    const orderId = (url.searchParams.get('id') || '').trim();
    if (!orderId) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const redis = getRedis();
    const raw = await redis.get(`superapp:order:${orderId}`);
    if (!raw) {
      return NextResponse.json({ error: 'Order intent not found' }, { status: 404 });
    }

    const parsed = JSON.parse(raw) as StoredOrderRecord;
    const dispatchState = await getDispatchOrder(orderId);
    const canViewAsMatchedDriver = dispatchState?.matched_driver_id === auth.ctx.userId;
    if (
      parsed.user_id !== auth.ctx.userId &&
      !auth.ctx.roles.includes('admin') &&
      !canViewAsMatchedDriver
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payload = parsed.payload || {};
    const fallback = buildFallbackRoute(orderId);
    const pickup = readPoint(payload, 'pickup_lat', 'pickup_lng') || fallback.pickup;
    const dropoff = readPoint(payload, 'dropoff_lat', 'dropoff_lng') || fallback.dropoff;
    const customerLive =
      parseViewerPoint(url) ||
      readPoint(payload, 'customer_lat', 'customer_lng') ||
      readPoint(payload, 'pickup_lat', 'pickup_lng') ||
      pickup;

    const matchedDriverId = dispatchState?.matched_driver_id;
    const matchedDriverLocation = matchedDriverId ? await getDriverLocation(matchedDriverId) : null;

    const createdAt = parsed.created_at ? new Date(parsed.created_at).getTime() : Date.now();
    const elapsedMinutes = Math.max(0, (Date.now() - createdAt) / 60000);

    let phase: 'to_pickup' | 'to_dropoff' | 'arrived' = 'to_pickup';
    let partnerLive: LatLng = fallback.partner;
    let etaMinutes = 6;
    let distanceKm = haversineKm(partnerLive, pickup);

    if (matchedDriverLocation) {
      partnerLive = { lat: matchedDriverLocation.lat, lng: matchedDriverLocation.lng };
      const toPickupKm = haversineKm(partnerLive, pickup);
      const toDropoffKm = haversineKm(partnerLive, dropoff);

      if (toDropoffKm <= 0.08) {
        phase = 'arrived';
        etaMinutes = 0;
        distanceKm = 0;
      } else if (toPickupKm <= 0.1) {
        phase = 'to_dropoff';
        etaMinutes = estimateEtaMinutes(toDropoffKm, matchedDriverLocation.speed_kmh || 30);
        distanceKm = toDropoffKm;
      } else {
        phase = 'to_pickup';
        etaMinutes = estimateEtaMinutes(toPickupKm, matchedDriverLocation.speed_kmh || 28);
        distanceKm = toPickupKm;
      }
    } else if (elapsedMinutes < 6) {
      phase = 'to_pickup';
      partnerLive = interpolate(fallback.partner, pickup, elapsedMinutes / 6);
      distanceKm = haversineKm(partnerLive, pickup);
      etaMinutes = Math.max(1, Math.ceil(6 - elapsedMinutes));
    } else if (elapsedMinutes < 14) {
      phase = 'to_dropoff';
      const progress = (elapsedMinutes - 6) / 8;
      partnerLive = interpolate(pickup, dropoff, progress);
      distanceKm = haversineKm(partnerLive, dropoff);
      etaMinutes = Math.max(1, Math.ceil(14 - elapsedMinutes));
    } else {
      phase = 'arrived';
      partnerLive = dropoff;
      distanceKm = 0;
      etaMinutes = 0;
    }

    return NextResponse.json(
      {
        data: {
          order_id: orderId,
          service: parsed.service,
          phase,
          eta_minutes: etaMinutes,
          distance_km: Math.max(0, Number(distanceKm.toFixed(2))),
          pickup,
          partner: matchedDriverLocation
            ? { lat: matchedDriverLocation.lat, lng: matchedDriverLocation.lng }
            : fallback.partner,
          partner_live: partnerLive,
          customer: dropoff,
          customer_live: customerLive,
          pickup_label: typeof payload.pickup_address === 'string' ? payload.pickup_address : '',
          dropoff_label: typeof payload.dropoff_address === 'string' ? payload.dropoff_address : '',
          dispatch_status: dispatchState?.status || 'searching',
          matched_driver_id: matchedDriverId || null,
          path: [
            partnerLive,
            { lat: (partnerLive.lat + pickup.lat) / 2, lng: (partnerLive.lng + pickup.lng) / 2 },
            pickup,
            { lat: (pickup.lat + dropoff.lat) / 2, lng: (pickup.lng + dropoff.lng) / 2 },
            dropoff,
          ],
          events: [
            { key: 'order_created', at: parsed.created_at || new Date().toISOString() },
            dispatchState?.matched_at
              ? { key: 'partner_assigned', at: dispatchState.matched_at }
              : { key: 'partner_searching', at: new Date().toISOString() },
            { key: 'partner_moving', at: new Date().toISOString() },
          ],
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[SUPER_APP_TRACKING_ERROR]', error);
    return NextResponse.json({ error: 'Failed to load tracking data' }, { status: 500 });
  }
}
