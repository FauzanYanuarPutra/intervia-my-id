'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from 'react';
import { Loader2, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

type CropTargetShape = 'round' | 'rect';

type ImageCropModalProps = {
  open: boolean;
  imageSrc: string;
  aspect: number;
  maxOutputSize?: number;
  title?: string;
  shape?: CropTargetShape;
  onCancel: () => void;
  onConfirm: (file: File) => Promise<void> | void;
};

type Size = {
  width: number;
  height: number;
};

type Point = {
  x: number;
  y: number;
};

type DragGesture = {
  mode: 'drag';
  origin: Point;
  pointerId: number;
  start: Point;
};

type PinchGesture = {
  mode: 'pinch';
  origin: Point;
  startDistance: number;
  startFocal: Point;
  startScale: number;
};

const MIN_FRAME_EDGE = 96;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function getClientPoint(event: PointerEvent<HTMLDivElement>): Point {
  return { x: event.clientX, y: event.clientY };
}

function getFramePoint(element: HTMLDivElement, client: Point): Point {
  const rect = element.getBoundingClientRect();
  return {
    x: client.x - rect.left - rect.width / 2,
    y: client.y - rect.top - rect.height / 2,
  };
}

function outputSize(maxOutputSize: number, aspect: number): Size {
  if (aspect >= 1) {
    return {
      width: maxOutputSize,
      height: Math.max(1, Math.round(maxOutputSize / aspect)),
    };
  }
  return {
    width: Math.max(1, Math.round(maxOutputSize * aspect)),
    height: maxOutputSize,
  };
}

export function ImageCropModal({
  open,
  imageSrc,
  aspect,
  maxOutputSize = 1200,
  title = 'Crop image',
  shape = 'rect',
  onCancel,
  onConfirm,
}: ImageCropModalProps) {
  useBodyScrollLock(open);

  const imageRef = useRef<HTMLImageElement | null>(null);
  const stageShellRef = useRef<HTMLDivElement | null>(null);
  const pointersRef = useRef<Map<number, Point>>(new Map());
  const gestureRef = useRef<DragGesture | PinchGesture | null>(null);

  const [frameSize, setFrameSize] = useState<Size>({
    width: 320,
    height: 320 / aspect,
  });
  const [naturalSize, setNaturalSize] = useState<Size>({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 });
  const [imageReady, setImageReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const frameClass = shape === 'round' ? 'rounded-full' : 'rounded-[24px]';
  const minScale = useMemo(() => {
    if (!naturalSize.width || !naturalSize.height) return 1;
    return Math.max(
      frameSize.width / naturalSize.width,
      frameSize.height / naturalSize.height,
    );
  }, [
    frameSize.height,
    frameSize.width,
    naturalSize.height,
    naturalSize.width,
  ]);
  const maxScale = Math.max(minScale * 5, minScale + 0.01);
  const zoomPercent = Math.max(100, Math.round((scale / minScale) * 100));

  useEffect(() => {
    if (!open) return;

    const updateFrame = () => {
      const shell = stageShellRef.current;
      const shellWidth = Math.max(1, shell?.clientWidth || window.innerWidth);
      const shellHeight = Math.max(1, shell?.clientHeight || window.innerHeight);
      const desktop = window.innerWidth >= 640;
      const inset = desktop ? 28 : 16;
      const availableWidth = Math.max(MIN_FRAME_EDGE, shellWidth - inset * 2);
      const availableHeight = Math.max(MIN_FRAME_EDGE, shellHeight - inset * 2);

      let width = Math.min(desktop ? 720 : 560, availableWidth);
      let height = width / aspect;

      if (height > availableHeight) {
        height = availableHeight;
        width = height * aspect;
      }

      const next = {
        width: Math.max(1, Math.floor(width)),
        height: Math.max(1, Math.floor(height)),
      };

      setFrameSize(prev =>
        Math.abs(prev.width - next.width) > 1 ||
        Math.abs(prev.height - next.height) > 1
          ? next
          : prev,
      );
    };

    const frame = window.requestAnimationFrame(updateFrame);
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(updateFrame)
        : null;

    if (stageShellRef.current && observer) {
      observer.observe(stageShellRef.current);
    }

    window.addEventListener('resize', updateFrame);
    window.addEventListener('orientationchange', updateFrame);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', updateFrame);
      window.removeEventListener('orientationchange', updateFrame);
    };
  }, [aspect, open]);

  useEffect(() => {
    if (!open) return;
    pointersRef.current.clear();
    gestureRef.current = null;
    setNaturalSize({ width: 0, height: 0 });
    setImageReady(false);
    setError('');
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [imageSrc, open]);

  useEffect(() => {
    if (!open || !naturalSize.width || !naturalSize.height) return;
    setScale(minScale);
    setPosition({ x: 0, y: 0 });
  }, [imageSrc, minScale, naturalSize.height, naturalSize.width, open]);

  const clampPosition = useCallback(
    (nextX: number, nextY: number, nextScale = scale): Point => {
      if (!naturalSize.width || !naturalSize.height) return { x: 0, y: 0 };

      const displayedWidth = naturalSize.width * nextScale;
      const displayedHeight = naturalSize.height * nextScale;
      const maxOffsetX = Math.max(0, (displayedWidth - frameSize.width) / 2);
      const maxOffsetY = Math.max(0, (displayedHeight - frameSize.height) / 2);

      return {
        x: clamp(nextX, -maxOffsetX, maxOffsetX),
        y: clamp(nextY, -maxOffsetY, maxOffsetY),
      };
    },
    [
      frameSize.height,
      frameSize.width,
      naturalSize.height,
      naturalSize.width,
      scale,
    ],
  );

  const zoomTo = useCallback(
    (nextScale: number, focal: Point = { x: 0, y: 0 }) => {
      setScale(currentScale => {
        const clampedScale = clamp(nextScale, minScale, maxScale);
        const ratio = currentScale > 0 ? clampedScale / currentScale : 1;

        setPosition(currentPosition =>
          clampPosition(
            focal.x - (focal.x - currentPosition.x) * ratio,
            focal.y - (focal.y - currentPosition.y) * ratio,
            clampedScale,
          ),
        );

        return clampedScale;
      });
    },
    [clampPosition, maxScale, minScale],
  );

  useEffect(() => {
    setPosition(prev => clampPosition(prev.x, prev.y, scale));
  }, [clampPosition, scale]);

  const resetCrop = useCallback(() => {
    setScale(minScale);
    setPosition({ x: 0, y: 0 });
  }, [minScale]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (loading) return;
        onCancel();
        return;
      }
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomTo(scale * 1.1);
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        zoomTo(scale * 0.9);
      }
      if (event.key === '0') {
        event.preventDefault();
        resetCrop();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loading, onCancel, open, resetCrop, scale, zoomTo]);

  const startPinchGesture = (element: HTMLDivElement) => {
    const points = Array.from(pointersRef.current.values()).slice(0, 2);
    if (points.length < 2) return;
    const startMid = midpoint(points[0]!, points[1]!);
    gestureRef.current = {
      mode: 'pinch',
      origin: position,
      startDistance: Math.max(1, distance(points[0]!, points[1]!)),
      startFocal: getFramePoint(element, startMid),
      startScale: scale,
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!open) return;
    event.preventDefault();
    const element = event.currentTarget;
    const pointer = getClientPoint(event);
    pointersRef.current.set(event.pointerId, pointer);
    element.setPointerCapture(event.pointerId);

    if (pointersRef.current.size >= 2) {
      startPinchGesture(element);
      return;
    }

    gestureRef.current = {
      mode: 'drag',
      origin: position,
      pointerId: event.pointerId,
      start: pointer,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!gestureRef.current || !pointersRef.current.has(event.pointerId)) {
      return;
    }

    const pointer = getClientPoint(event);
    pointersRef.current.set(event.pointerId, pointer);
    const gesture = gestureRef.current;

    if (gesture.mode === 'pinch') {
      const points = Array.from(pointersRef.current.values()).slice(0, 2);
      if (points.length < 2) return;
      const nextMid = midpoint(points[0]!, points[1]!);
      const nextScale = clamp(
        gesture.startScale *
        (distance(points[0]!, points[1]!) / gesture.startDistance),
        minScale,
        maxScale,
      );
      const nextFocal = getFramePoint(event.currentTarget, nextMid);
      const ratio = nextScale / gesture.startScale;

      setScale(nextScale);
      setPosition(
        clampPosition(
          nextFocal.x - (gesture.startFocal.x - gesture.origin.x) * ratio,
          nextFocal.y - (gesture.startFocal.y - gesture.origin.y) * ratio,
          nextScale,
        ),
      );
      return;
    }

    if (gesture.pointerId !== event.pointerId) return;
    setPosition(
      clampPosition(
        gesture.origin.x + pointer.x - gesture.start.x,
        gesture.origin.y + pointer.y - gesture.start.y,
      ),
    );
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const remaining = Array.from(pointersRef.current.entries());
    if (remaining.length === 1) {
      const [pointerId, pointer] = remaining[0]!;
      gestureRef.current = {
        mode: 'drag',
        origin: position,
        pointerId,
        start: pointer,
      };
      return;
    }

    gestureRef.current = null;
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!open) return;
    event.preventDefault();
    const focal = getFramePoint(event.currentTarget, {
      x: event.clientX,
      y: event.clientY,
    });
    zoomTo(scale * (event.deltaY > 0 ? 0.92 : 1.08), focal);
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const focal = getFramePoint(event.currentTarget, {
      x: event.clientX,
      y: event.clientY,
    });
    zoomTo(scale > minScale * 1.25 ? minScale : minScale * 2.15, focal);
  };

  const handleFrameKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moveBy = event.shiftKey ? 24 : 10;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setPosition(prev => clampPosition(prev.x - moveBy, prev.y));
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setPosition(prev => clampPosition(prev.x + moveBy, prev.y));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setPosition(prev => clampPosition(prev.x, prev.y - moveBy));
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setPosition(prev => clampPosition(prev.x, prev.y + moveBy));
    }
  };

  const handleConfirm = async () => {
    if (loading || !imageRef.current || !naturalSize.width || !naturalSize.height) return;

    setError('');
    setLoading(true);
    try {
      const cropW = Math.min(naturalSize.width, frameSize.width / scale);
      const cropH = Math.min(naturalSize.height, frameSize.height / scale);
      const cropX = clamp(
        ((naturalSize.width * scale - frameSize.width) / 2 - position.x) /
        scale,
        0,
        Math.max(0, naturalSize.width - cropW),
      );
      const cropY = clamp(
        ((naturalSize.height * scale - frameSize.height) / 2 - position.y) /
        scale,
        0,
        Math.max(0, naturalSize.height - cropH),
      );
      const target = outputSize(maxOutputSize, aspect);
      const canvas = document.createElement('canvas');
      canvas.width = target.width;
      canvas.height = target.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        imageRef.current,
        cropX,
        cropY,
        cropW,
        cropH,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          result => {
            if (result) resolve(result);
            else reject(new Error('Gagal memproses gambar'));
          },
          'image/jpeg',
          shape === 'round' ? 0.9 : 0.88,
        );
      });

      await onConfirm(
        new File([blob], `profile-crop-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        }),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Gambar belum berhasil disimpan. Coba lagi.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (!open || !mounted) return null;

  const modal = (
    <div
      className="ui-layer-modal fixed inset-0 z-[1600] flex items-stretch justify-center overflow-hidden bg-slate-950/78 backdrop-blur-[3px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Tutup crop"
        onClick={onCancel}
        disabled={loading}
        tabIndex={-1}
        className="absolute inset-0 hidden cursor-default sm:block"
      />

      <div className="relative z-10 flex h-[100dvh] max-h-[100dvh] w-full min-w-0 flex-col overflow-hidden bg-[#090b0f] text-white shadow-2xl sm:h-[min(760px,calc(100dvh-2rem))] sm:max-w-[780px] sm:rounded-[26px] sm:ring-1 sm:ring-white/12">
        <header className="grid min-h-14 shrink-0 grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-2 border-b border-white/8 bg-[#090b0f]/94 px-[max(0.75rem,env(safe-area-inset-left))] pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] backdrop-blur-xl sm:min-h-16 sm:px-4 sm:py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="grid h-10 w-10 place-items-center rounded-full text-white/82 transition hover:bg-white/8 hover:text-white active:scale-95 disabled:opacity-40"
            aria-label="Batal"
          >
            <X className="h-5 w-5" />
          </button>

          <h3 className="truncate text-center text-[15px] font-bold tracking-[-0.01em] text-white sm:text-left sm:text-base">
            {title}
          </h3>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || !imageReady}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-emerald-500 px-4 text-xs font-extrabold text-white shadow-[0_10px_28px_-16px_rgba(16,185,129,0.9)] transition hover:bg-emerald-400 active:scale-[0.98] disabled:cursor-wait disabled:opacity-45 sm:min-h-10 sm:text-sm"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? 'Menyimpan' : 'Simpan'}
          </button>
        </header>

        <div
          ref={stageShellRef}
          className="relative grid min-h-0 flex-1 place-items-center overflow-hidden overscroll-none bg-[radial-gradient(circle_at_50%_36%,rgba(255,255,255,0.045),transparent_42%),#050609]"
        >
          <div
            className="relative select-none"
            style={{
              width: `${frameSize.width}px`,
              height: `${frameSize.height}px`,
              maxWidth: '100%',
              maxHeight: '100%',
            }}
          >
            <div
              tabIndex={0}
              autoFocus
              className={cn(
                'relative h-full w-full touch-none overflow-hidden bg-black outline-none ring-offset-2 ring-offset-black focus-visible:ring-2 focus-visible:ring-emerald-400',
                frameClass,
              )}
              onDoubleClick={handleDoubleClick}
              onKeyDown={handleFrameKeyDown}
              onPointerCancel={handlePointerUp}
              onPointerDown={handlePointerDown}
              onPointerLeave={event => {
                if (pointersRef.current.size <= 1) handlePointerUp(event);
              }}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onWheel={handleWheel}
              style={{ cursor: 'grab' }}
              aria-label="Area crop. Geser gambar untuk mengatur posisi."
            >
              {!imageReady ? (
                <div className="absolute inset-0 z-20 grid place-items-center text-white">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : null}

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Preview crop"
                className="absolute left-1/2 top-1/2 max-w-none select-none"
                draggable={false}
                onLoad={event => {
                  const image = event.currentTarget;
                  const nextNaturalSize = {
                    width: image.naturalWidth,
                    height: image.naturalHeight,
                  };
                  const nextMinScale = Math.max(
                    frameSize.width / nextNaturalSize.width,
                    frameSize.height / nextNaturalSize.height,
                  );

                  setNaturalSize(nextNaturalSize);
                  setScale(nextMinScale);
                  setPosition({ x: 0, y: 0 });
                  setImageReady(true);
                }}
                onError={() => {
                  setImageReady(false);
                  setError('Gambar tidak bisa dibuka. Pilih gambar lain.');
                }}
                style={{
                  transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  transformOrigin: 'center',
                  width: naturalSize.width ? `${naturalSize.width}px` : 'auto',
                  willChange: 'transform',
                }}
              />

              {shape !== 'round' ? (
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-25">
                  {Array.from({ length: 9 }).map((_, index) => (
                    <span key={index} className="border border-white/40" />
                  ))}
                </div>
              ) : null}
            </div>

            <div
              className={cn(
                'pointer-events-none absolute inset-0 ring-2 ring-white/95 shadow-[0_0_0_9999px_rgba(0,0,0,0.62)]',
                frameClass,
              )}
            />
          </div>

          <div className="pointer-events-none absolute bottom-3 left-1/2 max-w-[calc(100%-2rem)] -translate-x-1/2 truncate rounded-full bg-black/58 px-3 py-1.5 text-[10px] font-semibold text-white/78 ring-1 ring-white/8 backdrop-blur-md sm:bottom-4 sm:text-[11px]">
            Geser foto • cubit untuk zoom
          </div>
        </div>

        <footer className="shrink-0 border-t border-white/8 bg-[#090b0f]/96 px-[max(0.875rem,env(safe-area-inset-left))] pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:px-5 sm:pb-4 sm:pt-4">
          <div className="mx-auto flex w-full max-w-[560px] items-center gap-2.5 rounded-full bg-white/[0.055] px-2 py-1.5 ring-1 ring-white/8 sm:px-2.5">
            <CropIconButton
              label="Perkecil"
              disabled={!imageReady || loading || scale <= minScale + 0.0001}
              onClick={() => zoomTo(scale * 0.9)}
            >
              <Minus className="h-4 w-4" />
            </CropIconButton>

            <input
              type="range"
              min={minScale}
              max={maxScale}
              step={Math.max((maxScale - minScale) / 180, 0.0001)}
              value={scale}
              onChange={event => zoomTo(Number(event.target.value))}
              disabled={!imageReady || loading}
              className="min-w-0 flex-1 accent-emerald-500 disabled:opacity-40"
              aria-label={`Zoom ${zoomPercent}%`}
            />

            <CropIconButton
              label="Perbesar"
              disabled={!imageReady || loading || scale >= maxScale - 0.0001}
              onClick={() => zoomTo(scale * 1.1)}
            >
              <Plus className="h-4 w-4" />
            </CropIconButton>

            <button
              type="button"
              onClick={resetCrop}
              disabled={!imageReady || loading}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/58 transition hover:bg-white/8 hover:text-white active:scale-95 disabled:opacity-30"
              aria-label="Reset crop"
              title="Reset"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          {error ? (
            <p className="mx-auto mt-2 max-w-[560px] text-center text-[11px] font-semibold text-rose-300">
              {error}
            </p>
          ) : null}
        </footer>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function CropIconButton({
  children,
  label,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/72 transition hover:bg-white/8 hover:text-white active:scale-95 disabled:cursor-default disabled:opacity-30"
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}