'use client';

import {
  Children,
  useEffect,
  type ReactNode,
} from 'react';
import useEmblaCarousel from 'embla-carousel-react';

import { EmblaDesktopControls } from '@/components/common/EmblaDesktopControls';
import { useEmblaWheelGestures } from '@/components/common/useEmblaWheelGestures';
import { cn } from '@/lib/utils';

type ProfileRailProps = {
  children: ReactNode;
  activeIndex?: number;
  className?: string;
  viewportClassName?: string;
  trackClassName?: string;
  controlsClassName?: string;
  showControls?: boolean;
  ariaLabel?: string;
  scrollToActive?: boolean;
};

/**
 * Shared horizontal rail for profile surfaces.
 *
 * Behaviour intentionally matches the rails used around Home:
 * - touch swipe on mobile
 * - mouse drag on desktop
 * - wheel gestures
 * - optional desktop arrow controls
 * - active item is automatically brought back into view
 *
 * Keep product/listing collections as grids. Use this only for true rails:
 * tabs, filters, compact metrics, and similar one-dimensional navigation.
 */
export function ProfileRail({
  children,
  activeIndex = -1,
  className,
  viewportClassName,
  trackClassName,
  controlsClassName,
  showControls = true,
  ariaLabel,
  scrollToActive = true,
}: ProfileRailProps) {
  const [viewportRef, api] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: true,
    skipSnaps: true,
  });

  useEmblaWheelGestures(api);

  useEffect(() => {
    if (!scrollToActive || activeIndex < 0) return;
    api?.scrollTo(activeIndex);
  }, [activeIndex, api, scrollToActive]);

  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <div
        ref={viewportRef}
        role={ariaLabel ? 'group' : undefined}
        aria-label={ariaLabel}
        className={cn(
          'min-w-0 flex-1 cursor-grab overflow-hidden overscroll-x-contain active:cursor-grabbing',
          'touch-pan-y select-none',
          viewportClassName,
        )}
      >
        <div
          className={cn(
            'flex min-w-0 items-stretch gap-2',
            trackClassName,
          )}
        >
          {Children.map(children, child => child)}
        </div>
      </div>

      {showControls ? (
        <div className={cn('hidden shrink-0 sm:block', controlsClassName)}>
          <EmblaDesktopControls api={api} compact />
        </div>
      ) : null}
    </div>
  );
}

export function ProfileRailItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0 flex-[0_0_auto]', className)}>
      {children}
    </div>
  );
}