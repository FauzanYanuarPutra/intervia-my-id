'use client';

import { useEffect, useLayoutEffect } from 'react';

type ScrollLockSnapshot = {
  scrollY: number;
  bodyOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyLeft: string;
  bodyRight: string;
  bodyWidth: string;
  bodyPaddingRight: string;
  bodyOverscrollBehaviorY: string;
  htmlOverflow: string;
  htmlOverscrollBehavior: string;
  htmlScrollbarGutter: string;
  htmlBodyScrollLocked?: string;
};

type BodyScrollLockOptions = {
  resetScroll?: boolean;
  preserveScrollbarGap?: boolean;
};

let activeLocks = 0;
let snapshot: ScrollLockSnapshot | null = null;
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function recoverStaleBodyScrollLock() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (activeLocks > 0) return;

  const body = document.body;
  const html = document.documentElement;
  const lockedByDataset = html.dataset.bodyScrollLocked === 'true';
  const looksLocked =
    lockedByDataset ||
    body.style.position === 'fixed' ||
    body.style.overflow === 'hidden' ||
    html.style.overflow === 'hidden';

  if (!looksLocked) return;

  const top = body.style.top;
  const scrollY =
    top && /^-\d+/.test(top) ? Math.abs(parseInt(top, 10)) : window.scrollY;

  snapshot = null;
  body.style.overflow = '';
  body.style.position = '';
  body.style.top = '';
  body.style.left = '';
  body.style.right = '';
  body.style.width = '';
  body.style.paddingRight = '';
  body.style.overscrollBehaviorY = '';
  html.style.overflow = '';
  html.style.overscrollBehavior = '';
  html.style.scrollbarGutter = '';
  delete html.dataset.bodyScrollLocked;

  if (scrollY > 0) {
    window.scrollTo(0, scrollY);
  }
}

function lockBody(options: BodyScrollLockOptions = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  activeLocks += 1;
  if (activeLocks > 1) return;

  const body = document.body;
  const html = document.documentElement;
  if (options.resetScroll) {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }
  const scrollY = options.resetScroll
    ? 0
    : window.scrollY || window.pageYOffset || 0;
  const preserveScrollbarGap = options.preserveScrollbarGap !== false;
  const scrollbarWidth = preserveScrollbarGap
    ? Math.max(0, window.innerWidth - html.clientWidth)
    : 0;

  snapshot = {
    scrollY,
    bodyOverflow: body.style.overflow,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyLeft: body.style.left,
    bodyRight: body.style.right,
    bodyWidth: body.style.width,
    bodyPaddingRight: body.style.paddingRight,
    bodyOverscrollBehaviorY: body.style.overscrollBehaviorY,
    htmlOverflow: html.style.overflow,
    htmlOverscrollBehavior: html.style.overscrollBehavior,
    htmlScrollbarGutter: html.style.scrollbarGutter,
    htmlBodyScrollLocked: html.dataset.bodyScrollLocked,
  };

  body.style.overflow = 'hidden';
  body.style.position = 'fixed';
  body.style.top = `-${scrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${scrollbarWidth}px`;
  }
  body.style.overscrollBehaviorY = 'none';
  html.style.overflow = 'hidden';
  html.style.overscrollBehavior = 'none';
  html.style.scrollbarGutter = preserveScrollbarGap ? 'stable' : 'auto';
  html.dataset.bodyScrollLocked = 'true';
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
  body.style.left = restore.bodyLeft;
  body.style.right = restore.bodyRight;
  body.style.width = restore.bodyWidth;
  body.style.paddingRight = restore.bodyPaddingRight;
  body.style.overscrollBehaviorY = restore.bodyOverscrollBehaviorY;
  html.style.overflow = restore.htmlOverflow;
  html.style.overscrollBehavior = restore.htmlOverscrollBehavior;
  html.style.scrollbarGutter = restore.htmlScrollbarGutter;
  if (restore.htmlBodyScrollLocked) {
    html.dataset.bodyScrollLocked = restore.htmlBodyScrollLocked;
  } else {
    delete html.dataset.bodyScrollLocked;
  }

  window.scrollTo(0, restore.scrollY);
}

export function useBodyScrollLock(
  active: boolean,
  options: BodyScrollLockOptions = {},
) {
  const resetScroll = options.resetScroll === true;
  const preserveScrollbarGap = options.preserveScrollbarGap !== false;

  useIsomorphicLayoutEffect(() => {
    if (!active) return undefined;

    lockBody({ resetScroll, preserveScrollbarGap });
    return () => {
      unlockBody();
    };
  }, [active, preserveScrollbarGap, resetScroll]);
}
