import {
  useCallback,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';

type DragState = {
  pointerId: number;
  startX: number;
  startScrollLeft: number;
  dragging: boolean;
};

export function useHorizontalDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  const releaseDrag = useCallback((pointerId?: number) => {
    const rail = ref.current;
    if (rail && pointerId !== undefined) {
      try {
        if (rail.hasPointerCapture(pointerId)) {
          rail.releasePointerCapture(pointerId);
        }
      } catch {
        // Ignore capture release issues on unmounted elements.
      }
    }

    const state = dragStateRef.current;
    if (state?.dragging) {
      suppressClickRef.current = true;
    }
    dragStateRef.current = null;
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent<T>) => {
    if (event.pointerType === 'touch') return;
    if (event.button !== 0) return;

    const rail = ref.current;
    if (!rail || rail.scrollWidth <= rail.clientWidth + 4) return;

    suppressClickRef.current = false;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: rail.scrollLeft,
      dragging: false,
    };

    try {
      rail.setPointerCapture(event.pointerId);
    } catch {
      // Best effort. Browsers that do not support capture will still work.
    }
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<T>) => {
    const state = dragStateRef.current;
    const rail = ref.current;
    if (!state || !rail || state.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - state.startX;
    if (!state.dragging && Math.abs(deltaX) < 8) return;

    if (!state.dragging) {
      state.dragging = true;
    }

    const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
    if (maxScrollLeft <= 0) return;

    event.preventDefault();
    const nextScrollLeft = Math.max(
      0,
      Math.min(maxScrollLeft, state.startScrollLeft - deltaX),
    );
    rail.scrollLeft = nextScrollLeft;
  }, []);

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<T>) => {
      releaseDrag(event.pointerId);
    },
    [releaseDrag],
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<T>) => {
      releaseDrag(event.pointerId);
    },
    [releaseDrag],
  );

  const onPointerLeave = useCallback(() => {
    const state = dragStateRef.current;
    if (!state) return;
    releaseDrag(state.pointerId);
  }, [releaseDrag]);

  const onClickCapture = useCallback((event: ReactMouseEvent<T>) => {
    if (!suppressClickRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  }, []);

  const onWheel = useCallback((event: ReactWheelEvent<T>) => {
    if (event.ctrlKey) return;

    const rail = ref.current;
    if (!rail) return;

    const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
    if (maxScrollLeft <= 0) return;

    const delta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;
    if (!delta) return;

    const nextScrollLeft = Math.max(
      0,
      Math.min(maxScrollLeft, rail.scrollLeft + delta),
    );
    if (nextScrollLeft === rail.scrollLeft) return;

    event.preventDefault();
    rail.scrollLeft = nextScrollLeft;
  }, []);

  return {
    ref,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
    onClickCapture,
    onWheel,
  };
}
