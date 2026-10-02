'use client';

import { Children, type ReactNode, useMemo } from 'react';
import useEmblaCarousel from 'embla-carousel-react';

type EmblaInlineRailProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  itemClassName?: string;
  dragFree?: boolean;
};

export function EmblaInlineRail({
  children,
  className = '',
  contentClassName = '',
  itemClassName = 'shrink-0',
  dragFree = true,
}: EmblaInlineRailProps) {
  const [viewportRef] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree,
    loop: false,
    skipSnaps: false,
  });

  const items = useMemo(() => Children.toArray(children), [children]);

  return (
    <div
      ref={viewportRef}
      className={['w-full min-w-0 overflow-hidden overscroll-x-contain touch-pan-y', className]
        .filter(Boolean)
        .join(' ')}
      style={{ touchAction: 'pan-y pinch-zoom' }}
    >
      <div
        className={['flex min-w-full w-max', contentClassName]
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
