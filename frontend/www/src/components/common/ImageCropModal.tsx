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
import { Loader2, Minus, Move, Plus, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/utils';

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

const MIN_FRAME_SIZE = 220;

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
  const imageRef = useRef<HTMLImageElement | null>(null);
  const stageShellRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
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
      const shellWidth =
        stageShellRef.current?.clientWidth || Math.max(260, window.innerWidth);
      const desktop = window.innerWidth >= 640;
      const availableWidth = Math.max(240, shellWidth - (desktop ? 8 : 0));
      const maxFrameWidth = Math.min(desktop ? 640 : 520, availableWidth);
      const reservedHeight = desktop ? 250 : 320;
      const maxFrameHeight = Math.max(
        MIN_FRAME_SIZE,
        Math.min(desktop ? 620 : 520, window.innerHeight - reservedHeight),
      );

      let width = maxFrameWidth;
      let height = width / aspect;
      if (height > maxFrameHeight) {
        height = maxFrameHeight;
        width = height * aspect;
      }

      const next = {
        width: Math.max(MIN_FRAME_SIZE, Math.floor(width)),
        height: Math.max(MIN_FRAME_SIZE / aspect, Math.floor(height)),
      };

      setFrameSize(prev =>
        Math.abs(prev.width - next.width) > 1 ||
        Math.abs(prev.height - next.height) > 1
          ? next
          : prev,
      );
    };

    updateFrame();
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
  }, [onCancel, open, resetCrop, scale, zoomTo]);

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
    if (!imageRef.current || !naturalSize.width || !naturalSize.height) return;

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
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="ui-layer-modal fixed inset-0 z-[1400] flex items-end justify-center bg-[color:color-mix(in_srgb,_var(--app-overlay)_68%,_transparent)] p-2 backdrop-blur-md sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex max-h-[96svh] w-full max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-[26px] border border-white/15 bg-[color:var(--app-surface-strong)] shadow-[0_24px_90px_-30px_rgba(0,0,0,0.55)] sm:max-w-[1040px] sm:rounded-[32px]">
        <div className="shrink-0 border-b border-[color:var(--app-border)] px-3 pb-3 pt-3 sm:px-5">
          <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-[color:var(--app-surface-muted)] sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
                {shape === 'round' ? 'Foto profil' : 'Cover image'}
              </p>
              <h3 className="mt-1 truncate text-lg font-black text-[color:var(--app-text)] sm:text-xl">
                {title}
              </h3>
              <p className="mt-1 max-w-2xl text-xs font-semibold leading-5 text-[color:var(--app-text-soft)] sm:text-sm">
                Geser gambar, pinch dua jari, pakai tombol, atau scroll mouse
                untuk zoom.
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] transition hover:bg-[color:color-mix(in_srgb,var(--app-surface-muted)_82%,var(--app-text)_8%)]"
              aria-label="Close crop"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_310px] lg:gap-4">
            <div ref={stageShellRef} className="min-w-0">
              <div className="overflow-hidden rounded-[24px] border border-[color:var(--app-border)] bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.2),transparent_28%),linear-gradient(135deg,rgba(2,6,23,0.92),rgba(15,23,42,0.78))] p-2 shadow-inner sm:rounded-[30px] sm:p-3">
                <div
                  ref={frameRef}
                  className="relative mx-auto select-none"
                  style={{
                    width: `${frameSize.width}px`,
                    height: `${frameSize.height}px`,
                    maxWidth: '100%',
                  }}
                >
                  <div
                    tabIndex={0}
                    className={cn(
                      'relative h-full w-full touch-none overflow-hidden bg-slate-950 outline-none ring-offset-2 ring-offset-slate-950 focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]',
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
                  >
                    {!imageReady ? (
                      <div className="absolute inset-0 grid place-items-center text-white">
                        <Loader2 className="h-7 w-7 animate-spin" />
                      </div>
                    ) : null}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      ref={imageRef}
                      src={imageSrc}
                      alt="Crop preview"
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
                      style={{
                        transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        transformOrigin: 'center',
                        width: naturalSize.width
                          ? `${naturalSize.width}px`
                          : 'auto',
                        willChange: 'transform',
                      }}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.16),transparent_20%,transparent_80%,rgba(0,0,0,0.20))]" />
                    <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-50">
                      {Array.from({ length: 9 }).map((_, index) => (
                        <span key={index} className="border border-white/28" />
                      ))}
                    </div>
                    <div className="pointer-events-none absolute inset-0 grid place-items-center text-white/80">
                      <Move className="h-6 w-6 drop-shadow" />
                    </div>
                  </div>

                  <div
                    className={cn(
                      'pointer-events-none absolute inset-0 ring-2 ring-white/90 shadow-[0_0_0_9999px_rgba(2,6,23,0.52)]',
                      frameClass,
                    )}
                  />
                </div>
              </div>
            </div>

            <aside className="space-y-3 rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 sm:p-4">
              <div className="rounded-[20px] bg-[color:var(--app-surface-strong)] p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                    Zoom
                  </span>
                  <span className="rounded-full bg-[color:var(--app-accent-soft)] px-2.5 py-1 text-xs font-black text-[color:var(--app-accent)]">
                    {zoomPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min={minScale}
                  max={maxScale}
                  step={(maxScale - minScale) / 160}
                  value={scale}
                  onChange={event => zoomTo(Number(event.target.value))}
                  className="w-full accent-[color:var(--app-accent)]"
                  aria-label="Zoom crop"
                />
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <CropToolButton
                    label="Zoom out"
                    onClick={() => zoomTo(scale * 0.88)}
                  >
                    <Minus className="h-4 w-4" />
                  </CropToolButton>
                  <CropToolButton label="Reset" onClick={resetCrop}>
                    <RotateCcw className="h-4 w-4" />
                  </CropToolButton>
                  <CropToolButton
                    label="Zoom in"
                    onClick={() => zoomTo(scale * 1.12)}
                  >
                    <Plus className="h-4 w-4" />
                  </CropToolButton>
                </div>
              </div>

              <div className="rounded-[20px] bg-[color:var(--app-surface-strong)] p-3 text-xs font-semibold leading-6 text-[color:var(--app-text)] shadow-sm">
                <p className="font-black text-[color:var(--app-text)]">
                  Tips crop cepat
                </p>
                <p className="mt-2 text-[color:var(--app-text-soft)]">
                  Untuk foto profil, posisikan wajah/logo sedikit di tengah dan
                  sisakan ruang tipis di atas kepala. Di HP bisa pinch dua jari.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-full border border-[color:var(--app-border-strong)] px-4 py-2 text-xs font-black text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-strong)]"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={loading || !imageReady}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-xs font-black text-[color:var(--app-text-inverse)] transition hover:bg-[color:var(--app-accent-strong)] disabled:cursor-wait disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Simpan Crop
                </button>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function CropToolButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)]"
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
