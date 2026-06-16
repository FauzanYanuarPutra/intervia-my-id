'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent, WheelEvent } from 'react';
import { Loader2, X } from 'lucide-react';

type CropTargetShape = 'round' | 'rect';

type ImageCropModalProps = {
  open: boolean;
  imageSrc: string;
  aspect: number;
  maxOutputSize?: number;
  title?: string;
  shape?: CropTargetShape;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

type Size = {
  width: number;
  height: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

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
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    pointerId: number;
  } | null>(null);

  const [frameSize, setFrameSize] = useState<Size>({
    width: 320,
    height: 320 / aspect,
  });
  const [naturalSize, setNaturalSize] = useState<Size>({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const updateFrame = () => {
      const maxWidth = Math.min(720, Math.max(280, window.innerWidth - 24));
      let width = maxWidth;
      let height = width / aspect;
      const maxHeight = Math.min(520, Math.max(240, window.innerHeight * 0.56));
      if (height > maxHeight) {
        height = maxHeight;
        width = height * aspect;
      }
      setFrameSize({ width, height });
    };
    updateFrame();
    window.addEventListener('resize', updateFrame);
    return () => window.removeEventListener('resize', updateFrame);
  }, [aspect, open]);

  const baseScale = useMemo(() => {
    if (!naturalSize.width || !naturalSize.height) return 1;
    return Math.max(
      frameSize.width / naturalSize.width,
      frameSize.height / naturalSize.height,
    );
  }, [frameSize.height, frameSize.width, naturalSize.height, naturalSize.width]);

  const maxScale = baseScale * 3;
  const zoomPercent = Math.round(
    ((scale - baseScale) / Math.max(maxScale - baseScale, 0.001)) * 100,
  );

  useEffect(() => {
    if (!open) return;
    setScale(baseScale);
    setPosition({ x: 0, y: 0 });
  }, [baseScale, open]);

  const clampPosition = useCallback(
    (nextX: number, nextY: number, nextScale = scale) => {
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
    [frameSize.height, frameSize.width, naturalSize.height, naturalSize.width, scale],
  );

  useEffect(() => {
    setPosition(prev => clampPosition(prev.x, prev.y, scale));
  }, [clampPosition, scale]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!open) return;
    event.preventDefault();
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      pointerId: event.pointerId,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;
    const next = clampPosition(
      dragRef.current.originX + dx,
      dragRef.current.originY + dy,
    );
    setPosition(next);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleZoomChange = (value: number) => {
    const nextScale = clamp(value, baseScale, maxScale);
    setScale(nextScale);
    setPosition(prev => clampPosition(prev.x, prev.y, nextScale));
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!open) return;
    event.preventDefault();
    const step = event.deltaY > 0 ? -0.045 : 0.045;
    handleZoomChange(scale + step * maxScale);
  };

  const handleConfirm = async () => {
    if (!imageRef.current || !naturalSize.width || !naturalSize.height) return;
    setLoading(true);
    try {
      const displayedWidth = naturalSize.width * scale;
      const displayedHeight = naturalSize.height * scale;
      const cropX =
        ((displayedWidth - frameSize.width) / 2 - position.x) / scale;
      const cropY =
        ((displayedHeight - frameSize.height) / 2 - position.y) / scale;
      const cropW = frameSize.width / scale;
      const cropH = frameSize.height / scale;
      const outputWidth = Math.min(maxOutputSize, cropW);
      const outputHeight = Math.round(outputWidth / aspect);

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(outputWidth));
      canvas.height = Math.max(1, Math.floor(outputHeight));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');

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
          0.92,
        );
      });

      const file = new File([blob], `crop-${Date.now()}.jpg`, {
        type: 'image/jpeg',
      });
      onConfirm(file);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const frameClass = shape === 'round' ? 'rounded-full' : 'rounded-2xl';

  return (
    <div className="ui-layer-modal fixed inset-0 z-[1400] flex items-end justify-center bg-[color:color-mix(in_srgb,_var(--app-overlay)_62%,_transparent)] p-2 backdrop-blur-md sm:items-center sm:p-4">
      <div className="flex max-h-[95svh] w-full max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-[24px] border border-white/15 bg-[color:var(--app-surface-strong)] shadow-[0_24px_90px_-30px_rgba(0,0,0,0.55)] sm:max-w-[920px] sm:rounded-[30px]">
        <div className="border-b border-[color:var(--app-border)] px-3 pb-3 pt-3 sm:px-5">
          <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-[color:var(--app-surface-muted)]" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
                {shape === 'round' ? 'Foto profil' : 'Cover image'}
              </p>
              <h3 className="mt-1 truncate text-lg font-black text-[color:var(--app-text)]">
                {title}
              </h3>
              <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                Geser gambar, zoom pakai slider atau scroll mouse di area crop.
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-muted)]/80"
              aria-label="Close crop"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_300px] sm:gap-4 sm:p-4">
          <div className="min-h-0 space-y-3">
            <div className="overflow-hidden rounded-[22px] border border-[color:var(--app-border)] bg-black/5 p-2 sm:rounded-[28px]">
              <div
                className="relative mx-auto select-none touch-none"
                style={{
                  width: 'min(100%, 100%)',
                  maxWidth: `${frameSize.width}px`,
                  height: `${frameSize.height}px`,
                }}
              >
                <div
                  className={`relative h-full w-full overflow-hidden ${frameClass} bg-[linear-gradient(135deg,rgba(15,23,42,0.06),rgba(15,23,42,0.12))]`}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  onWheel={handleWheel}
                  style={{ touchAction: 'none', cursor: 'grab' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imageRef}
                    src={imageSrc}
                    alt="Crop preview"
                    onLoad={event => {
                      const img = event.currentTarget;
                      setNaturalSize({
                        width: img.naturalWidth,
                        height: img.naturalHeight,
                      });
                    }}
                    className="absolute left-1/2 top-1/2 select-none"
                    style={{
                      transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    }}
                    draggable={false}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.16),transparent_18%,transparent_82%,rgba(0,0,0,0.12))]" />
                </div>

                <div
                  className={`pointer-events-none absolute inset-0 ${frameClass} ring-2 ring-white/75 shadow-[0_0_0_9999px_rgba(2,6,23,0.56)]`}
                />
              </div>
            </div>

            <p className="text-xs text-[color:var(--app-text-soft)]">
              Drag image untuk geser crop. Scroll mouse di area crop juga bisa zoom.
            </p>
          </div>

          <div className="space-y-4 rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 sm:rounded-[24px] sm:p-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                  Zoom
                </span>
                <span className="text-xs font-black text-[color:var(--app-text)]">
                  {Math.max(0, zoomPercent)}%
                </span>
              </div>
              <input
                type="range"
                min={baseScale}
                max={maxScale}
                step={0.01}
                value={scale}
                onChange={e => handleZoomChange(Number(e.target.value))}
                className="w-full accent-[color:var(--app-accent)]"
              />
            </div>

            <div className="rounded-[20px] bg-white/60 p-3 text-xs leading-6 text-[color:var(--app-text)]">
              <p className="font-bold text-[color:var(--app-text)]">Tips cepat</p>
              <ul className="mt-2 space-y-1.5">
                <li>- Geser gambar untuk pasin wajah atau logo di tengah.</li>
                <li>- Zoom sedikit kalau crop terlalu longgar.</li>
                <li>- Avatar lebih enak kalau objeknya agak di tengah.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-1">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full border border-[color:var(--app-border-strong)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text-soft)] hover:bg-white/60"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)] disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Simpan Crop
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
