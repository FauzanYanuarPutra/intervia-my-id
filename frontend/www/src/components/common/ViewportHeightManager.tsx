'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect } from 'react';
import {
  isEditableElementSnapshot,
  resolveViewportMetrics,
} from '@/lib/viewport/viewportMetrics';

const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

const APP_VIEWPORT_SHELL_SELECTOR =
  '[data-app-viewport-shell], .lajukan-visual-viewport-shell';

type AppliedViewportValue = string | undefined;

let lastViewportShellActive = false;
const lastAppliedValues: Record<string, AppliedViewportValue> = {};
const lastAppliedDatasets: Record<string, string | undefined> = {};

function readEditableFocus() {
  const element = document.activeElement;
  if (!element) return false;

  const snapshot = {
    tagName: element.tagName,
    isContentEditable:
      element instanceof HTMLElement ? element.isContentEditable : false,
    role:
      element instanceof HTMLElement ? element.getAttribute('role') : null,
  };

  return isEditableElementSnapshot(snapshot);
}

function readViewportHeight() {
  const viewport = window.visualViewport;
  const layoutHeight =
    window.innerHeight || document.documentElement.clientHeight || 0;

  return resolveViewportMetrics({
    layoutHeight: Math.round(Math.max(1, layoutHeight)),
    visualHeight: viewport?.height,
    visualWidth: viewport?.width || window.innerWidth || 0,
    offsetTop: viewport?.offsetTop,
    offsetLeft: viewport?.offsetLeft,
    scale: viewport?.scale,
    hasEditableFocus: readEditableFocus(),
  });
}

function setCssVarIfChanged(
  root: HTMLElement,
  name: string,
  value: string,
) {
  if (lastAppliedValues[name] === value) return;
  root.style.setProperty(name, value);
  lastAppliedValues[name] = value;
}

function setDatasetIfChanged(
  root: HTMLElement,
  name: keyof HTMLElement['dataset'],
  value: string,
) {
  if (lastAppliedDatasets[name] === value) return;
  root.dataset[name] = value;
  lastAppliedDatasets[name] = value;
}

function hasAppViewportShell() {
  return Boolean(document.querySelector(APP_VIEWPORT_SHELL_SELECTOR));
}

function applyViewportHeight() {
  const root = document.documentElement;
  const metrics = readViewportHeight();
  const hasVisualViewportShell = hasAppViewportShell();

  setCssVarIfChanged(
    root,
    '--app-visual-viewport-height',
    `${metrics.visualHeight}px`,
  );
  setCssVarIfChanged(
    root,
    '--visual-viewport-height',
    `${metrics.visualHeight}px`,
  );
  setCssVarIfChanged(root, '--app-viewport-height', `${metrics.visualHeight}px`);
  setCssVarIfChanged(
    root,
    '--app-viewport-dynamic-height',
    `${metrics.visualHeight}px`,
  );
  setCssVarIfChanged(
    root,
    '--app-layout-viewport-height',
    `${metrics.layoutHeight}px`,
  );
  setCssVarIfChanged(
    root,
    '--app-visual-viewport-width',
    `${metrics.visualWidth}px`,
  );
  setCssVarIfChanged(
    root,
    '--app-viewport-offset-top',
    `${metrics.offsetTop}px`,
  );
  setCssVarIfChanged(
    root,
    '--app-viewport-offset-left',
    `${metrics.offsetLeft}px`,
  );
  setCssVarIfChanged(
    root,
    '--app-keyboard-inset-height',
    `${metrics.keyboardInset}px`,
  );
  setCssVarIfChanged(root, '--app-viewport-scale', String(metrics.scale));
  setDatasetIfChanged(
    root,
    'keyboardOpen',
    metrics.keyboardOpen ? 'true' : 'false',
  );
  setDatasetIfChanged(
    root,
    'visualViewportShell',
    hasVisualViewportShell ? 'true' : 'false',
  );
  if (root.dataset.appViewportShell !== undefined) {
    delete root.dataset.appViewportShell;
    lastAppliedDatasets.appViewportShell = undefined;
  }
  setDatasetIfChanged(
    root,
    'hasAppViewportShell',
    hasVisualViewportShell ? 'true' : 'false',
  );
  setDatasetIfChanged(root, 'viewportManaged', 'true');

  if (
    hasVisualViewportShell &&
    (!lastViewportShellActive || !metrics.keyboardOpen) &&
    window.scrollY > 1
  ) {
    window.scrollTo(0, 0);
  }
  lastViewportShellActive = hasVisualViewportShell;
}

function scheduleViewportSync(timeouts?: number[]) {
  applyViewportHeight();
  window.requestAnimationFrame(applyViewportHeight);
  [80, 220, 480].forEach(delay => {
    const timeoutId = window.setTimeout(applyViewportHeight, delay);
    timeouts?.push(timeoutId);
  });
}

export function ViewportHeightManager() {
  const pathname = usePathname();

  useIsomorphicLayoutEffect(() => {
    const timeoutIds: number[] = [];
    scheduleViewportSync(timeoutIds);
    return () => {
      timeoutIds.forEach(timeoutId => window.clearTimeout(timeoutId));
    };
  }, [pathname]);

  useEffect(() => {
    let frame = 0;
    const timeoutIds: number[] = [];
    const scheduleBurst = () => scheduleViewportSync(timeoutIds);
    const schedule = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        applyViewportHeight();
      });
    };

    const viewport = window.visualViewport;
    scheduleBurst();

    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', scheduleBurst, {
      passive: true,
    });
    window.addEventListener('pageshow', scheduleBurst);
    window.addEventListener('focus', scheduleBurst);
    document.addEventListener('focusin', scheduleBurst);
    document.addEventListener('focusout', scheduleBurst);
    document.addEventListener('visibilitychange', scheduleBurst);
    viewport?.addEventListener('resize', schedule, { passive: true });
    viewport?.addEventListener('scroll', schedule, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      timeoutIds.forEach(timeoutId => window.clearTimeout(timeoutId));
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', scheduleBurst);
      window.removeEventListener('pageshow', scheduleBurst);
      window.removeEventListener('focus', scheduleBurst);
      document.removeEventListener('focusin', scheduleBurst);
      document.removeEventListener('focusout', scheduleBurst);
      document.removeEventListener('visibilitychange', scheduleBurst);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
    };
  }, []);

  return null;
}
