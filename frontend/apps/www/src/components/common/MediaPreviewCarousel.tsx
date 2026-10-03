'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { useLajukanEmbla } from '@/components/common/useLajukanEmbla';
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  ImageOff,
  PlayCircle,
  X,
} from 'lucide-react';
import { LajukanImage } from '@/components/common/LajukanImage';
import {
  isPreviewableContentMediaUrl,
  normalizeContentMediaUrl,
} from '@/lib/content/catalog';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
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
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  keyboardControls?: boolean;
  /** Open the preview when the user clicks/taps an image in the carousel. */
  openOnMediaClick?: boolean;
  /** Keep carousel arrows visible instead of relying on desktop hover. */
  alwaysShowControls?: boolean;
};

type NormalizedMedia = {
  src: string;
  type: 'image' | 'video';
  alt: string;
};

function isVideoSrc(src: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(src);
}

function mediaTypeFor(src: string, explicitType?: 'image' | 'video') {
  if (explicitType) return explicitType;
  return isVideoSrc(src) ? 'video' : 'image';
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
    const src = normalizeContentMediaUrl(raw);
    if (!src) continue;
    if (!isPreviewableContentMediaUrl(src)) continue;
    const key = src.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      src,
      type: mediaTypeFor(src, typeof item === 'string' ? undefined : item.type),
      alt: typeof item === 'string' ? alt : item.alt || alt,
    });
  }

  return result;
}

function clampIndex(index: number, length: number) {
  if (length <= 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}

function EmptyMediaFallback({ alt }: { alt: string }) {
  return (
    <div
      role="img"
      aria-label={alt || 'Media belum tersedia'}
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[linear-gradient(135deg,#e5eef7_0%,#f8fafc_50%,#edf7f7_100%)] px-4 text-center text-slate-500 dark:bg-[linear-gradient(135deg,#111827_0%,#1f2937_48%,#0f172a_100%)] dark:text-slate-300"
    >
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-[20px] bg-white/78 shadow-sm ring-1 ring-black/5 dark:bg-slate-950/62 dark:ring-white/10">
        <ImageOff className="h-7 w-7" />
      </span>
      <span className="max-w-[13rem] text-[11px] font-bold leading-4">
        Media belum bisa dipreview
      </span>
    </div>
  );
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
  onIndexChange,
  keyboardControls = false,
  openOnMediaClick = true,
  alwaysShowControls = false,
}: MediaPreviewCarouselProps) {
  const mediaItems = useMemo(
    () => normalizeMediaItems(items, alt),
    [alt, items],
  );

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [failedSources, setFailedSources] = useState<Set<string>>(
    () => new Set(),
  );
  const initialIndexRef = useRef(initialIndex);
  const hasInitialisedEmblaRef = useRef(false);
  const mediaWheelBurstRef = useRef(false);
  const mediaWheelBurstTimerRef = useRef<number | null>(null);
  const [viewportRef, emblaApi] = useLajukanEmbla({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: false,
    loop: false,
    skipSnaps: false,
    wheel: { enabled: false },
  });

  const visibleMediaItems = useMemo(
    () => mediaItems.filter(item => !failedSources.has(item.src)),
    [failedSources, mediaItems],
  );

  const active = clampIndex(activeIndex, visibleMediaItems.length);
  const hasMany = visibleMediaItems.length > 1;

  const markMediaFailed = (src: string) => {
    setFailedSources(previous => {
      if (previous.has(src)) return previous;
      const next = new Set(previous);
      next.add(src);
      return next;
    });
  };

  const scrollToIndex = useCallback(
    (nextIndex: number, jump = false) => {
      if (!emblaApi) return;
      emblaApi.scrollTo(
        clampIndex(nextIndex, visibleMediaItems.length),
        jump,
      );
    },
    [emblaApi, visibleMediaItems.length],
  );

  const shouldIgnoreMediaGesture = useCallback((target: EventTarget | null) => {
    const element = target instanceof HTMLElement ? target : null;
    if (!element) return false;
    return Boolean(
      element.closest(
        'button,a,input,textarea,select,[contenteditable="true"],[data-media-gesture-ignore]',
      ),
    );
  }, []);

  const handleMediaWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      if (event.ctrlKey || shouldIgnoreMediaGesture(event.target)) return;

      const delta =
        Math.abs(event.deltaX) > 0
          ? event.deltaX
          : event.shiftKey
            ? event.deltaY
            : 0;
      if (Math.abs(delta) < 4 || !hasMany || !emblaApi) return;

      const direction = delta > 0 ? 1 : -1;
      const canScroll =
        direction > 0 ? emblaApi.canScrollNext() : emblaApi.canScrollPrev();
      if (!canScroll) return;

      event.preventDefault();

      if (mediaWheelBurstRef.current) return;
      mediaWheelBurstRef.current = true;

      if (mediaWheelBurstTimerRef.current !== null) {
        window.clearTimeout(mediaWheelBurstTimerRef.current);
      }
      mediaWheelBurstTimerRef.current = window.setTimeout(() => {
        mediaWheelBurstRef.current = false;
        mediaWheelBurstTimerRef.current = null;
      }, 180);

      if (direction > 0) emblaApi.scrollNext();
      else emblaApi.scrollPrev();
    },
    [emblaApi, hasMany, shouldIgnoreMediaGesture],
  );

  useEffect(() => {
    if (!emblaApi) return;

    const syncIndex = () => {
      setActiveIndex(
        clampIndex(emblaApi.selectedScrollSnap(), visibleMediaItems.length),
      );
    };

    emblaApi.on('select', syncIndex);
    emblaApi.on('reInit', syncIndex);
    syncIndex();

    return () => {
      emblaApi.off('select', syncIndex);
      emblaApi.off('reInit', syncIndex);
    };
  }, [emblaApi, visibleMediaItems.length]);

  useEffect(() => {
    if (!emblaApi) return;

    emblaApi.reInit();
    if (!hasInitialisedEmblaRef.current) {
      const target = clampIndex(
        initialIndexRef.current,
        visibleMediaItems.length,
      );
      emblaApi.scrollTo(target, true);
      hasInitialisedEmblaRef.current = true;
    }
  }, [emblaApi, visibleMediaItems.length]);

  useEffect(() => {
    return () => {
      if (mediaWheelBurstTimerRef.current !== null) {
        window.clearTimeout(mediaWheelBurstTimerRef.current);
        mediaWheelBurstTimerRef.current = null;
      }
    };
  }, []);

  useBodyScrollLock(lightboxOpen);

  useEffect(() => {
    if (!lightboxOpen && !keyboardControls) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (lightboxOpen) setLightboxOpen(false);
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        scrollToIndex(active - 1);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        scrollToIndex(active + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [active, keyboardControls, lightboxOpen, scrollToIndex]);

  useEffect(() => {
    onIndexChange?.(active);
  }, [active, onIndexChange]);

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
          onError={() => markMediaFailed(item.src)}
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
        onError={() => markMediaFailed(item.src)}
      />
    );
  };

  return (
    <>
      <div
        className={cn(
          'group relative isolate overflow-hidden bg-slate-100 text-slate-500 transition-colors duration-200 dark:bg-slate-900 dark:text-slate-300',
          aspectClassName,
          className,
        )}
      >
        {visibleMediaItems.length > 0 ? (
          <div
            ref={viewportRef}
            onWheel={handleMediaWheel}
            className={cn(
              'relative flex h-full min-h-0 w-full min-w-0 overflow-hidden overscroll-x-contain [touch-action:pan-y]',
              viewportClassName,
            )}
          >
            {visibleMediaItems.map((item, index) => (
              <div
                key={`${item.src}-${index}`}
                className={cn(
                  'relative h-full min-h-0 w-full min-w-0 shrink-0 grow-0 basis-full overflow-hidden bg-slate-100 dark:bg-slate-950',
                  openOnMediaClick &&
                    lightbox &&
                    item.type === 'image' &&
                    'cursor-zoom-in',
                )}
                onClick={event => {
                  if (
                    !openOnMediaClick ||
                    !lightbox ||
                    item.type !== 'image' ||
                    shouldIgnoreMediaGesture(event.target)
                  ) {
                    return;
                  }
                  setLightboxOpen(true);
                }}
                aria-label={
                  openOnMediaClick && lightbox && item.type === 'image'
                    ? 'Buka preview gambar'
                    : undefined
                }
              >
                {renderMedia(item, index)}
                {item.type === 'video' ? (
                  <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm">
                    <PlayCircle className="h-3.5 w-3.5 text-white/90" />
                    Video
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyMediaFallback alt={alt} />
        )}

        {overlay}

        {/* Counter Badge */}
        {visibleMediaItems.length > 1 && showCounter ? (
          <span className="absolute left-3 top-3 z-[3] rounded-full bg-black/64 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm select-none ring-1 ring-white/15">
            {active + 1} / {visibleMediaItems.length}
          </span>
        ) : null}

        {/* Lightbox Trigger Button */}
        {lightbox && visibleMediaItems.length > 0 ? (
          <button
            type="button"
            onClick={event => {
              event.preventDefault();
              event.stopPropagation();
              setLightboxOpen(true);
            }}
            className="absolute bottom-2.5 right-2.5 z-[3] inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/92 text-slate-900 shadow-md ring-1 ring-black/5 transition-all duration-200 hover:scale-105 hover:bg-white active:scale-95 dark:bg-slate-900/92 dark:text-white dark:ring-white/10 dark:hover:bg-slate-900 sm:bottom-3 sm:right-3"
            aria-label="Perbesar media"
          >
            <Expand className="h-3.5 w-3.5" />
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
                'absolute left-2.5 top-1/2 z-[8] inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-slate-900 shadow-lg ring-1 ring-black/5 transition-all duration-200 hover:bg-white active:scale-95 dark:bg-slate-900/92 dark:text-white dark:ring-white/10 sm:left-3 sm:h-10 sm:w-10',
                !alwaysShowControls &&
                  'md:opacity-0 md:group-hover:opacity-100',
                active === 0 &&
                  'cursor-not-allowed opacity-40 md:group-hover:opacity-40',
              )}
              aria-label="Media sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={active === visibleMediaItems.length - 1}
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                scrollToIndex(active + 1);
              }}
              className={cn(
                'absolute right-2.5 top-1/2 z-[8] inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-slate-900 shadow-lg ring-1 ring-black/5 transition-all duration-200 hover:bg-white active:scale-95 dark:bg-slate-900/92 dark:text-white dark:ring-white/10 sm:right-3 sm:h-10 sm:w-10',
                !alwaysShowControls &&
                  'md:opacity-0 md:group-hover:opacity-100',
                active === visibleMediaItems.length - 1 &&
                  'cursor-not-allowed opacity-40 md:group-hover:opacity-40',
              )}
              aria-label="Media berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        ) : null}

        {/* Dynamic Indicator Dots */}
        {showDots && hasMany ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-2.5 z-[3] flex justify-center gap-1 sm:bottom-3">
            {visibleMediaItems.map((_, index) => (
              <div
                key={`dot-${index}`}
                className={cn(
                  'all-unset !h-1 !min-h-1 !min-w-1 !p-0 !m-0 rounded-full bg-white/50 shadow-sm transition-all duration-200',
                  index === active ? '!w-1 bg-white' : '!w-1',
                )}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Fullscreen Lightbox Modal */}
      {lightboxOpen ? (
        <div
          className="ui-layer-preview fixed inset-0 flex h-[var(--app-visual-viewport-height)] w-screen items-center justify-center overflow-hidden bg-black/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] animate-in fade-in duration-200 sm:px-2"
          role="dialog"
          aria-modal="true"
          aria-label="Preview media"
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[2] inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white shadow-[0_18px_48px_-28px_rgba(0,0,0,0.85)] ring-1 ring-white/15 transition-all duration-200 hover:scale-105 hover:bg-white/22 active:scale-95 sm:right-4"
            aria-label="Tutup preview"
          >
            <X className="h-6 w-6" />
          </button>

          <div className="h-[min(78vh,calc(var(--app-visual-viewport-height)-5.5rem))] w-full max-w-6xl sm:h-[min(84vh,calc(var(--app-visual-viewport-height)-5rem))]">
            <MediaPreviewCarousel
              key={`lightbox-${active}`}
              items={visibleMediaItems}
              alt={alt}
              aspectClassName="h-full w-full"
              className="rounded-[18px] bg-black shadow-[0_28px_90px_-34px_rgba(0,0,0,0.92)] ring-1 ring-white/10"
              sizes="100vw"
              controls
              showCounter
              showDots
              objectFit="contain"
              openOnMediaClick={false}
              alwaysShowControls
              keyboardControls
              initialIndex={active} // Sinkronisasi index dari layar utama
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
