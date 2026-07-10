import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  Children,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useHorizontalDragScroll } from '@/hooks/useHorizontalDragScroll';

type HorizontalRailProps = {
  children: ReactNode;
  className?: string;
  hintLabel: string;
  showMobileControls?: boolean;
  minimal?: boolean;
};

export function HorizontalRail({
  children,
  className = '',
  hintLabel,
  showMobileControls = true,
  minimal = false,
}: HorizontalRailProps) {
  const {
    ref: railRef,
    onClickCapture,
    onPointerCancel,
    onPointerDown,
    onPointerLeave,
    onPointerMove,
    onPointerUp,
    onWheel,
  } = useHorizontalDragScroll<HTMLDivElement>();

  const items = useMemo(() => Children.toArray(children), [children]);
  const childCount = items.length;

  const [activeIndex, setActiveIndex] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canGoPrev, setCanGoPrev] = useState(false);
  const [canGoNext, setCanGoNext] = useState(false);

  const syncRailState = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;

    const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const overflowAmount = rail.scrollWidth - rail.clientWidth;

    setHasOverflow(overflowAmount > 8);
    setCanGoPrev(rail.scrollLeft > 4);
    setCanGoNext(rail.scrollLeft < maxScrollLeft - 4);

    const nodes = Array.from(rail.children) as HTMLElement[];
    if (!nodes.length) {
      setActiveIndex(0);
      return;
    }

    const center = rail.scrollLeft + rail.clientWidth / 2;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      const nodeCenter = node.offsetLeft + node.offsetWidth / 2;
      const distance = Math.abs(nodeCenter - center);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }

    setActiveIndex(nearestIndex);
  }, [railRef]);

  useEffect(() => {
    syncRailState();
  }, [syncRailState, childCount, railRef]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    let frame = 0;

    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(syncRailState);
    };

    rail.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', syncRailState);

    const resizeObserver = new ResizeObserver(() => {
      syncRailState();
    });

    resizeObserver.observe(rail);
    Array.from(rail.children).forEach((child) => resizeObserver.observe(child));

    return () => {
      cancelAnimationFrame(frame);
      rail.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', syncRailState);
      resizeObserver.disconnect();
    };
  }, [syncRailState, childCount, railRef]);

  const scrollToIndex = useCallback((index: number) => {
    const rail = railRef.current;
    if (!rail) return;

    const nodes = Array.from(rail.children) as HTMLElement[];
    if (!nodes.length) return;

    const safeIndex = Math.max(0, Math.min(nodes.length - 1, index));
    const target = nodes[safeIndex];

    const left =
      target.offsetLeft - Math.max(16, (rail.clientWidth - target.offsetWidth) / 2);

    rail.scrollTo({
      left: Math.max(0, left),
      behavior: 'smooth',
    });
  }, [railRef]);

  const scrollByViewport = useCallback((direction: 'prev' | 'next') => {
    const rail = railRef.current;
    if (!rail) return;

    const delta = Math.max(rail.clientWidth * 0.9, 280);

    rail.scrollBy({
      left: direction === 'next' ? delta : -delta,
      behavior: 'smooth',
    });
  }, [railRef]);

  return (
    <div className="group relative w-full min-w-0 max-w-full">
      {!minimal ? (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-8 bg-gradient-to-r from-[color:var(--app-surface)] to-transparent sm:block dark:from-[color:var(--app-surface-strong)]" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-8 bg-gradient-to-l from-[color:var(--app-surface)] to-transparent sm:block dark:from-[color:var(--app-surface-strong)]" />

          <div className="pointer-events-none absolute bottom-0 right-2 z-20 hidden items-center gap-1 rounded-full border border-[color:color-mix(in_srgb,var(--app-border)_80%,transparent)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_92%,transparent)] px-1.5 py-0.5 text-[9px] font-semibold text-[color:var(--app-text)] shadow-sm transition group-hover:text-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)] dark:group-hover:text-[color:var(--app-accent)] sm:inline-flex">
            {hintLabel}
            <ArrowRight className="h-2.5 w-2.5 animate-pulse" />
          </div>
        </>
      ) : null}

      <div className={minimal ? 'overflow-visible' : '-mx-3 px-3 sm:mx-0 sm:px-0'}>
        <div
          ref={railRef}
          onClickCapture={onClickCapture}
          onPointerCancel={onPointerCancel}
          onPointerDown={onPointerDown}
          onPointerLeave={onPointerLeave}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
          className={[
            'flex w-full min-w-0 max-w-full overflow-x-auto overflow-y-visible',
            'overscroll-x-contain no-scrollbar scroll-smooth',
            '[scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch]',
            '[scroll-snap-type:x_mandatory]',
            minimal ? 'gap-2' : 'gap-3 py-2',
            hasOverflow ? 'cursor-grab active:cursor-grabbing' : '',
            className,
          ].join(' ')}
        >
          {items.map((child, index) => (
            <div
              key={index}
              className={[
                'h-full min-w-0 shrink-0 self-stretch snap-start',
                minimal
                  ? 'basis-auto'
                  : [
                    // Mobile
                    'w-[46vw] min-w-[46vw] max-w-[46vw]',

                    // HP besar
                    'xs:w-[42vw] xs:min-w-[42vw] xs:max-w-[42vw]',

                    // Tablet
                    'sm:w-[180px] sm:min-w-[180px] sm:max-w-[180px]',

                    // Desktop
                    'md:w-[190px] md:min-w-[190px] md:max-w-[190px]',
                    'lg:w-[210px] lg:min-w-[210px] lg:max-w-[210px]',
                    'xl:w-[220px] xl:min-w-[220px] xl:max-w-[220px]',
                  ].join(' ')
              ].join(' ')}
            >
              <div className="h-full w-full min-w-0">{child}</div>
            </div>
          ))}
        </div>
      </div>

      {showMobileControls && !minimal && childCount > 1 && hasOverflow ? (
        <div className="mt-2 flex items-center justify-between gap-2 sm:hidden">
          <span className="text-[10px] font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
            {hintLabel}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (canGoPrev) {
                  scrollToIndex(activeIndex - 1);
                } else {
                  scrollByViewport('prev');
                }
              }}
              disabled={!canGoPrev}
              className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              aria-label="Scroll previous card"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>

            <span className="min-w-[38px] text-center text-[10px] font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
              {activeIndex + 1}/{childCount}
            </span>

            <button
              type="button"
              onClick={() => {
                if (canGoNext) {
                  scrollToIndex(activeIndex + 1);
                } else {
                  scrollByViewport('next');
                }
              }}
              disabled={!canGoNext}
              className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[color:color-mix(in_srgb,var(--app-accent-strong)_32%,transparent)] dark:text-[color:var(--app-accent)]"
              aria-label="Scroll next card"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
