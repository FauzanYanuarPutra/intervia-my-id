'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
      const maxWidth = Math.min(560, window.innerWidth - 32);
      let width = maxWidth;
      let height = width / aspect;
      const maxHeight = Math.min(420, window.innerHeight * 0.6);
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
  }, [
    frameSize.height,
    frameSize.width,
    naturalSize.height,
    naturalSize.width,
  ]);

  const maxScale = baseScale * 3;

  useEffect(() => {
    if (!open) return;
    setScale(baseScale);
    setPosition({ x: 0, y: 0 });
  }, [baseScale, open]);

  const clampPosition = (nextX: number, nextY: number, nextScale = scale) => {
    if (!naturalSize.width || !naturalSize.height) return { x: 0, y: 0 };
    const displayedWidth = naturalSize.width * nextScale;
    const displayedHeight = naturalSize.height * nextScale;
    const maxOffsetX = Math.max(0, (displayedWidth - frameSize.width) / 2);
    const maxOffsetY = Math.max(0, (displayedHeight - frameSize.height) / 2);
    return {
      x: clamp(nextX, -maxOffsetX, maxOffsetX),
      y: clamp(nextY, -maxOffsetY, maxOffsetY),
    };
  };

  useEffect(() => {
    setPosition(prev => clampPosition(prev.x, prev.y, scale));
  }, [
    frameSize.height,
    frameSize.width,
    naturalSize.height,
    naturalSize.width,
    scale,
  ]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
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

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId)
      return;
    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;
    const next = clampPosition(
      dragRef.current.originX + dx,
      dragRef.current.originY + dy,
    );
    setPosition(next);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId)
      return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleZoomChange = (value: number) => {
    const nextScale = clamp(value, baseScale, maxScale);
    setScale(nextScale);
    setPosition(prev => clampPosition(prev.x, prev.y, nextScale));
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[color:color-mix(in_srgb,_var(--app-overlay)_55%,_transparent)] p-4">
      <div className="max-h-[80svh] w-full max-w-lg overflow-y-auto rounded-3xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-[color:var(--app-text-soft)]">
              Crop
            </p>
            <h3 className="text-sm font-semibold text-[color:var(--app-text-soft)]">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-2 text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)]"
            aria-label="Close crop"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div
            className="relative"
            style={{ width: frameSize.width, height: frameSize.height }}
          >
            <div
              className={`relative h-full w-full overflow-hidden ${frameClass} bg-[color:var(--app-surface-muted)]`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
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
            </div>

            <div
              className={`pointer-events-none absolute inset-0 ${frameClass} ring-2 ring-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]`}
            />
          </div>

          <div className="w-full">
            <div className="flex items-center gap-3">
              <span className="text-xs text-[color:var(--app-text-soft)]">
                Zoom
              </span>
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
            <p className="mt-2 text-[11px] text-[color:var(--app-text-soft)]">
              Geser gambar untuk menentukan area crop.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-[color:var(--app-border-strong)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)]"
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
  );
}
