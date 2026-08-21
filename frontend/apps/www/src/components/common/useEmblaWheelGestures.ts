'use client';

import { useEffect, useRef } from 'react';
import type { EmblaCarouselType } from 'embla-carousel';

type UseEmblaWheelGesturesOptions = {
  enabled?: boolean;
  desktopOnly?: boolean;
  threshold?: number;
};

const DEFAULT_THRESHOLD = 34;
const WHEEL_COOLDOWN_MS = 110;
const RESET_DELAY_MS = 180;

function normalizeWheelDelta(delta: number, deltaMode: number) {
  if (deltaMode === WheelEvent.DOM_DELTA_LINE) return delta * 16;
  if (deltaMode === WheelEvent.DOM_DELTA_PAGE) return delta * 320;
  return delta;
}

function shouldIgnoreWheelTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"]'),
  );
}

export function useEmblaWheelGestures(
  api: EmblaCarouselType | undefined,
  {
    enabled = true,
    desktopOnly = true,
    threshold = DEFAULT_THRESHOLD,
  }: UseEmblaWheelGesturesOptions = {},
) {
  const accumulatedDelta = useRef(0);
  const lastScrollAt = useRef(0);
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!api || !enabled) return;
    if (
      desktopOnly &&
      !window.matchMedia('(hover: hover) and (pointer: fine)').matches
    ) {
      return;
    }

    const viewport = api.rootNode();

    const resetAccumulatorSoon = () => {
      if (resetTimer.current !== null) {
        window.clearTimeout(resetTimer.current);
      }
      resetTimer.current = window.setTimeout(() => {
        accumulatedDelta.current = 0;
        resetTimer.current = null;
      }, RESET_DELAY_MS);
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (shouldIgnoreWheelTarget(event.target)) return;
      if (!api.canScrollPrev() && !api.canScrollNext()) return;

      const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode);
      const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode);
      const useHorizontalDelta =
        event.shiftKey || Math.abs(deltaX) >= Math.abs(deltaY);
      const delta = useHorizontalDelta ? deltaX || deltaY : deltaY;

      if (Math.abs(delta) < 1) return;

      const canScrollInDirection =
        delta > 0 ? api.canScrollNext() : api.canScrollPrev();
      if (!canScrollInDirection) {
        accumulatedDelta.current = 0;
        return;
      }

      event.preventDefault();
      accumulatedDelta.current += delta;

      if (Math.abs(accumulatedDelta.current) < threshold) {
        resetAccumulatorSoon();
        return;
      }

      const now = window.performance.now();
      if (now - lastScrollAt.current < WHEEL_COOLDOWN_MS) return;

      if (accumulatedDelta.current > 0) {
        api.scrollNext();
      } else {
        api.scrollPrev();
      }

      accumulatedDelta.current = 0;
      lastScrollAt.current = now;
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      viewport.removeEventListener('wheel', onWheel);
      if (resetTimer.current !== null) {
        window.clearTimeout(resetTimer.current);
        resetTimer.current = null;
      }
    };
  }, [api, desktopOnly, enabled, threshold]);
}
