'use client';

import { Children, type ReactNode } from 'react';
import { useLajukanEmbla } from '@/components/common/useLajukanEmbla';

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
  const [viewportRef] = useLajukanEmbla({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree,
    loop: false,
    wheel: {
      enabled: wheelEnabled,
      desktopOnly: true,
      threshold: 42,
    },
  });

  const items = Children.toArray(children);

  return (
    <div
      ref={viewportRef}
      className={['w-full min-w-0 overflow-hidden overscroll-x-contain touch-pan-y', className]
        .filter(Boolean)
        .join(' ')}
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
