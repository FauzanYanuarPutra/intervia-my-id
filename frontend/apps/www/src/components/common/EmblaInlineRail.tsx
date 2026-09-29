'use client';

import { Children, type ReactNode } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { useEmblaWheelGestures } from '@/components/common/useEmblaWheelGestures';

type EmblaInlineRailProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  itemClassName?: string;
  dragFree?: boolean;
  wheelEnabled?: boolean;
};

export function EmblaInlineRail({
  children,
  className = '',
  contentClassName = '',
  itemClassName = 'shrink-0',
  dragFree = false,
  wheelEnabled = true,
}: EmblaInlineRailProps) {
  const [viewportRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree,
    loop: false,
  });

  useEmblaWheelGestures(emblaApi, {
    enabled: wheelEnabled,
    desktopOnly: true,
    threshold: 42,
  });

  const items = Children.toArray(children);

  return (
    <div
      ref={viewportRef}
      className={['w-full min-w-0 overflow-hidden', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={['flex min-w-0 w-max min-w-full', contentClassName]
          .filter(Boolean)
          .join(' ')}
      >
        {items.map((child, index) => (
          <div key={index} className={itemClassName}>
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}
