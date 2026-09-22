'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  SwitchCamera,
  X,
  Zap,
  ZapOff,
} from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  onPickFile?: () => void;
  locale?: 'id' | 'en';
};

type CameraStatus = 'idle' | 'loading' | 'ready' | 'captured' | 'capturing' | 'error';

function cameraErrorMessage(error: unknown, locale: 'id' | 'en'): string {
  const name = error instanceof DOMException ? error.name : '';
  if (locale === 'en') {
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return 'Camera permission was denied. Allow camera access and try again.';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return 'No camera was found on this device.';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return 'The camera is being used by another app.';
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      return 'Camera access requires a secure connection.';
    }
    return 'Could not open the camera. Please try again.';
  }

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Izin kamera ditolak. Izinkan akses kamera lalu coba lagi.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Kamera tidak ditemukan di perangkat ini.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Kamera sedang dipakai aplikasi lain.';
  }
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Akses kamera membutuhkan koneksi yang aman.';
  }
  return 'Kamera tidak bisa dibuka. Coba lagi.';
}

export function CameraCaptureModal({
  open,
  onClose,
  onCapture,
  onPickFile,
  locale = 'id',
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const capturedUrlRef = useRef<string | null>(null);

  const [status, setStatus] = useState<CameraStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(
    'environment',
  );
  const [hasTorch, setHasTorch] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(
    null,
  );

  const labels = useMemo(
    () =>
      locale === 'id'
        ? {
            close: 'Tutup kamera',
            opening: 'Membuka kamera…',
            retry: 'Coba lagi',
            switchCamera: 'Ganti kamera',
            torchOn: 'Matikan lampu',
            torchOff: 'Nyalakan lampu',
            capture: 'Ambil foto',
            gallery: 'Buka galeri',
            retake: 'Ambil ulang',
            usePhoto: 'Gunakan foto',
            processing: 'Memproses foto…',
          }
        : {
            close: 'Close camera',
            opening: 'Opening camera…',
            retry: 'Try again',
            switchCamera: 'Switch camera',
            torchOn: 'Turn flash off',
            torchOff: 'Turn flash on',
            capture: 'Take photo',
            gallery: 'Open gallery',
            retake: 'Retake',
            usePhoto: 'Use photo',
            processing: 'Processing photo…',
          },
    [locale],
  );

  const clearCapturedPreview = useCallback(() => {
    if (capturedUrlRef.current) {
      URL.revokeObjectURL(capturedUrlRef.current);
      capturedUrlRef.current = null;
    }
    setCapturedFile(null);
    setCapturedPreviewUrl(null);
  }, []);

  const stopStream = useCallback(() => {
    if (!streamRef.current) return;
    streamRef.current.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    if (!open) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg(cameraErrorMessage(new Error('unsupported'), locale));
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMsg(null);
    setVideoReady(false);
    setHasTorch(false);
    setTorchEnabled(false);
    clearCapturedPreview();
    stopStream();

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const capabilities =
        typeof track?.getCapabilities === 'function'
          ? (track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean })
          : null;

      setHasTorch(Boolean(capabilities?.torch));
      setTorchEnabled(false);
      setStatus('ready');
    } catch (error) {
      setErrorMsg(cameraErrorMessage(error, locale));
      setStatus('error');
    }
  }, [clearCapturedPreview, facingMode, locale, open, stopStream]);

  useEffect(() => {
    if (!open) return;

    const timeoutId = window.setTimeout(() => {
      void startCamera();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      stopStream();
    };
  }, [open, startCamera, stopStream]);

  useEffect(() => {
    if (status !== 'ready' || !streamRef.current || !videoRef.current) return;

    const video = videoRef.current;
    video.srcObject = streamRef.current;
    const onCanPlay = () => {
      setVideoReady(true);
      video.removeEventListener('canplay', onCanPlay);
    };

    video.addEventListener('canplay', onCanPlay);
    video.play().catch(() => {});

    return () => {
      video.removeEventListener('canplay', onCanPlay);
    };
  }, [status]);

  const handleSwitchCamera = useCallback(() => {
    setFacingMode(current => (current === 'environment' ? 'user' : 'environment'));
  }, []);

  const handleToggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !hasTorch) return;

    const next = !torchEnabled;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      } as MediaTrackConstraints);
      setTorchEnabled(next);
    } catch {
      setTorchEnabled(false);
    }
  }, [hasTorch, torchEnabled]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video || status !== 'ready' || !videoReady || !video.videoWidth) return;

    setStatus('capturing');

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setStatus('ready');
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      blob => {
        if (!blob) {
          setStatus('ready');
          return;
        }

        const file = new File([blob], `capture-${Date.now()}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });

        const url = URL.createObjectURL(blob);
        capturedUrlRef.current = url;
        setCapturedFile(file);
        setCapturedPreviewUrl(url);
        stopStream();
        setStatus('captured');
      },
      'image/jpeg',
      0.92,
    );
  }, [status, stopStream, videoReady]);

  const handleUsePhoto = useCallback(() => {
    if (!capturedFile) return;
    const file = capturedFile;
    clearCapturedPreview();
    onCapture(file);
    onClose();
    setStatus('idle');
  }, [capturedFile, clearCapturedPreview, onCapture, onClose]);

  const handleRetake = useCallback(() => {
    clearCapturedPreview();
    setStatus('idle');
    window.setTimeout(() => {
      void startCamera();
    }, 0);
  }, [clearCapturedPreview, startCamera]);

  const handleClose = useCallback(() => {
    stopStream();
    clearCapturedPreview();
    setHasTorch(false);
    setTorchEnabled(false);
    setVideoReady(false);
    setStatus('idle');
    onClose();
  }, [clearCapturedPreview, onClose, stopStream]);

  if (!open) return null;

  return (
    <div className="ui-layer-modal fixed inset-0 z-[10060] flex h-[100dvh] w-full items-center justify-center bg-black">
      <div className="relative flex h-full w-full max-w-[560px] flex-col overflow-hidden bg-[#090d0f] sm:h-[min(860px,calc(100dvh-1.5rem))] sm:rounded-[28px] sm:shadow-[0_28px_90px_rgba(0,0,0,0.5)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-28 bg-gradient-to-b from-black/75 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 px-3 pb-8 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/38 text-white backdrop-blur-md transition hover:bg-black/55 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            aria-label={labels.close}
            title={labels.close}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="flex items-center gap-2">
            {hasTorch && status === 'ready' ? (
              <button
                type="button"
                onClick={() => void handleToggleTorch()}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/38 text-white backdrop-blur-md transition hover:bg-black/55 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                aria-label={torchEnabled ? labels.torchOn : labels.torchOff}
                title={torchEnabled ? labels.torchOn : labels.torchOff}
              >
                {torchEnabled ? (
                  <ZapOff className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Zap className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            ) : null}

            {status === 'ready' ? (
              <button
                type="button"
                onClick={handleSwitchCamera}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/38 text-white backdrop-blur-md transition hover:bg-black/55 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                aria-label={labels.switchCamera}
                title={labels.switchCamera}
              >
                <SwitchCamera className="h-5 w-5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          {status === 'captured' && capturedPreviewUrl ? (
            <img
              src={capturedPreviewUrl}
              alt={locale === 'id' ? 'Pratinjau foto' : 'Photo preview'}
              className="h-full w-full object-contain bg-black"
            />
          ) : (
            <>
              {status === 'ready' || status === 'capturing' ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full bg-black object-cover"
                />
              ) : null}

              {status === 'loading' ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
                    <Loader2 className="h-7 w-7 animate-spin" />
                  </span>
                  <p className="text-sm font-semibold">{labels.opening}</p>
                </div>
              ) : null}

              {status === 'error' ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center text-white">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
                    <Camera className="h-7 w-7" />
                  </span>
                  <p className="max-w-sm text-sm font-semibold leading-5 text-white/85">
                    {errorMsg}
                  </p>
                  <button
                    type="button"
                    onClick={() => void startCamera()}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-[#111b21] transition hover:bg-white/90 active:scale-[0.98]"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    {labels.retry}
                  </button>
                </div>
              ) : null}
            </>
          )}

          {status === 'captured' ? (
            <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-2 bg-gradient-to-t from-black/85 via-black/48 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-20 sm:gap-3 sm:pb-5">
              <button
                type="button"
                onClick={handleRetake}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-black/45 px-5 text-sm font-bold text-white backdrop-blur-md transition hover:bg-black/60 active:scale-[0.98]"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                {labels.retake}
              </button>
              <button
                type="button"
                onClick={handleUsePhoto}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#25d366] px-5 text-sm font-bold text-[#071c14] shadow-[0_8px_24px_rgba(37,211,102,0.3)] transition hover:bg-[#22c55e] active:scale-[0.98]"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                {labels.usePhoto}
              </button>
            </div>
          ) : null}

          {status === 'capturing' ? (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/25 backdrop-blur-[1px]">
              <span className="inline-flex items-center gap-2 rounded-full bg-black/55 px-4 py-2 text-xs font-bold text-white backdrop-blur-md">
                <Loader2 className="h-4 w-4 animate-spin" />
                {labels.processing}
              </span>
            </div>
          ) : null}
        </div>

        {status === 'ready' ? (
          <div className="relative z-30 shrink-0 border-t border-white/8 bg-gradient-to-t from-black/90 to-black/58 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pb-5">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onPickFile}
                disabled={!onPickFile}
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition hover:bg-white/15 active:scale-95 disabled:pointer-events-none disabled:opacity-30"
                aria-label={labels.gallery}
                title={labels.gallery}
              >
                <ImageIcon className="h-5 w-5" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={handleCapture}
                disabled={!videoReady}
                className="inline-flex h-[76px] w-[76px] items-center justify-center rounded-full border-[6px] border-white/90 bg-white text-[#111b21] shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition hover:scale-[1.02] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-45"
                aria-label={labels.capture}
                title={labels.capture}
              >
                <span className="inline-flex h-[54px] w-[54px] items-center justify-center rounded-full bg-white ring-2 ring-black/10">
                  <Camera className="h-7 w-7" aria-hidden="true" />
                </span>
              </button>

              <span className="h-12 w-12 shrink-0" aria-hidden="true" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
