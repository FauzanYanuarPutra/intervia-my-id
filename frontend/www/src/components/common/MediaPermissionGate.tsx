'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera, Loader2, Mic, ShieldAlert } from 'lucide-react';
import {
  describeGetUserMediaError,
  getUserMediaErrorName,
} from '@/lib/mediaDevices';
import {
  hasNativePermissionsBridge,
  openNativeSettings,
} from '@/lib/nativeBridge';

type MediaNeed = {
  audio: boolean;
  video: boolean;
};

type GateState =
  | 'checking'
  | 'prompt'
  | 'requesting'
  | 'denied'
  | 'unsupported'
  | 'insecure'
  | 'granted'
  | 'error';

type MediaPermissionGateProps = {
  isId: boolean;
  need: MediaNeed;
  enabled?: boolean;
  title?: string;
  description?: string;
  allowLabel?: string;
  denyLabel?: string;
  onGranted?: () => void;
  onDenied?: () => void;
};

function mediaTargetLabel(need: MediaNeed, isId: boolean): string {
  if (need.audio && need.video)
    return isId ? 'kamera & mikrofon' : 'camera & microphone';
  if (need.video) return isId ? 'kamera' : 'camera';
  return isId ? 'mikrofon' : 'microphone';
}

function defaultTitle(need: MediaNeed, isId: boolean): string {
  if (need.audio && need.video)
    return isId ? 'Izinkan kamera & mikrofon' : 'Allow camera & microphone';
  if (need.video) return isId ? 'Izinkan kamera' : 'Allow camera';
  return isId ? 'Izinkan mikrofon' : 'Allow microphone';
}

function defaultDescription(need: MediaNeed, isId: boolean): string {
  if (need.audio && need.video) {
    return isId
      ? 'Panggilan video butuh akses kamera dan mikrofon.'
      : 'Video calls require access to your camera and microphone.';
  }
  if (need.video) {
    return isId
      ? 'Fitur ini butuh akses kamera untuk lanjut.'
      : 'This feature requires camera access to continue.';
  }
  return isId
    ? 'Panggilan suara butuh akses mikrofon.'
    : 'Voice calls require access to your microphone.';
}

function guidanceMessage(
  need: MediaNeed,
  isId: boolean,
  inNativeApp: boolean,
): string {
  const target = mediaTargetLabel(need, isId);
  if (inNativeApp) {
    return isId
      ? `Izinkan ${target} di pengaturan, lalu kembali.`
      : `Open device settings to allow ${target}, then return to the app.`;
  }
  return isId
    ? `Jika diblokir, klik ikon gembok, izinkan ${target}, lalu muat ulang.`
    : `If permission is blocked, click the lock icon in the URL bar, set ${target} to Allow, then reload.`;
}

function describeMediaError(
  error: unknown,
  need: MediaNeed,
  isId: boolean,
): string {
  const name = getUserMediaErrorName(error);
  if (!isId) return describeGetUserMediaError(error, need);
  const target = mediaTargetLabel(need, true);
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return `Izin ${target} ditolak.`;
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return `${target} tidak ditemukan.`;
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return `${target} sedang dipakai aplikasi lain.`;
  }
  if (
    name === 'OverconstrainedError' ||
    name === 'ConstraintNotSatisfiedError'
  ) {
    return `Pengaturan ${target} tidak didukung perangkat ini.`;
  }
  if (name === 'AbortError') {
    return `Gagal membuka ${target}. Coba lagi.`;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return `Gagal mengakses ${target}.`;
}

export function MediaPermissionGate({
  isId,
  need,
  enabled = true,
  title,
  description,
  allowLabel,
  denyLabel,
  onGranted,
  onDenied,
}: MediaPermissionGateProps) {
  const [state, setState] = useState<GateState>(
    enabled ? 'checking' : 'granted',
  );
  const [message, setMessage] = useState<string>('');

  const targetLabel = useMemo(() => mediaTargetLabel(need, isId), [isId, need]);
  const Icon = need.video ? Camera : Mic;
  const [canOpenSettings, setCanOpenSettings] = useState(false);
  const showSettingsButton =
    canOpenSettings && (state === 'denied' || state === 'error');

  useEffect(() => {
    setCanOpenSettings(hasNativePermissionsBridge());
  }, []);

  const checkPermission = useCallback(async () => {
    if (!enabled) {
      setState('granted');
      return;
    }

    if (typeof window === 'undefined') {
      setState('insecure');
      setMessage(
        isId ? 'Hanya tersedia di browser.' : 'Available only in the browser.',
      );
      return;
    }
    if (!window.isSecureContext) {
      setState('insecure');
      setMessage(
        isId
          ? 'Butuh HTTPS atau localhost untuk akses perangkat.'
          : 'HTTPS or localhost is required to access media devices.',
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unsupported');
      setMessage(
        isId
          ? 'Browser ini tidak mendukung akses kamera/mikrofon.'
          : 'This browser does not support camera/microphone access.',
      );
      return;
    }

    const permissionsApi = (
      navigator as Navigator & {
        permissions?: {
          query: (
            descriptor: PermissionDescriptor,
          ) => Promise<PermissionStatus>;
        };
      }
    ).permissions;

    if (!permissionsApi?.query) {
      setState('prompt');
      setMessage('');
      return;
    }

    try {
      const queries: Promise<PermissionStatus>[] = [];
      if (need.video) {
        queries.push(
          permissionsApi.query({ name: 'camera' as PermissionName }),
        );
      }
      if (need.audio) {
        queries.push(
          permissionsApi.query({ name: 'microphone' as PermissionName }),
        );
      }
      const results = await Promise.allSettled(queries);
      const states = results.map(result =>
        result.status === 'fulfilled' ? result.value.state : 'prompt',
      );
      if (states.includes('denied')) {
        setState('denied');
        setMessage(
          isId
            ? `Izin ${targetLabel} ditolak.`
            : `${targetLabel} permission denied.`,
        );
        return;
      }
      if (states.every(value => value === 'granted')) {
        setState('granted');
        setMessage('');
        onGranted?.();
        return;
      }
      setState('prompt');
      setMessage('');
    } catch {
      setState('prompt');
      setMessage('');
    }
  }, [enabled, isId, need.audio, need.video, onGranted, targetLabel]);

  useEffect(() => {
    void checkPermission();
  }, [checkPermission]);

  const requestPermission = useCallback(async () => {
    if (!enabled) return;
    setState('requesting');
    setMessage('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: need.video,
        audio: need.audio,
      });
      stream.getTracks().forEach(track => track.stop());
      setState('granted');
      onGranted?.();
    } catch (error) {
      const name = getUserMediaErrorName(error);
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setState('denied');
      } else {
        setState('error');
      }
      setMessage(describeMediaError(error, need, isId));
    }
  }, [enabled, isId, need, onGranted]);

  if (!enabled || state === 'granted') {
    return null;
  }

  return (
    <div className="ui-layer-modal fixed inset-0 flex items-center justify-center bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_70%,_transparent)] p-4 ">
      <section
        role="dialog"
        aria-modal="true"
        className="max-h-[80svh] w-full max-w-md overflow-y-auto rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 shadow-2xl dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
          {isId ? 'Izin perangkat' : 'Device permission'}
        </p>
        <h2 className="mt-2 text-lg font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
          {title || defaultTitle(need, isId)}
        </h2>
        <p className="mt-2 text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
          {description || defaultDescription(need, isId)}
        </p>

        <div className="mt-3 rounded-xl border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] px-3 py-2 text-xs text-[color:var(--app-warning)] dark:border-[color:color-mix(in_srgb,_var(--app-warning-border)_50%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-warning)_20%,_transparent)] dark:text-[color:var(--app-warning)]">
          <p className="inline-flex items-center gap-1 font-semibold">
            {state === 'requesting' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : state === 'denied' ? (
              <ShieldAlert className="h-3.5 w-3.5" />
            ) : (
              <Icon className="h-3.5 w-3.5" />
            )}
            {state === 'insecure'
              ? isId
                ? 'Butuh koneksi aman'
                : 'Secure context required'
              : state === 'unsupported'
                ? isId
                  ? 'Perangkat tidak tersedia'
                  : 'Media devices unavailable'
                : state === 'requesting'
                  ? isId
                    ? `Meminta izin ${targetLabel}...`
                    : `Requesting ${targetLabel} permission...`
                  : state === 'denied'
                    ? isId
                      ? `Izin ${targetLabel} ditolak`
                      : `${targetLabel} permission denied`
                    : state === 'error'
                      ? isId
                        ? 'Terjadi kendala izin'
                        : 'Permission error'
                      : isId
                        ? `Izin ${targetLabel} belum diberikan`
                        : `${targetLabel} permission not granted`}
          </p>
          <p className="mt-1">
            {message || guidanceMessage(need, isId, canOpenSettings)}
          </p>
        </div>

        <div className="mt-4 grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={requestPermission}
              disabled={state === 'requesting'}
              className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-xl bg-[color:var(--app-accent)] px-3 text-sm font-bold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)] disabled:opacity-60"
            >
              {state === 'requesting' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              {allowLabel || (isId ? 'Izinkan' : 'Allow')}
            </button>
            <button
              type="button"
              onClick={onDenied}
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm font-bold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface-strong)]"
            >
              {denyLabel || (isId ? 'Tidak sekarang' : 'Not now')}
            </button>
          </div>
          {showSettingsButton ? (
            <button
              type="button"
              onClick={openNativeSettings}
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)] px-3 text-sm font-bold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-strong)]"
            >
              {isId ? 'Buka pengaturan perangkat' : 'Open device settings'}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
