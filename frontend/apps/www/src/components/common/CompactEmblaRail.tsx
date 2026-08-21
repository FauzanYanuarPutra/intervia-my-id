'use client';

import { Children, type ReactNode } from 'react';
import useEmblaCarousel from 'embla-carousel-react';

import { EmblaDesktopControls } from '@/components/common/EmblaDesktopControls';
import { useEmblaWheelGestures } from '@/components/common/useEmblaWheelGestures';
import { cn } from '@/lib/utils';

type CompactEmblaRailProps = {
  children: ReactNode;
  ariaLabel: string;
  isId: boolean;
  role?: 'list' | 'listbox' | 'tablist';
  className?: string;
  viewportClassName?: string;
  containerClassName?: string;
  slideClassName?: string;
  controlsClassName?: string;
  controls?: boolean;
};

export function CompactEmblaRail({
  children,
  ariaLabel,
  isId,
  role,
  className,
  viewportClassName,
  containerClassName,
  slideClassName,
  controlsClassName,
  controls = true,
}: CompactEmblaRailProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: true,
  });
  useEmblaWheelGestures(emblaApi);
  const items = Children.toArray(children).filter(Boolean);

  if (items.length === 0) return null;

  return (
    <div className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <div
        ref={emblaRef}
        className={cn(
          'min-w-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing',
          viewportClassName,
        )}
      >
        <div
          role={role}
          aria-label={ariaLabel}
          className={cn('flex touch-pan-y gap-1.5', containerClassName)}
        >
          {items.map((child, index) => (
            <div
              key={index}
              role="presentation"
              className={cn('min-w-0 flex-[0_0_auto]', slideClassName)}
            >
              {child}
            </div>
          ))}
        </div>
      </div>

      {controls ? (
        <EmblaDesktopControls
          api={emblaApi}
          isId={isId}
          compact
          className={controlsClassName}
        />
      ) : null}
    </div>
  );
}
