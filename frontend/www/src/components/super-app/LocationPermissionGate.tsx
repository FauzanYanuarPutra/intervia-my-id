'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import {
  Loader2,
  LocateFixed,
  MapPin,
  Navigation,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  hasNativePermissionsBridge,
  openNativeSettings,
} from '@/lib/nativeBridge';

type GateState =
  | 'checking'
  | 'prompt'
  | 'requesting'
  | 'denied'
  | 'unsupported'
  | 'insecure'
  | 'granted';

type LocationPermissionGateProps = {
  isId: boolean;
  enabled?: boolean;
  redirectPath?: string;
  onGranted?: () => void;
  onContinueWithoutLocation?: () => void;
  allowManualEntry?: boolean;
};

function deniedMessage(isId: boolean): string {
  return isId
    ? 'Izin lokasi ditolak. Kamu masih bisa isi pickup manual, tapi matching driver dan ETA bisa kurang presisi.'
    : 'Location access was denied. You can still enter pickup manually, but driver matching and ETA may be less precise.';
}

function guidanceMessage(isId: boolean, inNativeApp: boolean): string {
  if (inNativeApp) {
    return isId
      ? 'Buka pengaturan perangkat untuk mengizinkan lokasi, lalu kembali ke aplikasi.'
      : 'Open device settings to allow location, then return to the app.';
  }
  return isId
    ? 'Klik ikon gembok di URL, ubah Location ke Allow, lalu coba lagi.'
    : 'Click the lock icon in the URL bar, set Location to Allow, then try again.';
}

function stateTitle(state: GateState, isId: boolean): string {
  if (state === 'insecure')
    return isId ? 'Butuh koneksi aman' : 'Secure context required';
  if (state === 'unsupported')
    return isId ? 'Browser belum mendukung' : 'Browser support missing';
  if (state === 'denied')
    return isId ? 'Lokasi belum diizinkan' : 'Location not allowed yet';
  if (state === 'requesting')
    return isId ? 'Meminta izin lokasi' : 'Requesting location';
  return isId
    ? 'Aktifkan lokasi untuk pickup akurat'
    : 'Enable location for accurate pickup';
}

export function LocationPermissionGate({
  isId,
  enabled = true,
  redirectPath = '/home',
  onGranted,
  onContinueWithoutLocation,
  allowManualEntry = true,
}: LocationPermissionGateProps) {
  const router = useRouter();
  const [state, setState] = useState<GateState>('checking');
  const [message, setMessage] = useState<string>('');
  const [canOpenSettings] = useState(() => hasNativePermissionsBridge());
  const [dismissed, setDismissed] = useState(false);

  const redirectHome = useCallback(() => {
    router.replace(redirectPath);
  }, [redirectPath, router]);

  const continueManual = useCallback(() => {
    setDismissed(true);
    onContinueWithoutLocation?.();
  }, [onContinueWithoutLocation]);

  const checkPermission = useCallback(async () => {
    if (!enabled) {
      return;
    }

    if (!window.isSecureContext) {
      setState('insecure');
      setMessage(
        isId
          ? 'Browser hanya mengizinkan GPS di HTTPS atau localhost.'
          : 'The browser only allows GPS on HTTPS or localhost.',
      );
      return;
    }

    if (!navigator.geolocation) {
      setState('unsupported');
      setMessage(
        isId
          ? 'Browser ini tidak mendukung geolocation.'
          : 'This browser does not support geolocation.',
      );
      return;
    }

    const permissionsApi = (
      navigator as Navigator & {
        permissions?: {
          query: (descriptor: {
            name: PermissionName;
          }) => Promise<PermissionStatus>;
        };
      }
    ).permissions;

    if (!permissionsApi?.query) {
      setState('prompt');
      setMessage('');
      return;
    }

    try {
      const status = await permissionsApi.query({ name: 'geolocation' });
      if (status.state === 'granted') {
        setState('granted');
        setMessage('');
        return;
      }
      if (status.state === 'denied') {
        setState('denied');
        setMessage(deniedMessage(isId));
        return;
      }
      setState('prompt');
      setMessage('');
    } catch {
      setState('prompt');
      setMessage('');
    }
  }, [enabled, isId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void checkPermission();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [checkPermission]);

  useEffect(() => {
    if (state === 'granted') {
      onGranted?.();
    }
  }, [onGranted, state]);

  const requestPermission = useCallback(() => {
    if (!enabled) return;
    if (!window.isSecureContext) {
      setState('insecure');
      setMessage(
        isId
          ? 'Browser hanya mengizinkan GPS di HTTPS atau localhost.'
          : 'The browser only allows GPS on HTTPS or localhost.',
      );
      return;
    }
    if (!navigator.geolocation) {
      setState('unsupported');
      setMessage(
        isId
          ? 'Browser ini tidak mendukung geolocation.'
          : 'This browser does not support geolocation.',
      );
      return;
    }

    setState('requesting');
    setMessage('');
    navigator.geolocation.getCurrentPosition(
      () => {
        setState('granted');
        setMessage('');
      },
      geoError => {
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setState('denied');
          setMessage(deniedMessage(isId));
          return;
        }
        setState('prompt');
        setMessage(
          isId
            ? 'GPS belum bisa dibaca. Pastikan Location aktif, lalu coba lagi.'
            : 'GPS could not be read yet. Make sure Location is on, then try again.',
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 10000,
      },
    );
  }, [enabled, isId]);

  if (!enabled || state === 'granted' || dismissed) {
    return null;
  }

  const showSettingsButton = canOpenSettings && state === 'denied';
  const showManualFallback = allowManualEntry;

  const benefits = [
    {
      icon: Navigation,
      title: isId ? 'Matching cepat' : 'Faster matching',
      text: isId
        ? 'Driver terdekat bisa langsung diprioritaskan.'
        : 'The nearest driver can be prioritized immediately.',
    },
    {
      icon: LocateFixed,
      title: isId ? 'ETA lebih akurat' : 'More accurate ETA',
      text: isId
        ? 'Estimasi pickup dan perjalanan terasa lebih real.'
        : 'Pickup and travel estimates stay realistic.',
    },
    {
      icon: ShieldCheck,
      title: isId ? 'Tracking real-time' : 'Real-time tracking',
      text: isId
        ? 'Posisi pickup, driver, dan tujuan lebih jelas sejak awal.'
        : 'Pickup, driver, and destination stay clear from the start.',
    },
  ];

  return (
    <div className="ui-layer-modal fixed inset-0 flex items-end justify-center bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_56%,_transparent)] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))]  sm:items-center sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        className="ui-sheet max-h-[calc(var(--app-viewport-height)-2rem)] w-full max-w-[680px] overflow-y-auto p-4 sm:p-5"
      >
        <div className="ui-bottom-sheet-handle sm:hidden" />

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3 sm:mt-0">
          <div>
            <p className="ui-kicker">
              <MapPin className="h-3.5 w-3.5" />
              {isId ? 'Izin lokasi' : 'Location access'}
            </p>
            <h2 className="mt-3 text-2xl font-[1000] leading-tight tracking-tight text-[color:var(--app-text)]">
              {stateTitle(state, isId)}
            </h2>
            <p className="mt-2 max-w-[36rem] text-sm text-[color:var(--app-text-soft)]">
              {isId
                ? 'Lajukan pakai lokasi untuk isi pickup otomatis, menghitung ETA yang lebih masuk akal, dan menampilkan tracking driver secara real-time.'
                : 'Lajukan uses location to fill pickup automatically, estimate ETA more realistically, and show real-time driver tracking.'}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--app-success-border)] bg-[color:var(--app-success-soft)] px-3 py-1 text-[11px] font-semibold text-[color:var(--app-success)]">
            <ShieldCheck className="h-3.5 w-3.5" />
            {isId
              ? 'Dipakai hanya saat order aktif'
              : 'Used only while the order is active'}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {benefits.map(item => (
            <div
              key={item.title}
              className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                <item.icon className="h-4.5 w-4.5" />
              </span>
              <p className="mt-3 text-sm font-semibold text-[color:var(--app-text)]">
                {item.title}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
                {item.text}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-[24px] border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] p-4 text-[color:var(--app-warning)]">
          <p className="inline-flex items-center gap-2 text-sm font-semibold">
            {state === 'requesting' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : state === 'denied' ? (
              <ShieldAlert className="h-4 w-4" />
            ) : (
              <MapPin className="h-4 w-4" />
            )}
            {stateTitle(state, isId)}
          </p>
          <p className="mt-2 text-[12px] leading-5">
            {message || guidanceMessage(isId, canOpenSettings)}
          </p>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr]">
          <button
            type="button"
            onClick={requestPermission}
            disabled={state === 'requesting'}
            className="ui-button-primary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-60"
          >
            {state === 'requesting' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MapPin className="h-4 w-4" />
            )}
            {isId ? 'Izinkan lokasi' : 'Allow location'}
          </button>

          {showManualFallback ? (
            <button
              type="button"
              onClick={continueManual}
              className="ui-button-secondary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold"
            >
              <Navigation className="h-4 w-4" />
              {isId ? 'Lanjut tanpa GPS' : 'Continue without GPS'}
            </button>
          ) : (
            <button
              type="button"
              onClick={redirectHome}
              className="ui-button-secondary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold"
            >
              {isId ? 'Kembali ke Home' : 'Back to Home'}
            </button>
          )}
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr]">
          {showSettingsButton ? (
            <button
              type="button"
              onClick={openNativeSettings}
              className="inline-flex min-h-[44px] items-center justify-center rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 text-sm font-semibold text-[color:var(--app-text)]"
            >
              {isId ? 'Buka pengaturan perangkat' : 'Open device settings'}
            </button>
          ) : (
            <div />
          )}
          <button
            type="button"
            onClick={redirectHome}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[18px] border border-transparent px-4 text-sm font-semibold text-[color:var(--app-text-soft)]"
          >
            {isId ? 'Nanti saja' : 'Maybe later'}
          </button>
        </div>
      </section>
    </div>
  );
}
