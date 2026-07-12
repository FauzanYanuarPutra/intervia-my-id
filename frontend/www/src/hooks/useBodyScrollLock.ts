'use client';

import { useEffect, useLayoutEffect } from 'react';

type ScrollLockSnapshot = {
  scrollY: number;
  bodyOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyWidth: string;
  bodyOverscrollBehaviorY: string;
  htmlOverflow: string;
  htmlOverscrollBehavior: string;
};

type BodyScrollLockOptions = {
  resetScroll?: boolean;
};

let activeLocks = 0;
let snapshot: ScrollLockSnapshot | null = null;
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

function lockBody(options: BodyScrollLockOptions = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  activeLocks += 1;
  if (activeLocks > 1) return;

  const body = document.body;
  const html = document.documentElement;
  if (options.resetScroll) {
    window.scrollTo(0, 0);
  }
  const scrollY = window.scrollY || window.pageYOffset || 0;

  snapshot = {
    scrollY,
    bodyOverflow: body.style.overflow,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyWidth: body.style.width,
    bodyOverscrollBehaviorY: body.style.overscrollBehaviorY,
    htmlOverflow: html.style.overflow,
    htmlOverscrollBehavior: html.style.overscrollBehavior,
  };

  body.style.overflow = 'hidden';
  body.style.position = 'fixed';
  body.style.top = `-${scrollY}px`;
  body.style.width = '100%';
  body.style.overscrollBehaviorY = 'none';
  html.style.overflow = 'hidden';
  html.style.overscrollBehavior = 'none';
}

function unlockBody() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (activeLocks <= 0) return;

  activeLocks -= 1;
  if (activeLocks > 0 || !snapshot) return;

  const body = document.body;
  const html = document.documentElement;
  const restore = snapshot;
  snapshot = null;

  body.style.overflow = restore.bodyOverflow;
  body.style.position = restore.bodyPosition;
  body.style.top = restore.bodyTop;
  body.style.width = restore.bodyWidth;
  body.style.overscrollBehaviorY = restore.bodyOverscrollBehaviorY;
  html.style.overflow = restore.htmlOverflow;
  html.style.overscrollBehavior = restore.htmlOverscrollBehavior;

  window.scrollTo(0, restore.scrollY);
}

export function useBodyScrollLock(
  active: boolean,
  options: BodyScrollLockOptions = {},
) {
  const resetScroll = options.resetScroll === true;

  useIsomorphicLayoutEffect(() => {
    if (!active) return undefined;

    lockBody({ resetScroll });
    return () => {
      unlockBody();
    };
  }, [active, resetScroll]);
}
