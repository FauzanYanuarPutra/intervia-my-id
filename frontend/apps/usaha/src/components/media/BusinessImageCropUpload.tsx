'use client';

import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { Check, Crop, ImagePlus, LoaderCircle, Move, RotateCcw, X } from 'lucide-react';
import {
  computeCoverCrop,
  dragCropPosition,
  mediaCropPreset,
  type BusinessImageValue,
  type BusinessMediaKind,
} from '@/lib/media-crop';

type Props = {
  businessId: string;
  kind: BusinessMediaKind;
  currentUrl?: string;
  productId?: string;
  label?: string;
  description?: string;
  onUploaded?: (media: BusinessImageValue) => void;
};

type DragState = {
  pointerId: number;
  lastX: number;
  lastY: number;
  horizontal: number;
  vertical: number;
};

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Foto tidak bisa dibaca.'));
    image.src = url;
  });
}

export function BusinessImageCropUpload({
  businessId,
  kind,
  currentUrl,
  productId,
  label,
  description,
  onUploaded,
}: Props) {
  const preset = mediaCropPreset(kind);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [source, setSource] = useState<{ image: HTMLImageElement; url: string; name: string } | null>(null);
  const [previewOverride, setPreviewOverride] = useState<{ sourceUrl?: string; url: string } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [horizontal, setHorizontal] = useState(0);
  const [vertical, setVertical] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const previewUrl = previewOverride && previewOverride.sourceUrl === currentUrl
    ? previewOverride.url
    : currentUrl ?? '';

  useEffect(() => {
    if (!source || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = preset.width;
    canvas.height = preset.height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return;
    const crop = computeCoverCrop(
      source.image.naturalWidth,
      source.image.naturalHeight,
      preset.aspect,
      zoom,
      horizontal,
      vertical,
    );
    context.fillStyle = '#f2f4ef';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      source.image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  }, [horizontal, preset, source, vertical, zoom]);

  useEffect(() => {
    if (!source) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [source]);

  useEffect(() => {
    return () => {
      if (source) URL.revokeObjectURL(source.url);
    };
  }, [source]);

  function resetCrop() {
    dragRef.current = null;
    setIsDragging(false);
    setZoom(1);
    setHorizontal(0);
    setVertical(0);
  }

  function closeCrop() {
    setSource(null);
    resetCrop();
    if (inputRef.current) inputRef.current.value = '';
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setSuccess('');
    if (!ACCEPTED_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_SOURCE_BYTES) {
      setError('Pilih foto JPG, PNG, atau WebP dengan ukuran maksimal 12 MB.');
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url);
      if (image.naturalWidth < 320 || image.naturalHeight < 320) {
        URL.revokeObjectURL(url);
        setError('Resolusi foto terlalu kecil. Gunakan minimal 320 × 320 piksel.');
        return;
      }
      setSource({ image, url, name: file.name });
      resetCrop();
    } catch (value) {
      URL.revokeObjectURL(url);
      setError(value instanceof Error ? value.message : 'Foto tidak bisa dibaca.');
    }
  }

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    if (!source || isUploading || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      horizontal,
      vertical,
    };
    setIsDragging(true);
  }

  function continueDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!source || !drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const next = dragCropPosition({
      sourceWidth: source.image.naturalWidth,
      sourceHeight: source.image.naturalHeight,
      targetAspect: preset.aspect,
      zoom,
      horizontalPosition: drag.horizontal,
      verticalPosition: drag.vertical,
      deltaX: event.clientX - drag.lastX,
      deltaY: event.clientY - drag.lastY,
      viewportWidth: bounds.width,
      viewportHeight: bounds.height,
    });
    dragRef.current = {
      ...drag,
      lastX: event.clientX,
      lastY: event.clientY,
      horizontal: next.horizontal,
      vertical: next.vertical,
    };
    setHorizontal(next.horizontal);
    setVertical(next.vertical);
  }

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setIsDragging(false);
  }

  async function saveCrop() {
    const canvas = canvasRef.current;
    if (!canvas || !source) return;
    setIsUploading(true);
    setError('');
    setSuccess('');
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          value => value ? resolve(value) : reject(new Error('Hasil crop tidak bisa dibuat.')),
          'image/webp',
          0.9,
        );
      });
      const safeBaseName = source.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 48) || kind;
      const file = new File([blob], `${safeBaseName}-${kind}.webp`, { type: 'image/webp' });
      const body = new FormData();
      body.append('kind', kind);
      body.append('file', file);
      if (productId) body.append('productId', productId);

      const response = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/media`, {
        method: 'POST',
        body,
      });
      const result = (await response.json()) as { error?: string; media?: BusinessImageValue };
      if (!response.ok || !result.media) {
        throw new Error(result.error || 'Foto belum berhasil diunggah.');
      }
      setPreviewOverride({ sourceUrl: currentUrl, url: result.media.url });
      setSuccess(productId || kind !== 'product' ? 'Foto tersimpan.' : 'Foto siap disimpan bersama produk.');
      onUploaded?.(result.media);
      if (kind !== 'product' || productId) {
        startTransition(() => router.refresh());
      }
      closeCrop();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Foto belum berhasil diunggah.');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div>
        <p className="text-sm font-semibold text-portal-ink">{label ?? preset.label}</p>
        <p className="mt-1 text-xs leading-5 text-portal-soft">
          {description ?? `Hasil akhir ${preset.width} × ${preset.height} piksel.`}
        </p>
      </div>

      <div
        className={`relative overflow-hidden border border-dashed border-portal-line bg-[#f3f5f1] ${
          kind === 'banner' ? 'aspect-[8/3] rounded-2xl' : 'aspect-square max-w-[220px] rounded-2xl'
        }`}
      >
        {previewUrl ? (
          <div
            role="img"
            aria-label={label ?? preset.label}
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${JSON.stringify(previewUrl).slice(1, -1)})` }}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-center text-portal-soft">
            <div>
              <ImagePlus className="mx-auto h-7 w-7" />
              <p className="mt-2 text-xs font-semibold">Belum ada foto</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => inputRef.current?.click()} className="portal-button-secondary">
          <Crop className="h-4 w-4" /> {previewUrl ? 'Ganti & crop' : 'Pilih & crop foto'}
        </button>
        <span className="text-[11px] font-semibold text-portal-soft">JPG, PNG, WebP · maks. 12 MB</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={chooseFile}
        className="sr-only"
      />
      {error ? <p role="alert" className="text-sm text-portal-ember">{error}</p> : null}
      {success ? <p role="status" className="flex items-center gap-1.5 text-sm text-portal-forest"><Check className="h-4 w-4" />{success}</p> : null}

      {source ? (
        <div role="dialog" aria-modal="true" aria-label={`Crop ${label ?? preset.label}`} className="fixed inset-0 z-[100] grid place-items-center bg-black/65 p-0 sm:p-4">
          <div className="max-h-[100dvh] w-full overflow-y-auto bg-white p-4 shadow-2xl sm:max-h-[92vh] sm:max-w-3xl sm:rounded-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-portal-ink">Atur area foto</h2>
                <p className="mt-1 text-sm leading-5 text-portal-soft">
                  Geser foto langsung dengan jari atau mouse, lalu atur zoom. Area di dalam frame adalah hasil akhirnya.
                </p>
              </div>
              <button type="button" onClick={closeCrop} disabled={isUploading} className="rounded-lg p-2 text-portal-soft hover:bg-[#f4f5f2] disabled:opacity-50" aria-label="Tutup crop">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              onPointerDown={beginDrag}
              onPointerMove={continueDrag}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
              onLostPointerCapture={() => {
                dragRef.current = null;
                setIsDragging(false);
              }}
              className={`relative mt-5 touch-none select-none overflow-hidden bg-[#eef1eb] ring-2 ring-white outline outline-1 outline-black/15 ${
                isDragging ? 'cursor-grabbing' : 'cursor-grab'
              } ${kind === 'banner' ? 'aspect-[8/3] rounded-xl' : 'mx-auto aspect-square max-w-xl rounded-xl'}`}
              aria-label="Area crop interaktif. Geser foto untuk menentukan posisi."
            >
              <canvas ref={canvasRef} className="pointer-events-none h-full w-full" />
              <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                <span className="absolute inset-y-0 left-1/3 w-px bg-white/45 shadow-[0_0_1px_rgba(0,0,0,0.35)]" />
                <span className="absolute inset-y-0 left-2/3 w-px bg-white/45 shadow-[0_0_1px_rgba(0,0,0,0.35)]" />
                <span className="absolute inset-x-0 top-1/3 h-px bg-white/45 shadow-[0_0_1px_rgba(0,0,0,0.35)]" />
                <span className="absolute inset-x-0 top-2/3 h-px bg-white/45 shadow-[0_0_1px_rgba(0,0,0,0.35)]" />
              </div>
              <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                <Move className="h-3.5 w-3.5" /> Geser foto
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-portal-line bg-[#fafbf8] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-portal-ink">Preview {kind === 'banner' ? '8:3' : '1:1'}</p>
                  <p className="mt-0.5 text-[11px] text-portal-soft">Output {preset.width} × {preset.height} px · WebP</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => inputRef.current?.click()} disabled={isUploading} className="portal-button-secondary !px-3 !py-2 text-xs">
                    <ImagePlus className="h-4 w-4" /> Ganti gambar
                  </button>
                  <button type="button" onClick={resetCrop} disabled={isUploading} className="portal-button-secondary !px-3 !py-2 text-xs">
                    <RotateCcw className="h-4 w-4" /> Pusatkan ulang
                  </button>
                </div>
              </div>

              <label className="mt-4 grid gap-2 text-xs font-semibold text-portal-ink">
                <span className="flex items-center justify-between gap-3">
                  <span>Zoom</span>
                  <span className="tabular-nums text-portal-soft">{Math.round(zoom * 100)}%</span>
                </span>
                <input
                  type="range"
                  min="1"
                  max="4"
                  step="0.01"
                  value={zoom}
                  disabled={isUploading}
                  onChange={event => setZoom(Number(event.target.value))}
                  aria-label="Zoom foto"
                />
              </label>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-[11px] font-semibold text-portal-ink">
                  Posisi horizontal
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={horizontal}
                    disabled={isUploading}
                    onChange={event => setHorizontal(Number(event.target.value))}
                  />
                </label>
                <label className="grid gap-2 text-[11px] font-semibold text-portal-ink">
                  Posisi vertikal
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={vertical}
                    disabled={isUploading}
                    onChange={event => setVertical(Number(event.target.value))}
                  />
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 -mx-4 mt-5 flex flex-col-reverse gap-2 border-t border-portal-line bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
              <button type="button" onClick={closeCrop} disabled={isUploading} className="portal-button-secondary">Batal</button>
              <button type="button" onClick={saveCrop} disabled={isUploading} className="portal-button-primary">
                {isUploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {isUploading ? 'Mengunggah...' : 'Konfirmasi crop'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
