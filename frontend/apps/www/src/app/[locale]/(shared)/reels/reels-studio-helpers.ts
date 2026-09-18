import type { CSSProperties } from 'react';

import type { LajukanReel } from '../../_data/reels';

const REELS_VIDEO_EXTENSIONS = /\.(m4v|mov|mp4|webm)$/i;

export function isPlayableReelsVideoFile(file: File) {
  return (
    file.type.startsWith('video/') || REELS_VIDEO_EXTENSIONS.test(file.name)
  );
}

export function buildCleanReelTitleFromFile(file: File) {
  const cleaned = file.name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'Video usaha';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1, 90);
}

export const REELS_MUSIC_TRACKS = [
  'Original sound',
  'Beat UMKM',
  'Soft promo',
  'Live shop',
  'Packing ASMR',
];

export const REELS_STUDIO_SPEEDS = ['0,25x', '0,5x', '1x', '1,5x', '2x'] as const;
export const REELS_STUDIO_DURATIONS = ['15s', '30s', '60s', '90s'] as const;

export type ReelsStudioSpeed = (typeof REELS_STUDIO_SPEEDS)[number];
export type ReelsStudioDuration = (typeof REELS_STUDIO_DURATIONS)[number];
export type ReelsStudioEffect =
  | 'none'
  | 'clean'
  | 'product'
  | 'focus'
  | 'scan'
  | 'dog'
  | 'grain';

export const REEL_FILTER_PRESETS: Array<{
  id: NonNullable<LajukanReel['filterPreset']>;
  label: string;
  helper: string;
  css: string;
  swatch: string;
}> = [
  {
    id: 'natural',
    label: 'Asli',
    helper: 'warna normal',
    css: 'none',
    swatch: 'bg-gradient-to-br from-slate-100 via-white to-emerald-100',
  },
  {
    id: 'fresh',
    label: 'Fresh',
    helper: 'produk lebih segar',
    css: 'saturate(1.12) contrast(1.04) brightness(1.03)',
    swatch: 'bg-gradient-to-br from-emerald-200 via-teal-100 to-white',
  },
  {
    id: 'warm',
    label: 'Warm',
    helper: 'kuliner hangat',
    css: 'sepia(0.08) saturate(1.14) contrast(1.02) brightness(1.02)',
    swatch: 'bg-gradient-to-br from-amber-200 via-orange-100 to-white',
  },
  {
    id: 'pop',
    label: 'Pop',
    helper: 'promo mencolok',
    css: 'saturate(1.28) contrast(1.08)',
    swatch: 'bg-gradient-to-br from-rose-200 via-fuchsia-100 to-sky-100',
  },
  {
    id: 'cinema',
    label: 'Cinema',
    helper: 'lebih dramatis',
    css: 'contrast(1.12) saturate(0.94) brightness(0.96)',
    swatch: 'bg-gradient-to-br from-slate-900 via-slate-500 to-amber-100',
  },
  {
    id: 'mono',
    label: 'Mono',
    helper: 'hitam putih',
    css: 'grayscale(1) contrast(1.1)',
    swatch: 'bg-gradient-to-br from-slate-950 via-slate-400 to-white',
  },
];

export const REELS_STUDIO_EFFECTS: Array<{
  id: ReelsStudioEffect;
  label: string;
  helper: string;
  swatch: string;
}> = [
  {
    id: 'none',
    label: 'Original',
    helper: 'tanpa efek',
    swatch: 'bg-gradient-to-br from-white via-slate-100 to-slate-300',
  },
  {
    id: 'clean',
    label: 'Clean',
    helper: 'cahaya halus',
    swatch: 'bg-gradient-to-br from-white via-emerald-100 to-sky-100',
  },
  {
    id: 'product',
    label: 'Product',
    helper: 'produk pop',
    swatch: 'bg-gradient-to-br from-yellow-200 via-white to-rose-200',
  },
  {
    id: 'focus',
    label: 'Focus',
    helper: 'vignette',
    swatch: 'bg-gradient-to-br from-slate-950 via-slate-500 to-white',
  },
  {
    id: 'scan',
    label: 'Scan',
    helper: 'garis preview',
    swatch:
      'bg-[repeating-linear-gradient(180deg,#67e8f9_0_3px,#0f172a_3px_7px)]',
  },
  {
    id: 'dog',
    label: 'Dog',
    helper: 'kuping + hidung',
    swatch:
      'bg-[radial-gradient(circle_at_30%_18%,#92400e_0_18%,transparent_19%),radial-gradient(circle_at_70%_18%,#92400e_0_18%,transparent_19%),radial-gradient(circle_at_50%_58%,#111827_0_16%,transparent_17%),#fef3c7]',
  },
  {
    id: 'grain',
    label: 'Grain',
    helper: 'tekstur halus',
    swatch:
      'bg-[radial-gradient(circle_at_30%_20%,#fef3c7,transparent_24%),radial-gradient(circle_at_70%_64%,#e879f9,transparent_22%),#111827]',
  },
];

export function getReelFilterCss(filterPreset?: string | null) {
  return (
    REEL_FILTER_PRESETS.find(item => item.id === filterPreset)?.css ?? 'none'
  );
}

export function getReelMediaStyle(
  filterPreset?: string | null,
): CSSProperties | undefined {
  const filter = getReelFilterCss(filterPreset);
  return filter === 'none' ? undefined : { filter };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function isStudioEffect(value: unknown): value is ReelsStudioEffect {
  return (
    typeof value === 'string' &&
    REELS_STUDIO_EFFECTS.some(effect => effect.id === value)
  );
}

export function getReelStudioEffect(reel: Pick<LajukanReel, 'metadata'>) {
  const metadata = reel.metadata;
  if (!isPlainRecord(metadata)) return 'none' as ReelsStudioEffect;

  const directEffect =
    metadata.cameraEffect || metadata.effect || metadata.studioEffect;
  if (isStudioEffect(directEffect)) return directEffect;

  const studio = metadata.studio;
  if (isPlainRecord(studio) && isStudioEffect(studio.effect)) {
    return studio.effect;
  }

  return 'none' as ReelsStudioEffect;
}

export function getStudioDurationMs(duration: ReelsStudioDuration) {
  const seconds = Number.parseInt(duration.replace(/\D/g, ''), 10);
  return Math.max(Number.isFinite(seconds) ? seconds : 15, 5) * 1000;
}

