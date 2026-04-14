'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import {
  ArrowLeft,
  Loader2,
  MapPinned,
  MessageCircle,
  Navigation,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { buildOsmDirectionsUrl } from '@/lib/super-app/maps';
import {
  DriverIdentityCard,
  MobilityTimeline,
  StatusChip,
} from '@/components/super-app/MobilityPrimitives';
import { OpenSourceTripMap } from '@/components/super-app/OpenSourceTripMap';

type TrackerClientProps = {
  locale: string;
  orderId: string;
};

type LatLng = { lat: number; lng: number };

type OrderResponse = {
  data?: {
    order_id: string;
    service: string;
    payload?: Record<string, unknown>;
  };
  error?: string;
};

type TrackingResponse = {
  data?: {
    phase?: 'to_pickup' | 'to_dropoff' | 'arrived';
    eta_minutes: number;
    distance_km: number;
    pickup: LatLng;
    partner: LatLng;
    partner_live?: LatLng;
    customer: LatLng;
    customer_live?: LatLng;
    pickup_label?: string;
    dropoff_label?: string;
    dispatch_status?: 'searching' | 'matched' | 'expired';
    matched_driver_id?: string | null;
  };
  error?: string;
};

type DispatchResponse = {
  data?: {
    status: 'searching' | 'matched' | 'expired';
    status_reason?: 'no_driver_available' | 'search_timeout' | 'manual' | null;
    matched_driver_id?: string;
    matched_at?: string;
    last_radius_m: number;
    notified_driver_ids: string[];
    search_attempts?: number;
  };
  error?: string;
};

type NearbyDriversResponse = {
  data?: Array<{
    driver_id: string;
    distance_m: number;
  }>;
};

function randomRating(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 33 + seed.charCodeAt(i)) >>> 0;
  }
  const rating = 4 + (hash % 9) / 10;
  return rating.toFixed(1);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
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

export default function TrackerClient({ locale, orderId }: TrackerClientProps) {
  const isId = locale === 'id';
  const driverSearchingLabel = isId ? 'Mencari driver' : 'Driver searching';
  const driverUnavailableLabel = isId ? 'Driver belum tersedia' : 'Driver unavailable';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderResponse['data'] | null>(null);
  const [tracking, setTracking] = useState<TrackingResponse['data'] | null>(null);
  const [dispatch, setDispatch] = useState<DispatchResponse['data'] | null>(null);
  const [nearbyDrivers, setNearbyDrivers] = useState<Array<{ driver_id: string; distance_m: number }>>([]);
  const [viewerLocation, setViewerLocation] = useState<LatLng | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  useEffect(() => {
    if (!window.isSecureContext || !navigator.geolocation) return;

    let watchId: number | null = null;
    let disposed = false;

    const startWatch = async () => {
      const permissionsApi = (navigator as Navigator & {
        permissions?: {
          query: (descriptor: { name: PermissionName }) => Promise<PermissionStatus>;
        };
      }).permissions;

      // Avoid triggering a permission prompt; only use location when already granted.
      if (!permissionsApi?.query) return;

      try {
        const status = await permissionsApi.query({ name: 'geolocation' });
        if (status.state !== 'granted' || disposed) return;
      } catch {
        return;
      }

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          setViewerLocation({
            lat: Number(position.coords.latitude.toFixed(6)),
            lng: Number(position.coords.longitude.toFixed(6)),
          });
        },
        () => {
          // keep tracker working even if live location fails
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 10000,
        },
      );
    };

    void startWatch();

    return () => {
      disposed = true;
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  const loadSnapshot = useCallback(async () => {
    try {
      const trackingQuery = new URLSearchParams({ id: orderId });
      if (viewerLocation && isFiniteNumber(viewerLocation.lat) && isFiniteNumber(viewerLocation.lng)) {
        trackingQuery.set('viewer_lat', String(viewerLocation.lat));
        trackingQuery.set('viewer_lng', String(viewerLocation.lng));
      }

      const [orderRes, trackingRes, dispatchRes] = await Promise.all([
        fetch(`/api/super-app/orders?id=${encodeURIComponent(orderId)}`, {
          cache: 'no-store',
          credentials: 'include',
        }),
        fetch(`/api/super-app/tracking?${trackingQuery.toString()}`, {
          cache: 'no-store',
          credentials: 'include',
        }),
        fetch(`/api/super-app/dispatch/status?order_id=${encodeURIComponent(orderId)}`, {
          cache: 'no-store',
          credentials: 'include',
        }),
      ]);

      const orderData = (await orderRes.json().catch(() => ({}))) as OrderResponse;
      const trackingData = (await trackingRes.json().catch(() => ({}))) as TrackingResponse;
      const dispatchData = (await dispatchRes.json().catch(() => ({}))) as DispatchResponse;

      if (!orderRes.ok || !orderData.data) {
        throw new Error(orderData.error || 'Order not found');
      }
      if (!trackingRes.ok || !trackingData.data) {
        throw new Error(trackingData.error || 'Tracking not found');
      }

      setOrder(orderData.data);
      setTracking(trackingData.data);
      setDispatch(dispatchRes.ok && dispatchData.data ? dispatchData.data : null);
      setLastSyncAt(new Date().toISOString());

      if (
        orderData.data.service &&
        trackingData.data.pickup &&
        (!dispatchData.data || dispatchData.data.status === 'searching')
      ) {
        const radius = dispatchData.data?.last_radius_m || 1000;
        const nearbyRes = await fetch(
          `/api/super-app/drivers/nearby?service=${encodeURIComponent(orderData.data.service)}&lat=${trackingData.data.pickup.lat}&lng=${trackingData.data.pickup.lng}&radius_m=${radius}&limit=8`,
          { cache: 'no-store', credentials: 'include' },
        );
        const nearbyData = (await nearbyRes.json().catch(() => ({}))) as NearbyDriversResponse;
        setNearbyDrivers(Array.isArray(nearbyData.data) ? nearbyData.data : []);
      } else {
        setNearbyDrivers([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tracker');
    } finally {
      setLoading(false);
    }
  }, [orderId, viewerLocation]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadSnapshot();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [loadSnapshot]);

  useEffect(() => {
    const streamUrl = `/api/super-app/stream/order?order_id=${encodeURIComponent(orderId)}`;
    const eventSource = new EventSource(streamUrl, { withCredentials: true });

    eventSource.addEventListener('update', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data || '{}') as Record<string, unknown>;
        if (payload.type === 'driver_location') {
          const lat = Number(payload.lat);
          const lng = Number(payload.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

          setTracking((previous) => {
            if (!previous) return previous;
            const nextPartner = { lat, lng };
            const distanceKm = Number(haversineKm(nextPartner, previous.customer).toFixed(2));
            return {
              ...previous,
              partner_live: nextPartner,
              distance_km: Math.max(0, distanceKm),
            };
          });
          setLastSyncAt(new Date().toISOString());
          return;
        }

        if (payload.type === 'driver_matched') {
          const matchedDriverId =
            typeof payload.matched_driver_id === 'string' ? payload.matched_driver_id : undefined;
          setDispatch((previous) =>
            previous
              ? { ...previous, status: 'matched', matched_driver_id: matchedDriverId || previous.matched_driver_id }
              : {
                  status: 'matched',
                  matched_driver_id: matchedDriverId,
                  last_radius_m: 0,
                  notified_driver_ids: [],
                },
          );
          return;
        }

        if (payload.type === 'dispatch_expired') {
          const reason =
            payload.status_reason === 'search_timeout' || payload.status_reason === 'no_driver_available'
              ? payload.status_reason
              : null;
          setDispatch((previous) =>
            previous
              ? { ...previous, status: 'expired', status_reason: reason }
              : {
                  status: 'expired',
                  status_reason: reason,
                  last_radius_m: Number.isFinite(Number(payload.radius_used_m))
                    ? Number(payload.radius_used_m)
                    : 0,
                  notified_driver_ids: [],
                },
          );
        }
      } catch {
        // ignore malformed events
      }
    });

    eventSource.addEventListener('error', () => {
      // fallback polling is still active
    });

    return () => {
      eventSource.close();
    };
  }, [orderId]);

  const pickupLabel = useMemo(
    () =>
      asString(tracking?.pickup_label) ||
      asString(order?.payload?.pickup_address) ||
      (isId ? 'Titik jemput' : 'Pickup point'),
    [isId, order?.payload, tracking?.pickup_label],
  );
  const dropoffLabel = useMemo(
    () =>
      asString(tracking?.dropoff_label) ||
      asString(order?.payload?.dropoff_address) ||
      (isId ? 'Titik tujuan' : 'Dropoff point'),
    [isId, order?.payload, tracking?.dropoff_label],
  );

  const liveMarkers = useMemo(() => {
    if (!tracking) return [];
    const markers: Array<{
      id: string;
      point: LatLng;
      label: string;
      kind: 'driver' | 'customer';
      color: string;
      radius: number;
      pulse: boolean;
      animationMs: number;
    }> = [];

    const driverPoint = tracking.partner_live || tracking.partner;
    if (driverPoint) {
      markers.push({
        id: 'driver-live',
        point: driverPoint,
        label: isId ? 'Driver (LIVE)' : 'Driver (LIVE)',
        kind: 'driver',
        color: 'var(--app-success)',
        radius: 10,
        pulse: true,
        animationMs: 950,
      });
    }

    const customerPoint = tracking.customer_live || viewerLocation || null;
    if (customerPoint) {
      markers.push({
        id: 'customer-live',
        point: customerPoint,
        label: isId ? 'Anda (LIVE)' : 'You (LIVE)',
        kind: 'customer',
        color: 'var(--app-info)',
        radius: 9,
        pulse: true,
        animationMs: 950,
      });
    }

    return markers;
  }, [isId, tracking, viewerLocation]);

  const driverId =
    dispatch?.matched_driver_id ||
    (dispatch?.status === 'expired' ? driverUnavailableLabel : nearbyDrivers[0]?.driver_id) ||
    driverSearchingLabel;
  const driverDisplay =
    driverId === driverSearchingLabel || driverId === driverUnavailableLabel
      ? driverId
      : `${driverId.slice(0, 8)}...`;
  const driverRating = randomRating(driverId);
  const timelineItems = useMemo(
    () => {
      const phase = tracking?.phase;

      return [
        {
          id: 'booked',
          label: isId ? 'Booking diterima' : 'Booking received',
          meta: isId ? 'Order sudah masuk ke dispatch dan siap dilanjutkan.' : 'The order is in dispatch and ready to move forward.',
          state: 'complete' as const,
        },
        {
          id: 'searching',
          label: isId ? 'Driver dicari' : 'Driver search',
          meta: isId ? 'Sistem menilai driver sekitar berdasarkan pickup aktif.' : 'The system evaluates nearby drivers around the active pickup.',
          state:
            dispatch?.status === 'matched' || dispatch?.status === 'expired'
              ? ('complete' as const)
              : ('current' as const),
        },
        {
          id: 'pickup',
          label: isId ? 'Menuju pickup' : 'Heading to pickup',
          meta: isId ? 'ETA dan posisi driver terus diperbarui.' : 'ETA and driver position keep updating.',
          state:
            dispatch?.status === 'matched'
              ? phase === 'to_dropoff' || phase === 'arrived'
                ? ('complete' as const)
                : ('current' as const)
              : ('upcoming' as const),
        },
        {
          id: 'dropoff',
          label: isId ? 'Perjalanan berjalan' : 'Trip in progress',
          meta: isId ? 'Ringkasan pickup dan dropoff tetap terlihat.' : 'Pickup and dropoff summary stay visible.',
          state:
            phase === 'to_dropoff'
              ? ('current' as const)
              : phase === 'arrived'
                ? ('complete' as const)
                : ('upcoming' as const),
        },
      ];
    },
    [dispatch?.status, isId, tracking?.phase],
  );

  if (loading) {
    return (
      <main className="mx-auto max-w-lg px-4 py-8">
        <div className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 py-3 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          {isId ? 'Memuat live tracker...' : 'Loading live tracker...'}
        </div>
      </main>
    );
  }

  if (error || !order || !tracking) {
    return (
      <main className="mx-auto max-w-lg px-4 py-8">
        <div className="rounded-2xl border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] p-4 text-sm text-[color:var(--app-danger)]">
          {error || (isId ? 'Tracker tidak tersedia.' : 'Tracker unavailable.')}
        </div>
        <Link
          href="/super-app"
          className="mt-3 inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[color:var(--app-accent)] px-4 text-sm font-bold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)]"
        >
          {isId ? 'Kembali ke Super App' : 'Back to Super App'}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1120px] px-3 py-4 sm:px-4">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
        <div className="overflow-hidden rounded-[32px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-xl dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
          <div className="relative h-[68svh] min-h-[560px] bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)]">
          <OpenSourceTripMap
            origin={tracking.partner_live || tracking.partner}
            destination={tracking.customer}
            via={tracking.pickup}
            liveMarkers={liveMarkers}
            originLabel={isId ? 'Driver' : 'Driver'}
            viaLabel={isId ? 'Pickup' : 'Pickup'}
            destinationLabel={isId ? 'Tujuan' : 'Destination'}
            className="h-full w-full"
            refreshIntervalMs={8000}
          />

          <div className="pointer-events-none absolute inset-x-3 top-3 rounded-[24px] border border-[color:color-mix(in_srgb,_var(--app-text-inverse)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_95%,_transparent)] p-3 shadow-lg dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_70%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_95%,_transparent)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">- {pickupLabel}</p>
                <p className="font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">- {dropoffLabel}</p>
              </div>
              <div className="pointer-events-auto flex items-center gap-2">
                <StatusChip
                  label={
                    dispatch?.status === 'matched'
                      ? isId
                        ? 'Driver matched'
                        : 'Driver matched'
                      : dispatch?.status === 'expired'
                        ? isId
                          ? 'Driver sibuk'
                          : 'Drivers busy'
                        : isId
                          ? 'Mencari driver'
                          : 'Searching driver'
                  }
                  tone={
                    dispatch?.status === 'matched'
                      ? 'success'
                      : dispatch?.status === 'expired'
                        ? 'warning'
                        : 'accent'
                  }
                  pulse={dispatch?.status !== 'expired'}
                />
                <a
                  href={buildOsmDirectionsUrl(
                    tracking.partner_live || tracking.partner,
                    tracking.customer,
                    tracking.pickup,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="ui-button-secondary pointer-events-auto inline-flex min-h-[34px] items-center gap-2 rounded-full px-3 text-[11px] font-semibold"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  OSM
                </a>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
              {viewerLocation
                ? `${isId ? 'Lokasi Anda aktif' : 'Your location is active'}`
                : isId
                  ? 'Lokasi Anda belum aktif'
                  : 'Your location is not active yet'}
            </p>
            <p className="text-[11px] font-semibold text-[color:var(--app-accent)] dark:text-[color:var(--app-accent)]">
              LIVE {lastSyncAt ? `- ${new Date(lastSyncAt).toLocaleTimeString()}` : ''}
            </p>
          </div>

          <Link
            href={`/super-app/${order.service}`}
            className="absolute left-3 top-24 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_95%,_transparent)] text-[color:var(--app-text)] shadow-md dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_95%,_transparent)] dark:text-[color:var(--app-text-soft)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="absolute inset-x-0 bottom-0 bg-[color:var(--app-accent)] px-4 py-3 text-[color:var(--app-text-inverse)]">
            <p className="text-sm font-bold">
              {dispatch?.status === 'matched'
                ? tracking.phase === 'to_dropoff'
                  ? isId
                    ? `Menuju tujuan, ETA ${tracking.eta_minutes} min`
                    : `Heading to destination, ETA ${tracking.eta_minutes} min`
                  : tracking.phase === 'arrived'
                    ? isId
                      ? 'Driver sudah sampai'
                      : 'Driver has arrived'
                    : isId
                      ? `Driver akan sampai dalam ${tracking.eta_minutes} min`
                      : `Driver arriving in ${tracking.eta_minutes} min`
                : dispatch?.status === 'expired'
                  ? isId
                    ? 'Driver sedang sibuk. Coba lagi atau geser titik jemput.'
                    : 'Drivers are busy right now. Retry or move pickup point.'
                : isId
                  ? 'Sedang mencari driver terdekat...'
                  : 'Searching nearest drivers...'}
            </p>
          </div>
        </div>
        </div>

        <aside className="space-y-4">
          <div className="ui-sheet p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                  {isId ? 'Driver & status' : 'Driver and status'}
                </p>
                <p className="mt-1 text-lg font-semibold text-[color:var(--app-text)]">
                  {dispatch?.status === 'matched'
                    ? isId
                      ? 'Driver ditemukan'
                      : 'Driver matched'
                    : dispatch?.status === 'expired'
                      ? isId
                        ? 'Driver sedang sibuk'
                        : 'Drivers are busy'
                      : isId
                        ? 'Mencari driver'
                        : 'Searching driver'}
                </p>
              </div>
              <StatusChip
                label={dispatch?.status || 'searching'}
                tone={
                  dispatch?.status === 'matched'
                    ? 'success'
                    : dispatch?.status === 'expired'
                      ? 'warning'
                      : 'accent'
                }
                pulse={dispatch?.status !== 'expired'}
              />
            </div>

            <div className="mt-4">
              <DriverIdentityCard
                name={driverDisplay}
                subtitle={
                  dispatch?.status === 'matched'
                    ? isId
                      ? 'Driver terverifikasi siap menuju pickup.'
                      : 'A verified driver is on the way to pickup.'
                    : isId
                      ? 'Lajukan masih menyeleksi driver terdekat.'
                      : 'Lajukan is still evaluating the nearest drivers.'
                }
                ratingLabel={driverRating}
                etaLabel={`ETA ${tracking.eta_minutes} ${isId ? 'mnt' : 'min'}`}
                vehicleLabel={isId ? 'Call, chat, dan ringkasan order tetap dekat.' : 'Call, chat, and the order summary stay close.'}
                tone={dispatch?.status === 'matched' ? 'accent' : dispatch?.status === 'expired' ? 'warning' : 'info'}
                actions={
                  <div className="grid grid-cols-3 gap-2">
                    <button className="ui-button-secondary inline-flex items-center justify-center gap-2 rounded-[18px] px-3 text-sm font-semibold">
                      <Phone className="h-4 w-4" />
                      {isId ? 'Telepon' : 'Call'}
                    </button>
                    <button className="ui-button-secondary inline-flex items-center justify-center gap-2 rounded-[18px] px-3 text-sm font-semibold">
                      <MessageCircle className="h-4 w-4" />
                      Chat
                    </button>
                    <button className="ui-button-primary inline-flex items-center justify-center gap-2 rounded-[18px] px-3 text-sm font-semibold">
                      <ShieldCheck className="h-4 w-4" />
                      SOS
                    </button>
                  </div>
                }
              />
            </div>
          </div>

          <div className="ui-sheet p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
              {isId ? 'Status timeline' : 'Status timeline'}
            </p>
            <div className="mt-4">
              <MobilityTimeline items={timelineItems} />
            </div>
          </div>

          {dispatch?.status !== 'matched' ? (
            <div className="ui-sheet p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                {isId ? 'Driver terdekat' : 'Nearest drivers'}
              </p>
              {nearbyDrivers.length === 0 ? (
                <p className="mt-3 text-sm text-[color:var(--app-text-soft)]">
                  {dispatch?.status === 'expired'
                    ? isId
                      ? 'Belum ada driver aktif yang siap dalam radius aman.'
                      : 'No active available drivers in the safe pickup radius.'
                    : isId
                      ? 'Belum ada driver dalam radius aktif.'
                      : 'No drivers in the active radius yet.'}
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {nearbyDrivers.slice(0, 5).map((item) => (
                    <div
                      key={item.driver_id}
                      className="flex items-center justify-between gap-3 rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-3"
                    >
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--app-text)]">
                        <UserRound className="h-4 w-4 text-[color:var(--app-accent)]" />
                        {item.driver_id.slice(0, 8)}...
                      </span>
                      <span className="ui-inline-meta">{item.distance_m}m</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-[color:var(--app-info-border)] bg-[color:var(--app-info-soft)] px-3 py-1 text-[11px] font-semibold text-[color:var(--app-info)]">
                <MapPinned className="h-3.5 w-3.5" />
                Radius: {dispatch?.last_radius_m || 1000}m
              </p>
            </div>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
