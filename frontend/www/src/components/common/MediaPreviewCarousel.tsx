'use client';

import { useMemo, useRef, useState, useEffect, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Expand, PlayCircle, X } from 'lucide-react';
import { LajukanImage } from '@/components/common/LajukanImage';
import { cn } from '@/lib/utils';

export type MediaPreviewItem =
  | string
  | {
    src?: string | null;
    type?: 'image' | 'video';
    alt?: string;
  };

type MediaPreviewCarouselProps = {
  items: MediaPreviewItem[];
  alt: string;
  className?: string;
  viewportClassName?: string;
  mediaClassName?: string;
  aspectClassName?: string;
  sizes?: string;
  priority?: boolean;
  loading?: 'eager' | 'lazy';
  controls?: boolean;
  lightbox?: boolean;
  showCounter?: boolean;
  showDots?: boolean;
  objectFit?: 'cover' | 'contain';
  overlay?: ReactNode;
  initialIndex?: number; // Ditambahkan agar Lightbox sinkron dengan slide utama
};

type NormalizedMedia = {
  src: string;
  type: 'image' | 'video';
  alt: string;
};

function isVideoSrc(src: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(src);
}

function normalizeMediaItems(items: MediaPreviewItem[], alt: string) {
  const seen = new Set<string>();
  const result: NormalizedMedia[] = [];

  for (const item of items) {
    const raw =
      typeof item === 'string'
        ? item
        : typeof item?.src === 'string'
          ? item.src
          : '';
    const src = raw.trim();
    if (!src) continue;
    const key = src.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      src,
      type:
        typeof item === 'string'
          ? isVideoSrc(src)
            ? 'video'
            : 'image'
          : item.type || (isVideoSrc(src) ? 'video' : 'image'),
      alt: typeof item === 'string' ? alt : item.alt || alt,
    });
  }

  return result;
}

function clampIndex(index: number, length: number) {
  if (length <= 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}

export function MediaPreviewCarousel({
  items,
  alt,
  className,
  viewportClassName,
  mediaClassName,
  aspectClassName = 'aspect-[4/3]',
  sizes = '(max-width: 640px) 100vw, 520px',
  priority = false,
  loading,
  controls = false,
  lightbox = false,
  showCounter = true,
  showDots = true,
  objectFit = 'cover',
  overlay,
  initialIndex = 0,
}: MediaPreviewCarouselProps) {
  const mediaItems = useMemo(
    () => normalizeMediaItems(items, alt),
    [alt, items],
  );

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const isScrolling = useRef(false);

  const active = clampIndex(activeIndex, mediaItems.length);
  const hasMany = mediaItems.length > 1;

  // Sinkronisasi posisi scroll saat initialIndex berubah (terutama untuk Lightbox)
  useEffect(() => {
    if (initialIndex > 0) {
      scrollToIndex(initialIndex, 'instant');
    }
  }, [initialIndex]);

  const scrollToIndex = (nextIndex: number, behavior: ScrollBehavior = 'smooth') => {
    const next = clampIndex(nextIndex, mediaItems.length);
    setActiveIndex(next);

    const node = viewportRef.current;
    if (!node) return;

    isScrolling.current = true;
    node.scrollTo({
      left: node.clientWidth * next,
      behavior,
    });

    // Berikan jeda sejenak agar flag onScroll tidak tabrakan dengan animasi tombol
    setTimeout(() => {
      isScrolling.current = false;
    }, 300);
  };

  const updateIndexFromScroll = () => {
    if (isScrolling.current) return;
    const node = viewportRef.current;
    if (!node || !node.clientWidth) return;

    const next = clampIndex(
      Math.round(node.scrollLeft / node.clientWidth),
      mediaItems.length,
    );
    if (next !== activeIndex) setActiveIndex(next);
  };

  const renderMedia = (
    item: NormalizedMedia,
    index: number,
    inLightbox = false,
  ) => {
    const fitClass =
      objectFit === 'contain' || inLightbox ? 'object-contain' : 'object-cover';

    if (item.type === 'video') {
      return (
        <video
          src={item.src}
          className={cn('h-full w-full bg-slate-950', fitClass, mediaClassName)}
          controls={controls || inLightbox}
          muted={!inLightbox}
          playsInline
          preload="metadata"
        />
      );
    }

    return (
      <LajukanImage
        src={item.src}
        alt={item.alt}
        fill
        sizes={inLightbox ? '100vw' : sizes}
        priority={priority && index === 0}
        loading={priority && index === 0 ? undefined : loading}
        className={cn('h-full w-full select-none', fitClass, mediaClassName)}
      />
    );
  };

  return (
    <>
      <div
        className={cn(
          'group relative overflow-hidden bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-300 transition-colors duration-200',
          aspectClassName,
          className,
        )}
      >
        {mediaItems.length > 0 ? (
          <div
            ref={viewportRef}
            onScroll={updateIndexFromScroll}
            className={cn(
              'flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
              viewportClassName,
            )}
          >
            {mediaItems.map((item, index) => (
              <div
                key={`${item.src}-${index}`}
                className="relative h-full min-w-full snap-center overflow-hidden"
              >
                {renderMedia(item, index)}
                {item.type === 'video' ? (
                  <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md shadow-sm">
                    <PlayCircle className="h-3.5 w-3.5 text-white/90" />
                    Video
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <LajukanImage src={null} alt={alt} fill className="h-full w-full object-cover" />
        )}

        {overlay}

        {/* Counter Badge */}
        {mediaItems.length > 1 && showCounter ? (
          <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md shadow-sm select-none">
            {active + 1} / {mediaItems.length}
          </span>
        ) : null}

        {/* Lightbox Trigger Button */}
        {lightbox && mediaItems.length > 0 ? (
          <button
            type="button"
            onClick={event => {
              event.preventDefault();
              event.stopPropagation();
              setLightboxOpen(true);
            }}
            className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-md backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-white active:scale-95 dark:bg-slate-900/90 dark:text-white dark:hover:bg-slate-900"
            aria-label="Perbesar media"
          >
            <Expand className="h-4 w-4" />
          </button>
        ) : null}

        {/* Navigation Arrows (Hanya muncul/lebih jelas saat hover group di desktop) */}
        {controls && hasMany ? (
          <>
            <button
              type="button"
              disabled={active === 0}
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                scrollToIndex(active - 1);
              }}
              className={cn(
                "absolute left-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-md backdrop-blur-sm transition-all duration-200 hover:bg-white active:scale-95 dark:bg-slate-900/90 dark:text-white md:opacity-0 md:group-hover:opacity-100",
                active === 0 && "cursor-not-allowed opacity-40 md:group-hover:opacity-40"
              )}
              aria-label="Media sebelumnya"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              disabled={active === mediaItems.length - 1}
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                scrollToIndex(active + 1);
              }}
              className={cn(
                "absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-md backdrop-blur-sm transition-all duration-200 hover:bg-white active:scale-95 dark:bg-slate-900/90 dark:text-white md:opacity-0 md:group-hover:opacity-100",
                active === mediaItems.length - 1 && "cursor-not-allowed opacity-40 md:group-hover:opacity-40"
              )}
              aria-label="Media berikutnya"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}

        {/* Dynamic Indicator Dots */}
        {showDots && hasMany ? (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5 pointer-events-none">
            {mediaItems.map((_, index) => (
              <span
                key={`dot-${index}`}
                className={cn(
                  'h-1.5 rounded-full bg-white/50 shadow-sm transition-all duration-200',
                  index === active ? 'w-5 bg-white' : 'w-1.5',
                )}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Fullscreen Lightbox Modal */}
      {lightboxOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 z-[110] inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all duration-200 hover:bg-white/20 hover:scale-105 active:scale-95"
            aria-label="Tutup preview"
          >
            <X className="h-6 w-6" />
          </button>

          <div className="w-full max-w-5xl aspect-video md:h-[85vh]">
            <MediaPreviewCarousel
              items={mediaItems}
              alt={alt}
              aspectClassName="h-full w-full"
              className="rounded-2xl bg-transparent"
              sizes="100vw"
              controls
              showCounter
              showDots
              objectFit="contain"
              initialIndex={active} // Sinkronisasi index dari layar utama
            />
          </div>
        </div>
      ) : null}
    </>
  );
}