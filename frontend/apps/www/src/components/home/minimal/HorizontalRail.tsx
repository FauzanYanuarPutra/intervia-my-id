import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Children, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useLajukanEmbla } from '@/components/common/useLajukanEmbla';

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
  const items = useMemo(() => Children.toArray(children), [children]);
  const childCount = items.length;
  const [railRef, railApi] = useLajukanEmbla({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: false,
    loop: false,
    skipSnaps: false,
    wheel: {
      enabled: true,
      desktopOnly: true,
      threshold: 42,
    },
  });

  const [activeIndex, setActiveIndex] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canGoPrev, setCanGoPrev] = useState(false);
  const [canGoNext, setCanGoNext] = useState(false);

  const syncRailState = useCallback(() => {
    if (!railApi) return;

    setActiveIndex(railApi.selectedScrollSnap());
    setCanGoPrev(railApi.canScrollPrev());
    setCanGoNext(railApi.canScrollNext());
    setHasOverflow(railApi.scrollSnapList().length > 1);
  }, [railApi]);

  useEffect(() => {
    if (!railApi) return;

    railApi.reInit();
    const frame = window.requestAnimationFrame(syncRailState);

    const onSelect = () => syncRailState();
    const onReInit = () => syncRailState();

    railApi.on('select', onSelect);
    railApi.on('reInit', onReInit);

    return () => {
      window.cancelAnimationFrame(frame);
      railApi.off('select', onSelect);
      railApi.off('reInit', onReInit);
    };
  }, [railApi, childCount, syncRailState]);

  const scrollToIndex = useCallback(
    (index: number) => {
      if (!railApi) return;
      const safeIndex = Math.max(
        0,
        Math.min(railApi.scrollSnapList().length - 1, index),
      );
      railApi.scrollTo(safeIndex);
    },
    [railApi],
  );

  const scrollByViewport = useCallback(
    (direction: 'prev' | 'next') => {
      if (!railApi) return;

      if (direction === 'next') {
        railApi.scrollNext();
      } else {
        railApi.scrollPrev();
      }
    },
    [railApi],
  );

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
          className={[
            'w-full min-w-0 max-w-full overflow-hidden overscroll-x-contain touch-pan-y',
            minimal ? '' : 'py-2',
            className,
          ].join(' ')}
        >
          <div
            className={[
              'flex min-w-0',
              minimal ? 'gap-2' : 'gap-3',
            ].join(' ')}
          >
            {items.map((child, index) => (
              <div
                key={index}
                className={[
                  'h-full min-w-0 shrink-0 self-stretch',
                  minimal
                    ? 'basis-auto'
                    : [
                        'w-[46vw] min-w-[46vw] max-w-[46vw]',
                        'xs:w-[42vw] xs:min-w-[42vw] xs:max-w-[42vw]',
                        'sm:w-[180px] sm:min-w-[180px] sm:max-w-[180px]',
                        'md:w-[190px] md:min-w-[190px] md:max-w-[190px]',
                        'lg:w-[210px] lg:min-w-[210px] lg:max-w-[210px]',
                        'xl:w-[220px] xl:min-w-[220px] xl:max-w-[220px]',
                      ].join(' '),
                ].join(' ')}
              >
                <div className="h-full w-full min-w-0">{child}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showMobileControls && !minimal && childCount > 1 && hasOverflow ? (
        <div className="mt-1.5 flex items-center justify-between gap-1.5 sm:hidden">
          <span className="line-clamp-1 text-[9px] font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
            {hintLabel}
          </span>

          <div className="flex shrink-0 items-center gap-1">
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
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              aria-label="Scroll previous card"
            >
              <ArrowLeft className="h-3 w-3" />
            </button>

            <span className="min-w-[32px] text-center text-[9px] font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
              {activeIndex + 1}/{Math.max(1, railApi?.scrollSnapList().length ?? childCount)}
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
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] shadow-sm disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[color:color-mix(in_srgb,var(--app-accent-strong)_32%,transparent)] dark:text-[color:var(--app-accent)]"
              aria-label="Scroll next card"
            >
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
