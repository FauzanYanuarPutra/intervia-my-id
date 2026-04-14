'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
};

export function CameraCaptureModal({ open, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'ready' | 'capturing' | 'error'
  >('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (!open) return;
    setStatus('loading');
    setErrorMsg(null);
    setVideoReady(false);
    stopStream();
    try {
      // Coba environment (kamera belakang) dulu, fallback ke user (webcam) untuk desktop
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
      streamRef.current = stream;
      setStatus('ready');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cannot access camera';
      setErrorMsg(msg);
      setStatus('error');
    }
  }, [open, stopStream]);

  useEffect(() => {
    if (open) {
      startCamera();
    }
    return () => {
      stopStream();
      if (!open) setStatus('idle');
    };
  }, [open, startCamera, stopStream]);

  // Pasang stream ke video setelah element ter-render (saat status ready)
  useEffect(() => {
    if (status === 'ready' && streamRef.current && videoRef.current) {
      setVideoReady(false);
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      const onCanPlay = () => {
        setVideoReady(true);
        video.removeEventListener('canplay', onCanPlay);
      };
      video.addEventListener('canplay', onCanPlay);
      video.play().catch(() => {});
      return () => video.removeEventListener('canplay', onCanPlay);
    }
  }, [status]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (
      !video ||
      !canvas ||
      status !== 'ready' ||
      !videoReady ||
      !video.videoWidth
    )
      return;

    setStatus('capturing');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setStatus('ready');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

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
        stopStream();
        onCapture(file);
        onClose();
        setStatus('idle');
      },
      'image/jpeg',
      0.9,
    );
  }, [status, videoReady, onCapture, onClose, stopStream]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[color:color-mix(in_srgb,_var(--app-overlay)_90%,_transparent)]">
      <div className="relative mx-4 max-h-[80svh] w-full max-w-lg overflow-hidden rounded-2xl bg-[color:var(--app-overlay)]">
        <button
          type="button"
          onClick={() => {
            stopStream();
            onClose();
          }}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_20%,_transparent)] flex items-center justify-center text-[color:var(--app-text-inverse)] hover:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_30%,_transparent)]"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {status === 'loading' && (
          <div className="aspect-video flex flex-col items-center justify-center gap-4 text-[color:var(--app-text-inverse)]">
            <Loader2 className="w-12 h-12 animate-spin" />
            <span>Opening camera…</span>
          </div>
        )}

        {status === 'error' && (
          <div className="aspect-video flex flex-col items-center justify-center gap-4 text-[color:var(--app-text-inverse)] p-4">
            <p className="text-center">{errorMsg ?? 'Camera access denied'}</p>
            <button
              type="button"
              onClick={startCamera}
              className="px-4 py-2 rounded-lg bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_20%,_transparent)] hover:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_30%,_transparent)]"
            >
              Try again
            </button>
          </div>
        )}

        {(status === 'ready' || status === 'capturing') && (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full aspect-video object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
          </>
        )}

        {status === 'ready' && (
          <div className="p-4 flex flex-col items-center gap-2">
            {!videoReady && (
              <span className="text-[color:color-mix(in_srgb,_var(--app-text-inverse)_70%,_transparent)] text-sm">
                Memuat kamera…
              </span>
            )}
            <button
              type="button"
              onClick={handleCapture}
              disabled={!videoReady}
              className="w-16 h-16 rounded-full bg-[color:var(--app-surface-strong)] flex items-center justify-center text-[color:var(--app-text)] hover:bg-[color:var(--app-surface)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Capture photo"
            >
              <Camera className="w-8 h-8" />
            </button>
          </div>
        )}

        {status === 'capturing' && (
          <div className="p-4 flex items-center justify-center gap-2 text-[color:var(--app-text-inverse)]">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Processing…</span>
          </div>
        )}
      </div>
    </div>
  );
}
