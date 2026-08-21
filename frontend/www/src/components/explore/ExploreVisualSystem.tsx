'use client';

import type { ReactNode } from 'react';
import useEmblaCarousel from 'embla-carousel-react';

import { useEmblaWheelGestures } from '@/components/common/useEmblaWheelGestures';
import { cn } from '@/lib/utils';

export function useExploreEmblaRail({
  containScroll = 'trimSnaps',
  dragFree = true,
  skipSnaps = true,
}: {
  containScroll?: 'trimSnaps' | 'keepSnaps';
  dragFree?: boolean;
  skipSnaps?: boolean;
} = {}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll,
    dragFree,
    skipSnaps,
  });

  useEmblaWheelGestures(emblaApi);

  return { emblaRef, emblaApi };
}

export type ExploreVisualId =
  | 'equipment'
  | 'supplies'
  | 'service'
  | 'property'
  | 'opportunity'
  | 'community'
  | 'video'
  | 'people'
  | 'map';

export type ExploreArtworkVariant = 'category' | 'avatar' | 'bare';

type ExploreVisualConfig = {
  shell: string;
  flip?: boolean;
  scale?: number;
  rotate?: number;
  offsetX?: number;
  offsetY?: number;
  imageSize?: number;
};

/**
 * Satu sumber visual untuk seluruh Explore.
 *
 * Prinsipnya sengaja lebih tenang dari Home:
 * - plate kecil hanya menjadi anchor;
 * - artwork boleh keluar sedikit dari plate;
 * - spill diarahkan ke kiri/atas supaya tidak menabrak teks;
 * - tidak ada clipping pada visual system ini;
 * - ukuran per kategori dibatasi agar konsisten.
 */
export const EXPLORE_VISUALS: Record<ExploreVisualId, ExploreVisualConfig> = {
  equipment: {
    shell:
      'border-emerald-200/75 bg-emerald-50/80 dark:border-emerald-900/70 dark:bg-emerald-950/30',
    flip: true,
    scale: 1.2,
    rotate: -4,
    offsetX: 12,
    offsetY: 12,
    imageSize: 54,
  },
  supplies: {
    shell:
      'border-orange-200/75 bg-orange-50/80 dark:border-orange-900/70 dark:bg-orange-950/30',
    flip: true,
    scale: 1.2,
    rotate: -4,
    offsetX: 12,
    offsetY: 12,
    imageSize: 54,
  },
  service: {
    shell:
      'border-violet-200/75 bg-violet-50/80 dark:border-violet-900/70 dark:bg-violet-950/30',
    flip: true,
    scale:  1.05,
    rotate: -4,
    offsetX: 12,
    offsetY: 12,
    imageSize: 54,
  },
  property: {
    shell:
      'border-rose-200/75 bg-rose-50/80 dark:border-rose-900/70 dark:bg-rose-950/30',
    scale:  1.05,
    rotate: 4,
    offsetX: 12,
    offsetY: 12,
    imageSize: 54,
  },
  opportunity: {
    shell:
      'border-cyan-200/75 bg-cyan-50/80 dark:border-cyan-900/70 dark:bg-cyan-950/30',
    scale:  1.05,
    rotate: 4,
    offsetX: 12,
    offsetY: 12,
    imageSize: 53,
  },
  community: {
    shell:
      'border-amber-200/75 bg-amber-50/80 dark:border-amber-900/70 dark:bg-amber-950/30',
    scale:  1.05,
    rotate: 4,
    offsetX: 12,
    offsetY: 12,
    imageSize: 52,
  },
  video: {
    shell:
      'border-lime-200/75 bg-lime-50/80 dark:border-lime-900/70 dark:bg-lime-950/30',
    scale:  1.05,
    rotate: 4,
    offsetX: 12,
    offsetY: 12,
    imageSize: 52,
  },
  people: {
    shell:
      'border-transparent bg-transparent dark:border-transparent dark:bg-transparent',
    scale:  1.05,
    rotate: -4,
    offsetX: 12,
    offsetY: 12,
    imageSize: 58,
  },
  map: {
    shell:
      'border-sky-200/75 bg-sky-50/80 dark:border-sky-900/70 dark:bg-sky-950/30',
    scale:  1.05,
    rotate: 4,
    offsetX: 12,
    offsetY: 12,
    imageSize: 52,
  },
};

export function exploreVisualId(value: string): ExploreVisualId {
  return value in EXPLORE_VISUALS ? (value as ExploreVisualId) : 'supplies';
}

/**
 * Avatar Lajukan adalah SVG data URL. Helper ini menghapus layer dekoratif
 * bawaan avatar tanpa menyentuh body/face/outfit. Kalau format SVG berubah,
 * URL asli dikembalikan agar tidak merusak avatar.
 */
export function stripLajukanAvatarBackground(dataUrl: string): string {
  if (!/^data:image\/svg\+xml/i.test(dataUrl)) return dataUrl;

  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) return dataUrl;

  const prefix = dataUrl.slice(0, commaIndex + 1);
  const encodedSvg = dataUrl.slice(commaIndex + 1);

  try {
    let svg = decodeURIComponent(encodedSvg);
    const original = svg;

    svg = svg
      .replace(/\sclip-path="url\(#avatarClip\)"/g, '')
      .replace(/<linearGradient id="avatarBg"[\s\S]*?<\/linearGradient>/, '')
      .replace(/<radialGradient id="avatarSpot"[\s\S]*?<\/radialGradient>/, '')
      .replace(/<clipPath id="avatarClip"[\s\S]*?<\/clipPath>/, '');

    svg = svg.replace(
      /(<g class="avatar2d[^>]*>)[\s\S]*?(?=<ellipse cx="128" cy="228"[^>]*\/>|<g class="avatar-body")/,
      '$1',
    );

    if (svg === original) return dataUrl;
    return `${prefix}${encodeURIComponent(svg)}`;
  } catch {
    return dataUrl;
  }
}

export function ExploreArtwork({
  src,
  alt,
  visualId,
  size = 'md',
  badge,
  active = false,
  muted = false,
  variant = 'category',
  className,
}: {
  src: string;
  alt: string;
  visualId: ExploreVisualId | string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  badge?: string;
  active?: boolean;
  muted?: boolean;
  variant?: ExploreArtworkVariant;
  className?: string;
}) {
  const config = EXPLORE_VISUALS[exploreVisualId(visualId)];
  const dimensions = {
    xs: { shell: 'h-10 w-10 rounded-xl', ratio: 0.72 },
    sm: { shell: 'h-12 w-12 rounded-[14px]', ratio: 0.86 },
    md: { shell: 'h-14 w-14 rounded-[16px]', ratio: 1 },
    lg: { shell: 'h-[68px] w-[68px] rounded-[18px]', ratio: 1.18 },
    xl: { shell: 'h-[88px] w-[88px] rounded-[20px] sm:h-24 sm:w-24', ratio: 1.42 },
  }[size];

  const isAvatar = variant === 'avatar';
  const isBare = variant === 'bare';
  const transparent = isAvatar || isBare;
  const width = (config.imageSize ?? 58) * dimensions.ratio * (isAvatar ? 1.04 : 1);
  const offsetX = (config.offsetX ?? -5) * dimensions.ratio;
  const offsetY = (config.offsetY ?? -6) * dimensions.ratio;

  return (
    <span
      className={cn(
        'group/art relative z-0 flex shrink-0 items-center justify-center border transition-colors',
        dimensions.shell,
        transparent
          ? 'border-transparent bg-transparent shadow-none'
          : muted
            ? 'border-zinc-200 bg-zinc-50 shadow-none dark:border-zinc-800 dark:bg-zinc-900'
            : cn(
                config.shell,
                'shadow-[0_10px_22px_-22px_rgba(15,23,42,0.42)]',
              ),
        active &&
          'border-zinc-950 bg-zinc-950 ring-2 ring-emerald-500/25 ring-offset-2 ring-offset-white dark:border-white dark:bg-white dark:ring-offset-zinc-950',
        className,
      )}
    >
      {badge && !isAvatar ? (
        <span className="absolute left-1 top-1 z-20 max-w-[calc(100%-8px)] truncate rounded-full bg-zinc-950/90 px-1.5 py-0.5 text-[7px] font-bold text-white dark:bg-white/90 dark:text-zinc-950">
          {badge}
        </span>
      ) : null}

      <span
        className="pointer-events-none absolute z-10 aspect-square select-none"
        style={{
          width,
          left: offsetX,
          top: offsetY,
          transform: `scaleX(${config.flip && !isAvatar ? -1 : 1}) scale(${isAvatar ? 1 : config.scale ?? 1}) rotate(${isAvatar ? 0 : config.rotate ?? 0}deg)`,
          transformOrigin: 'center',
        }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className={cn(
            'h-full w-full object-contain transition-transform duration-200',
            isAvatar
              ? 'drop-shadow-[0_9px_9px_rgba(15,23,42,0.10)] group-hover/art:scale-[1.015]'
              : cn(
                  muted ? 'opacity-100' : 'opacity-100',
                  'group-hover/art:scale-[1.025]',
                ),
          )}
        />
      </span>
    </span>
  );
}

export function ExploreSurface({
  children,
  className,
  elevated = false,
}: {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
}) {
  return (
    <section
      className={cn(
        'rounded-[18px] border border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-[22px]',
        elevated
          ? 'shadow-[0_18px_42px_-36px_rgba(15,23,42,0.42)]'
          : 'shadow-[0_8px_24px_-24px_rgba(15,23,42,0.24)]',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function ExploreModeTabs<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  value: T;
  options: Array<{ value: T; label: string; hint?: string }>;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'grid min-w-0 gap-1.5 rounded-[14px] border border-zinc-200 bg-zinc-50 p-1.5 dark:border-zinc-800 dark:bg-zinc-900/75',
        options.length <= 2
          ? 'grid-cols-2'
          : 'grid-cols-2 lg:grid-cols-4',
        className,
      )}
    >
      {options.map(option => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active ? true : undefined}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-11 min-w-0 rounded-[11px] px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25 sm:px-3',
              active
                ? 'bg-zinc-950 text-white shadow-sm dark:bg-white dark:text-zinc-950'
                : 'bg-transparent text-zinc-500 shadow-none ring-0 hover:bg-white hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white',
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full',
                  active ? 'bg-emerald-400 dark:bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700',
                )}
              />
              <span className="min-w-0 text-[11px] font-bold leading-4 sm:text-xs">
                {option.label}
              </span>
            </span>
            {option.hint ? (
              <span className="mt-0.5 hidden pl-4 text-[9px] font-medium leading-3.5 text-zinc-400 sm:block sm:text-[10px]">
                {option.hint}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function ExploreSectionHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 sm:text-[11px]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-0.5 text-sm font-bold tracking-[-0.02em] text-zinc-950 dark:text-zinc-50 sm:text-base">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-[11px] font-medium leading-[1.55] text-zinc-500 dark:text-zinc-400 sm:text-xs">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}