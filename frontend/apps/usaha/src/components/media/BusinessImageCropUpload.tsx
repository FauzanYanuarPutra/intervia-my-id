'use client';

import { startTransition, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Crop, ImagePlus, LoaderCircle, X } from 'lucide-react';
import {
  computeCoverCrop,
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
  const [source, setSource] = useState<{ image: HTMLImageElement; url: string; name: string } | null>(null);
  const [previewOverride, setPreviewOverride] = useState<{ sourceUrl?: string; url: string } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [horizontal, setHorizontal] = useState(0);
  const [vertical, setVertical] = useState(0);
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

  function closeCrop() {
    if (source) URL.revokeObjectURL(source.url);
    setSource(null);
    setZoom(1);
    setHorizontal(0);
    setVertical(0);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setSuccess('');
    if (!ACCEPTED_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_SOURCE_BYTES) {
      setError('Pilih foto JPG, PNG, atau WebP dengan ukuran maksimal 12 MB.');
      event.target.value = '';
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url);
      if (image.naturalWidth < 320 || image.naturalHeight < 320) {
        URL.revokeObjectURL(url);
        setError('Resolusi foto terlalu kecil. Gunakan minimal 320 × 320 piksel.');
        event.target.value = '';
        return;
      }
      setSource({ image, url, name: file.name });
      setZoom(1);
      setHorizontal(0);
      setVertical(0);
    } catch (value) {
      URL.revokeObjectURL(url);
      setError(value instanceof Error ? value.message : 'Foto tidak bisa dibaca.');
    }
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
      {error ? <p className="text-sm text-portal-ember">{error}</p> : null}
      {success ? <p className="flex items-center gap-1.5 text-sm text-portal-forest"><Check className="h-4 w-4" />{success}</p> : null}

      {source ? (
        <div role="dialog" aria-modal="true" aria-label={`Crop ${label ?? preset.label}`} className="fixed inset-0 z-[100] grid place-items-center bg-black/65 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-portal-ink">Atur area foto</h2>
                <p className="mt-1 text-sm text-portal-soft">Preview dikunci ke rasio {kind === 'banner' ? '8:3' : '1:1'} agar tidak terpotong saat tampil.</p>
              </div>
              <button type="button" onClick={closeCrop} disabled={isUploading} className="rounded-lg p-2 text-portal-soft hover:bg-[#f4f5f2]" aria-label="Tutup crop">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className={`mt-5 overflow-hidden rounded-xl bg-[#eef1eb] ${kind === 'banner' ? 'aspect-[8/3]' : 'mx-auto aspect-square max-w-xl'}`}>
              <canvas ref={canvasRef} className="h-full w-full" />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <label className="grid gap-2 text-xs font-semibold text-portal-ink">Zoom
                <input type="range" min="1" max="4" step="0.01" value={zoom} onChange={event => setZoom(Number(event.target.value))} />
              </label>
              <label className="grid gap-2 text-xs font-semibold text-portal-ink">Geser kiri / kanan
                <input type="range" min="-1" max="1" step="0.01" value={horizontal} onChange={event => setHorizontal(Number(event.target.value))} />
              </label>
              <label className="grid gap-2 text-xs font-semibold text-portal-ink">Geser atas / bawah
                <input type="range" min="-1" max="1" step="0.01" value={vertical} onChange={event => setVertical(Number(event.target.value))} />
              </label>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeCrop} disabled={isUploading} className="portal-button-secondary">Batal</button>
              <button type="button" onClick={saveCrop} disabled={isUploading} className="portal-button-primary">
                {isUploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {isUploading ? 'Mengunggah...' : 'Gunakan foto ini'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
