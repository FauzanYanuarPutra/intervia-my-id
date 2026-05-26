'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Camera, LayoutDashboard, Loader2, QrCode, ScanLine, ShieldAlert } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { describeGetUserMediaError, getUserMediaErrorName } from '@/lib/mediaDevices';
import {
  UMKM_DISCOVERY_PATH,
  buildUsahaPath,
  buildUmkmScanPath,
} from '@/lib/umkmSurface';

type UmkmScanClientProps = {
  locale: string;
  isId: boolean;
};

type ScanResponse = {
  data?: {
    redirect_path: string;
    store: {
      name: string;
      city: string;
    };
    table?: {
      table_code: string;
    } | null;
    token: {
      mode: 'online' | 'offline';
    };
  };
  error?: string;
};

type CameraState = 'idle' | 'requesting' | 'ready' | 'denied' | 'unsupported' | 'error';

type BarcodeDetectorResult = {
  rawValue?: string;
};

type BarcodeDetectorLike = {
  detect: (image: ImageBitmapSource) => Promise<BarcodeDetectorResult[]>;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function getCameraEnvironmentError(isId: boolean): string | null {
  if (typeof window === 'undefined') {
    return isId ? 'Kamera cuma bisa dipakai dari browser.' : 'Camera access is available only in the browser.';
  }
  if (!window.isSecureContext) {
    return isId
      ? 'Buka lewat HTTPS atau localhost untuk pakai kamera.'
      : 'Camera access requires HTTPS or localhost.';
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return isId
      ? 'Browser ini belum support akses kamera.'
      : 'This browser does not support camera access.';
  }
  return null;
}

function describeCameraError(error: unknown, isId: boolean): string {
  const name = getUserMediaErrorName(error);
  if (!isId) return describeGetUserMediaError(error, { audio: false, video: true });

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Izin kameranya belum dikasih. Aktifkan dulu, lalu coba lagi.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Kameranya nggak ketemu. Coba sambungkan dulu lalu ulangi.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Kameranya lagi dipakai aplikasi lain.';
  }
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return 'Pengaturan kamera ini belum cocok di perangkat kamu.';
  }
  if (name === 'AbortError') {
    return 'Kamera belum kebuka. Coba lagi ya.';
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return 'Kamera belum bisa diakses.';
}

function extractTokenFromQr(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const tokenParam = url.searchParams.get('token');
    if (tokenParam) return tokenParam.trim();
  } catch {
    // not a url, continue
  }
  const tokenMatch = trimmed.match(/token=([^&\s]+)/i);
  if (tokenMatch?.[1]) return decodeURIComponent(tokenMatch[1]);
  return trimmed;
}

export function UmkmScanClient({ locale, isId }: UmkmScanClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = (searchParams.get('token') || '').trim();
  const hasToken = token.length > 0;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ScanResponse['data'] | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [cameraMessage, setCameraMessage] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanRafRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);

  useEffect(() => {
    if (token) setManualToken(token);
  }, [token]);

  useEffect(() => {
    let active = true;
    if (!token) {
      void Promise.resolve().then(() => {
        if (!active) return;
        setLoading(false);
        setError(null);
        setResolved(null);
      });
      return;
    }

    const load = async () => {
      await Promise.resolve();
      if (!active) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/super-app/umkm/scan?token=${encodeURIComponent(token)}`, {
          cache: 'no-store',
          credentials: 'include',
        });
        const payload = (await res.json().catch(() => ({}))) as ScanResponse;
        if (!res.ok || !payload.data) {
          throw new Error(payload.error || 'QR token not found');
        }
        if (!active) return;
        const resolvedData = payload.data;
        setResolved(resolvedData);
        window.setTimeout(() => {
          router.replace(`/${locale}${resolvedData.redirect_path}`);
        }, 700);
      } catch (err: unknown) {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : isId
              ? 'QR-nya nggak valid atau sudah kedaluwarsa.'
              : 'QR token is invalid or expired.',
        );
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [isId, locale, router, token]);

  const stopCamera = useCallback(() => {
    if (scanRafRef.current) {
      window.cancelAnimationFrame(scanRafRef.current);
      scanRafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setVideoReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (hasToken) return;
    const envError = getCameraEnvironmentError(isId);
    if (envError) {
      setCameraState('unsupported');
      setCameraMessage(envError);
      return;
    }
    setCameraState('requesting');
    setCameraMessage(null);
    setVideoReady(false);
    stopCamera();

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
      streamRef.current = stream;
      setCameraState('ready');
    } catch (err) {
      const errorName = getUserMediaErrorName(err);
      const denied = errorName === 'NotAllowedError' || errorName === 'SecurityError';
      setCameraState(denied ? 'denied' : 'error');
      setCameraMessage(describeCameraError(err, isId));
    }
  }, [hasToken, isId, stopCamera]);

  useEffect(() => {
    if (hasToken) {
      stopCamera();
      return;
    }
    void startCamera();
  }, [hasToken, startCamera, stopCamera]);

  useEffect(() => {
    if (cameraState !== 'ready' || !streamRef.current || !videoRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    const onCanPlay = () => {
      setVideoReady(true);
    };
    video.addEventListener('canplay', onCanPlay);
    video.play().catch(() => {});
    return () => {
      video.removeEventListener('canplay', onCanPlay);
    };
  }, [cameraState]);

  useEffect(() => {
    if (cameraState !== 'ready' || hasToken) return;
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!Detector) return;
    if (!detectorRef.current) {
      detectorRef.current = new Detector({ formats: ['qr_code'] });
    }
    let active = true;
    let lastScanAt = 0;

    const scanFrame = async (now: number) => {
      if (!active) return;
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (!video || !detector || video.readyState < 2) {
        scanRafRef.current = window.requestAnimationFrame(scanFrame);
        return;
      }
      if (now - lastScanAt < 500) {
        scanRafRef.current = window.requestAnimationFrame(scanFrame);
        return;
      }
      lastScanAt = now;

      try {
        const results = await detector.detect(video);
        if (results.length > 0) {
          const tokenCandidate = extractTokenFromQr(results[0]?.rawValue || '');
          if (tokenCandidate) {
            stopCamera();
            router.replace(`/${locale}${buildUmkmScanPath(tokenCandidate)}`);
            return;
          }
        }
      } catch {
        // ignore scan errors
      }
      scanRafRef.current = window.requestAnimationFrame(scanFrame);
    };

    scanRafRef.current = window.requestAnimationFrame(scanFrame);
    return () => {
      active = false;
      if (scanRafRef.current) {
        window.cancelAnimationFrame(scanRafRef.current);
        scanRafRef.current = null;
      }
    };
  }, [cameraState, hasToken, locale, router, stopCamera]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const handleManualResolve = () => {
    const trimmed = manualToken.trim();
    if (!trimmed) {
      setManualError(isId ? 'Masukin token QR dulu ya.' : 'Please enter the QR token.');
      return;
    }
    setManualError(null);
    router.replace(`/${locale}${buildUmkmScanPath(trimmed)}`);
  };

  const showError = Boolean(error) && hasToken;
  const scanSupported =
    typeof window !== 'undefined' &&
    Boolean((window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector);
  const showCameraRetry = cameraState === 'denied' || cameraState === 'error';
  const cameraStatusLabel =
    cameraState === 'requesting'
      ? isId
        ? 'Lagi minta izin kamera...'
        : 'Requesting camera permission...'
      : cameraState === 'denied'
        ? isId
          ? 'Izin kamera belum dikasih'
          : 'Camera permission denied'
        : cameraState === 'unsupported'
          ? isId
            ? 'Kamera belum didukung'
            : 'Camera not supported'
      : cameraState === 'error'
            ? isId
              ? 'Kamera belum siap'
              : 'Camera unavailable'
            : isId
              ? 'Lagi siapin kamera...'
              : 'Preparing camera...';

  return (
    <main className="page-shell overflow-x-hidden py-0 sm:py-4">
      <div className="space-y-0 sm:space-y-4">
        <section className="ui-panel rounded-none border-x-0 p-3 sm:rounded-[24px] sm:border-x sm:p-4">
          <div className="mx-auto flex max-w-md flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ScanLine className="h-6 w-6" />}
            </div>
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--app-accent)]">
              Lajukan UMKM
            </p>
            <h1 className="mt-1.5 text-[1.45rem] font-black tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-[1.7rem]">
              {loading
                ? isId
                  ? 'Lagi cek QR...'
                  : 'Resolving scan...'
                : !hasToken
                  ? isId
                    ? 'Scan QR usaha'
                    : 'Scan business QR'
                  : showError
                    ? isId
                      ? 'QR belum kebaca'
                      : 'Scan failed'
                    : isId
                    ? 'QR ketemu'
                    : 'Scan resolved'}
            </h1>
            <p className="mt-2 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
              {showError
                ? error
                : resolved
                  ? isId
                    ? `Sebentar, kamu lagi diarahkan ke ${resolved.store.name}${resolved.table?.table_code ? ` meja ${resolved.table.table_code}` : ''}.`
                    : `Redirecting to ${resolved.store.name}${resolved.table?.table_code ? ` table ${resolved.table.table_code}` : ''}.`
                  : isId
                    ? 'Arahkan kamera ke QR. Kalau belum kebaca, tempel token di bawah.'
                    : 'Scan the QR. If it fails, paste the token.'}
            </p>
            {!hasToken ? (
              <div className="mt-4 w-full space-y-3">
                <div className="overflow-hidden rounded-[22px] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)]">
                  <div className="relative aspect-video w-full bg-[color:var(--app-surface-strong)]">
                    {cameraState === 'ready' ? (
                      <>
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="h-full w-full object-cover"
                        />
                        <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-4">
                          <div className="rounded-full bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_70%,_transparent)] px-4 py-1 text-[11px] font-semibold text-[color:var(--app-text-inverse)]">
                            {isId ? 'Arahkan ke QR usahanya' : 'Point at a business QR'}
                          </div>
                        </div>
                        {!videoReady ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_50%,_transparent)] text-xs font-semibold text-[color:var(--app-text-inverse)]">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {isId ? 'Lagi buka kamera...' : 'Loading camera...'}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)]">
                          {cameraState === 'requesting' ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : cameraState === 'denied' ? (
                            <ShieldAlert className="h-5 w-5" />
                          ) : (
                            <Camera className="h-5 w-5" />
                          )}
                        </div>
                        <p className="text-sm font-semibold text-[color:var(--app-text)]">{cameraStatusLabel}</p>
                        <p className="text-xs text-[color:var(--app-text-soft)]">
                          {cameraMessage ||
                            (isId
                              ? 'Kasih izin kamera biar QR bisa kebaca otomatis.'
                              : 'Allow camera access to scan QR automatically.')}
                        </p>
                        {showCameraRetry ? (
                          <button
                            type="button"
                            onClick={startCamera}
                            className="ui-button-primary min-h-[40px] px-4 text-xs font-semibold"
                          >
                            {isId ? 'Nyalain kamera lagi' : 'Enable camera'}
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[18px] border border-[color:var(--app-border-strong)] px-3.5 py-3 text-left text-xs text-[color:var(--app-text-soft)]">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[color:var(--app-accent)]">
                    {isId ? 'Biar cepat' : 'Quick guide'}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--app-text)]">
                    {isId
                      ? 'Arahkan kamera ke QR. Begitu kebaca, kamu langsung masuk.'
                      : 'Point the camera at the QR. We will redirect once detected.'}
                  </p>
                  {!scanSupported ? (
                    <p className="mt-1 text-[11px] text-[color:var(--app-warning)]">
                      {isId
                        ? 'Browser ini belum support scan QR otomatis. Pakai token manual di bawah ya.'
                        : 'This browser does not support automatic QR scanning. Use the manual token below.'}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-left text-xs font-semibold ui-text-soft">
                    {isId ? 'Token manual' : 'Backup token'}
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={manualToken}
                      onChange={(event) => setManualToken(event.target.value)}
                      placeholder={isId ? 'Tempel token QR di sini' : 'Paste token here'}
                      className="ui-control min-h-[38px] flex-1 text-[13px]"
                    />
                    <button
                      type="button"
                      onClick={handleManualResolve}
                      className="ui-button-primary px-3.5 text-[12px] font-semibold"
                    >
                      {isId ? 'Lanjut buka' : 'Open'}
                    </button>
                  </div>
                  {manualError ? <p className="text-left text-xs text-[color:var(--app-danger)]">{manualError}</p> : null}
                  <p className="text-left text-[11px] ui-text-soft">
                    {isId
                      ? 'Tip: kalau scan dari kamera, pastikan QR-nya memang ngarah ke link Lajukan.'
                      : 'Tip: if you scan with camera, the QR should point to Lajukan.'}
                  </p>
                </div>
              </div>
            ) : null}
            {resolved ? (
              <div className="mt-3.5 rounded-[18px] border border-[color:var(--app-border-strong)] px-3.5 py-3 text-sm text-[color:var(--app-text)]">
                <p className="font-bold text-[color:var(--app-text)]">
                  <span className="text-[color:var(--app-accent)]">{resolved.store.name}</span> - {resolved.store.city}
                </p>
                <p className="mt-1 text-[color:var(--app-text-soft)]">
                  {resolved.token.mode === 'offline'
                    ? isId
                      ? 'Mode meja / order offline'
                      : 'Offline dine-in order mode'
                    : isId
                      ? 'Mode toko online'
                      : 'Online storefront mode'}
                </p>
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Link href={UMKM_DISCOVERY_PATH} className="ui-button-secondary inline-flex min-h-[36px] items-center justify-center gap-2 px-3.5 text-[12px] font-bold">
                <QrCode className="h-4 w-4" />
                {isId ? 'Cari UMKM' : 'Map'}
              </Link>
              <Link
                href={buildUsahaPath('home')}
                className="ui-button-secondary inline-flex min-h-[36px] items-center justify-center gap-2 px-3.5 text-[12px] font-bold"
              >
                <LayoutDashboard className="h-4 w-4" />
                {isId ? 'Buka kelola' : 'Manage'}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

