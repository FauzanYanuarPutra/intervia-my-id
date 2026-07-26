'use client';

import { useCallback, useEffect, useState } from 'react';
import type { EmblaCarouselType } from 'embla-carousel';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type EmblaDesktopControlsProps = {
  api: EmblaCarouselType | undefined;
  isId?: boolean;
  className?: string;
  compact?: boolean;
};

export function EmblaDesktopControls({
  api,
  isId = true,
  className,
  compact = false,
}: EmblaDesktopControlsProps) {
  const [ready, setReady] = useState(false);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const sync = useCallback(() => {
    if (!api) {
      setReady(false);
      setCanScrollPrev(false);
      setCanScrollNext(false);
      return;
    }

    setReady(true);
    setCanScrollPrev(api.canScrollPrev());
    setCanScrollNext(api.canScrollNext());
  }, [api]);

  useEffect(() => {
    if (!api) return;

    const frame = window.requestAnimationFrame(sync);

    api.on('select', sync);
    api.on('reInit', sync);
    api.on('resize', sync);

    return () => {
      window.cancelAnimationFrame(frame);
      api.off('select', sync);
      api.off('reInit', sync);
      api.off('resize', sync);
    };
  }, [api, sync]);

  const scrollable = canScrollPrev || canScrollNext;

  // Benar-benar tidak dirender dan tidak memakan ruang.
  if (!ready || !scrollable) {
    return null;
  }

  const buttonClassName = compact ? 'h-7 w-7' : 'h-8 w-8';
  const iconClassName = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <div
      className={cn(
        'hidden shrink-0 items-center gap-1 lg:flex',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => api?.scrollPrev()}
        disabled={!canScrollPrev}
        className={cn(
          'inline-flex items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] shadow-sm transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-30 dark:text-[color:var(--app-text-inverse)]',
          buttonClassName,
        )}
        aria-label={isId ? 'Geser sebelumnya' : 'Previous slide'}
        title={isId ? 'Sebelumnya' : 'Previous'}
      >
        <ChevronLeft className={iconClassName} />
      </button>

      <button
        type="button"
        onClick={() => api?.scrollNext()}
        disabled={!canScrollNext}
        className={cn(
          'inline-flex items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-[color:var(--app-surface-muted)] disabled:text-[color:var(--app-text-soft)] disabled:opacity-45',
          buttonClassName,
        )}
        aria-label={isId ? 'Geser berikutnya' : 'Next slide'}
        title={isId ? 'Berikutnya' : 'Next'}
      >
        <ChevronRight className={iconClassName} />
      </button>
    </div>
  );
}