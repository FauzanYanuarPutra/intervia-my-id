'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { Bike, Loader2, MapPinned, Navigation, ShieldCheck, UserCheck } from 'lucide-react';
import { createIdempotencyKey } from '@/lib/clientIdempotency';
import { buildOsmDirectionsUrl } from '@/lib/super-app/maps';
import { LocationPermissionGate } from '@/components/super-app/LocationPermissionGate';
import { OpenSourceTripMap } from '@/components/super-app/OpenSourceTripMap';
import { DriverConsoleSkeleton } from '@/components/system/feedback/RouteSkeletons';

type DriverPresenceService = 'ride' | 'car' | 'food' | 'send' | 'mart' | 'services';
type LatLng = { lat: number; lng: number };

type DriverInboxItem = {
  id: string;
  order_id: string;
  service: string;
  distance_m: number;
  radius_m: number;
  created_at: string;
  pickup?: LatLng | null;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizePickup(value: unknown): LatLng | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (!isFiniteNumber(raw.lat) || !isFiniteNumber(raw.lng)) return null;
  return { lat: raw.lat, lng: raw.lng };
}

export default function SuperAppDriverConsolePage() {
  const locale = useLocale();
  const isId = locale === 'id';
  const { user, loading: authLoading } = useAuth();
  const [service, setService] = useState<DriverPresenceService>('ride');
  const [online, setOnline] = useState(false);
  const [loadingPresence, setLoadingPresence] = useState(false);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [inbox, setInbox] = useState<DriverInboxItem[]>([]);
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);

  const locationWatcherRef = useRef<number | null>(null);
  const lastPresenceAtRef = useRef<number>(0);
  const postingPresenceRef = useRef(false);
  const onlineRef = useRef(false);

  useEffect(() => {
    onlineRef.current = online;
  }, [online]);

  const postPresence = useCallback(
    async (
      payload: { online: boolean; location?: LatLng },
      options?: { silent?: boolean; force?: boolean },
    ) => {
      if (postingPresenceRef.current && payload.online) return false;
      const now = Date.now();
      if (payload.online && !options?.force && now - lastPresenceAtRef.current < 2500) {
        return true;
      }

      if (!payload.online) {
        setLoadingPresence(true);
      }
      if (!options?.silent) {
        setError(null);
      }

      postingPresenceRef.current = true;
      try {
        const res = await fetch('/api/super-app/drivers/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            service,
            online: payload.online,
            lat: payload.location?.lat,
            lng: payload.location?.lng,
            order_id: payload.online ? activeOrderId || undefined : undefined,
            vehicle_type: service === 'ride' ? 'motorbike' : service === 'car' ? 'car' : 'general',
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error || 'Failed to update presence');

        if (payload.online) {
          lastPresenceAtRef.current = Date.now();
          if (!onlineRef.current) setOnline(true);
        } else {
          setOnline(false);
        }
        return true;
      } catch (err) {
        if (!options?.silent) {
          setError(err instanceof Error ? err.message : 'Presence update failed');
        }
        return false;
      } finally {
        postingPresenceRef.current = false;
        if (!payload.online) {
          setLoadingPresence(false);
        }
      }
    },
    [activeOrderId, service],
  );

  const loadInbox = useCallback(async () => {
    if (!online) return;
    setLoadingInbox(true);
    try {
      const res = await fetch('/api/super-app/drivers/dispatch/inbox?limit=20', {
        cache: 'no-store',
        credentials: 'include',
      });
      const data = (await res.json().catch(() => ({}))) as {
        data?: Array<Record<string, unknown>>;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || 'Failed to load inbox');

      const normalized: DriverInboxItem[] = (Array.isArray(data.data) ? data.data : []).map((item) => ({
        id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
        order_id: typeof item.order_id === 'string' ? item.order_id : '',
        service: typeof item.service === 'string' ? item.service : service,
        distance_m: isFiniteNumber(item.distance_m) ? Math.round(item.distance_m) : 0,
        radius_m: isFiniteNumber(item.radius_m) ? Math.round(item.radius_m) : 0,
        created_at: typeof item.created_at === 'string' ? item.created_at : new Date().toISOString(),
        pickup: normalizePickup(item.pickup),
      }));
      setInbox(normalized.filter((item) => item.order_id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inbox failed');
    } finally {
      setLoadingInbox(false);
    }
  }, [online, service]);

  const respondDispatch = async (orderId: string, accept: boolean) => {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/super-app/dispatch/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': createIdempotencyKey(
            `superapp-dispatch-${accept ? 'accept' : 'skip'}-${orderId}`,
          ),
        },
        credentials: 'include',
        body: JSON.stringify({
          order_id: orderId,
          accept,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; data?: { reason?: string } };
      if (!res.ok && accept && data?.data?.reason === 'already_taken') {
        setMessage('Order sudah diambil driver lain.');
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Dispatch response failed');
      if (accept) {
        setActiveOrderId(orderId);
      }
      setMessage(accept ? `Order ${orderId} berhasil di-accept.` : `Order ${orderId} dilewati.`);
      await loadInbox();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dispatch response failed');
    }
  };

  const updateLifecycle = useCallback(
    async (event: 'pickup_confirmed' | 'delivery_started' | 'delivery_completed') => {
      if (!activeOrderId) return;
      setLifecycleLoading(true);
      setError(null);
      setMessage(null);
      try {
        const res = await fetch('/api/super-app/orders/lifecycle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            order_id: activeOrderId,
            event,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          data?: { status?: string; lifecycle_stage?: string };
        };
        if (!res.ok) throw new Error(data.error || 'Lifecycle update failed');
        if (event === 'delivery_completed') {
          setActiveOrderId(null);
        }
        const stageLabel = data.data?.lifecycle_stage || event;
        setMessage(`Lifecycle updated: ${stageLabel}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Lifecycle update failed');
      } finally {
        setLifecycleLoading(false);
      }
    },
    [activeOrderId],
  );

  const stopLocationWatcher = useCallback(() => {
    if (locationWatcherRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(locationWatcherRef.current);
    }
    locationWatcherRef.current = null;
  }, []);

  const goOnline = useCallback(async () => {
    if (!navigator.geolocation) {
      setError('Geolocation tidak tersedia di browser ini.');
      return;
    }

    setLoadingPresence(true);
    setError(null);
    setLocationError(null);
    setMessage(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextLocation = {
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        };
        setCurrentLocation(nextLocation);
        const ok = await postPresence({ online: true, location: nextLocation }, { force: true });
        if (!ok) {
          setLoadingPresence(false);
          return;
        }
        setMessage('Status online aktif. Lokasi otomatis tersinkron.');
        setLoadingPresence(false);

        stopLocationWatcher();
        locationWatcherRef.current = navigator.geolocation.watchPosition(
          (watchPosition) => {
            const live = {
              lat: Number(watchPosition.coords.latitude.toFixed(6)),
              lng: Number(watchPosition.coords.longitude.toFixed(6)),
            };
            setCurrentLocation(live);
            if (onlineRef.current) {
              void postPresence({ online: true, location: live }, { silent: true });
            }
          },
          () => {
            setLocationError('Lokasi live tidak stabil. Pastikan GPS aktif.');
          },
          {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 7000,
          },
        );
      },
      (geoError) => {
        setLoadingPresence(false);
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setError('Izin lokasi ditolak. Driver harus mengaktifkan lokasi.');
          return;
        }
        setError('Gagal mengambil lokasi GPS. Coba lagi.');
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 5000,
      },
    );
  }, [postPresence, stopLocationWatcher]);

  const goOffline = useCallback(async () => {
    stopLocationWatcher();
    setMessage(null);
    setActiveOrderId(null);
    const ok = await postPresence({ online: false }, { force: true });
    if (ok) {
      setMessage('Status offline aktif.');
    }
  }, [postPresence, stopLocationWatcher]);

  useEffect(() => {
    if (!online || !currentLocation) return;
    const timer = window.setInterval(() => {
      void postPresence({ online: true, location: currentLocation }, { silent: true });
    }, 5000);
    return () => {
      window.clearInterval(timer);
    };
  }, [activeOrderId, currentLocation, online, postPresence]);

  useEffect(() => {
    if (!online) return;
    void loadInbox();
    const timer = window.setInterval(() => {
      void loadInbox();
    }, 3000);
    return () => {
      window.clearInterval(timer);
    };
  }, [online, loadInbox]);

  useEffect(() => {
    return () => {
      stopLocationWatcher();
    };
  }, [stopLocationWatcher]);

  const featuredPickup = useMemo(() => inbox.find((item) => item.pickup)?.pickup || null, [inbox]);

  if (authLoading) {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-5 px-0 py-6 sm:px-6 lg:px-8">
        <LocationPermissionGate isId={isId} enabled />
        <DriverConsoleSkeleton />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-3xl px-0 py-8 sm:px-4">
        <LocationPermissionGate isId={isId} enabled />
        <div className="rounded-none border border-x-0 border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] p-4 text-sm text-[color:var(--app-warning)] sm:rounded-2xl sm:border-x">
          Login diperlukan untuk mode driver.
          <div className="mt-3">
            <Link
              href="/login"
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-[color:var(--app-accent)] px-4 text-xs font-bold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)]"
            >
              Login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 px-0 py-6 sm:px-6 lg:px-8">
      <LocationPermissionGate isId={isId} enabled />
      <section className="rounded-none border border-x-0 border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] sm:rounded-3xl sm:border-x">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[color:var(--app-accent)]">
          Driver Console
        </p>
        <h1 className="mt-1 text-2xl font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
          Lajukan Driver Dispatch
        </h1>
        <p className="mt-2 text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
          Lokasi driver otomatis tersinkron ke sistem. Tidak perlu input latitude/longitude manual.
        </p>
      </section>

      <section className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
        <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[color:var(--app-text)]">
          Presence
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select
            className="rounded-xl border border-[color:var(--app-border)] px-3 py-2 text-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
            value={service}
            onChange={(event) => setService(event.target.value as DriverPresenceService)}
          >
            <option value="ride">Ride</option>
            <option value="car">Car</option>
            <option value="food">Food</option>
            <option value="send">Send</option>
            <option value="mart">Mart</option>
            <option value="services">Services</option>
          </select>
          <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2 text-xs text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_40%,_transparent)] dark:text-[color:var(--app-text-soft)]">
            <p className="font-semibold">Lokasi live:</p>
            <p>
              {currentLocation
                ? `${currentLocation.lat.toFixed(5)}, ${currentLocation.lng.toFixed(5)}`
                : 'Belum terdeteksi'}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void goOnline()}
            disabled={loadingPresence}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-xl bg-[color:var(--app-accent)] px-4 text-xs font-bold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)] disabled:opacity-60"
          >
            {loadingPresence ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bike className="h-3.5 w-3.5" />}
            Go Online
          </button>
          <button
            type="button"
            onClick={() => void goOffline()}
            disabled={loadingPresence}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 text-xs font-bold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] disabled:opacity-60 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface-strong)]"
          >
            Go Offline
          </button>
          <span
            className={`inline-flex min-h-[40px] items-center rounded-xl px-3 text-xs font-bold ${
              online
                ? 'border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] dark:border-[color:color-mix(in_srgb,_var(--app-accent-border)_40%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_20%,_transparent)] dark:text-[color:var(--app-accent)]'
                : 'border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]'
            }`}
          >
            {online ? 'Status: ONLINE' : 'Status: OFFLINE'}
          </span>
          {activeOrderId ? (
            <span className="inline-flex min-h-[40px] items-center rounded-xl border border-[color:var(--app-info-border)] bg-[color:var(--app-info-soft)] px-3 text-xs font-bold text-[color:var(--app-info)] dark:border-[color:var(--app-info-border)] dark:bg-[color:color-mix(in_srgb,_var(--app-info)_30%,_transparent)] dark:text-[color:var(--app-info)]">
              Active Order: {activeOrderId.slice(0, 8)}...
            </span>
          ) : null}
        </div>
        {activeOrderId ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void updateLifecycle('pickup_confirmed')}
              disabled={lifecycleLoading}
              className="inline-flex min-h-[34px] items-center rounded-lg border border-[color:var(--app-accent-border)] bg-[color:var(--app-surface-strong)] px-3 text-xs font-bold text-[color:var(--app-accent)] hover:bg-[color:var(--app-accent-soft)] disabled:opacity-60 dark:border-[color:var(--app-accent-border)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-accent)]"
            >
              Pickup Confirmed
            </button>
            <button
              type="button"
              onClick={() => void updateLifecycle('delivery_started')}
              disabled={lifecycleLoading}
              className="inline-flex min-h-[34px] items-center rounded-lg border border-[color:var(--app-info-border)] bg-[color:var(--app-surface-strong)] px-3 text-xs font-bold text-[color:var(--app-info)] hover:bg-[color:var(--app-info-soft)] disabled:opacity-60 dark:border-[color:var(--app-info-border)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-info)]"
            >
              Delivery Started
            </button>
            <button
              type="button"
              onClick={() => void updateLifecycle('delivery_completed')}
              disabled={lifecycleLoading}
              className="inline-flex min-h-[34px] items-center rounded-lg border border-[color:var(--app-group-talent-border)] bg-[color:var(--app-surface-strong)] px-3 text-xs font-bold text-[color:var(--app-group-talent)] hover:bg-[color:var(--app-group-talent-soft)] disabled:opacity-60 dark:border-[color:var(--app-group-talent-border)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-group-talent)]"
            >
              Delivery Completed
            </button>
          </div>
        ) : null}
        {locationError ? (
          <p className="mt-2 text-xs text-[color:var(--app-danger)] dark:text-[color:var(--app-danger)]">{locationError}</p>
        ) : null}
      </section>

      {currentLocation && featuredPickup ? (
        <section className="rounded-2xl border border-[color:var(--app-info-border)] bg-[color:var(--app-info-soft)] p-3 shadow-sm dark:border-[color:color-mix(in_srgb,_var(--app-info-border)_40%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)]">
          <p className="text-xs font-semibold text-[color:var(--app-info)] dark:text-[color:var(--app-info)]">
            Peta pickup terdekat (otomatis):
          </p>
          <div className="mt-2 overflow-hidden rounded-xl border border-[color:var(--app-info-border)] bg-[color:var(--app-surface-strong)] dark:border-[color:color-mix(in_srgb,_var(--app-info-border)_50%,_transparent)] dark:bg-[color:var(--app-surface-strong)]">
            <OpenSourceTripMap
              origin={currentLocation}
              destination={featuredPickup}
              originLabel="Driver"
              destinationLabel="Pickup"
              className="h-56 w-full"
              refreshIntervalMs={10000}
            />
          </div>
          <a
            href={buildOsmDirectionsUrl(currentLocation, featuredPickup)}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[color:var(--app-info-border)] bg-[color:var(--app-surface-strong)] px-3 text-xs font-bold text-[color:var(--app-info)] hover:bg-[color:var(--app-info-soft)] dark:border-[color:var(--app-info-border)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-info)] dark:hover:bg-[color:var(--app-surface-strong)]"
          >
            <Navigation className="h-3.5 w-3.5" />
            Buka rute OSM
          </a>
        </section>
      ) : null}

      <section className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[color:var(--app-text)]">
            Dispatch Inbox
          </h2>
          <button
            type="button"
            onClick={() => void loadInbox()}
            disabled={loadingInbox || !online}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-xs font-bold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] disabled:opacity-60 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface-strong)]"
          >
            {loadingInbox ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
            Refresh
          </button>
        </div>

        {inbox.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
            {online
              ? 'Belum ada broadcast order. Tunggu rider terdekat membuat order.'
              : 'Jadikan online dulu untuk menerima dispatch.'}
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {inbox.map((item) => (
              <article
                key={`${item.id}-${item.order_id}`}
                className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 text-xs dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_40%,_transparent)]"
              >
                <p className="font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                  Order: {item.order_id}
                </p>
                <p className="mt-1 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                  Service: {item.service} - Distance: {item.distance_m}m - Radius: {item.radius_m}m
                </p>
                {item.pickup ? (
                  <p className="mt-1 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                    Pickup: {item.pickup.lat.toFixed(5)}, {item.pickup.lng.toFixed(5)}
                  </p>
                ) : null}
                {currentLocation && item.pickup ? (
                  <a
                    href={buildOsmDirectionsUrl(currentLocation, item.pickup)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex min-h-[30px] items-center gap-1 rounded-lg border border-[color:var(--app-info-border)] bg-[color:var(--app-surface-strong)] px-2.5 text-[11px] font-bold text-[color:var(--app-info)] hover:bg-[color:var(--app-info-soft)] dark:border-[color:var(--app-info-border)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-info)] dark:hover:bg-[color:var(--app-surface-strong)]"
                  >
                    <MapPinned className="h-3.5 w-3.5" />
                    Lihat pickup map
                  </a>
                ) : null}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void respondDispatch(item.order_id, true)}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-[color:var(--app-accent)] px-3 text-[11px] font-bold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)]"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => void respondDispatch(item.order_id, false)}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-[11px] font-bold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface-strong)]"
                  >
                    Skip
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {error ? (
        <p className="rounded-xl border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-3 py-2 text-xs text-[color:var(--app-danger)]">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-2 text-xs text-[color:var(--app-accent)]">
          {message}
        </p>
      ) : null}
    </main>
  );
}
