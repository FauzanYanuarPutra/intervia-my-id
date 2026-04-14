'use client';

import { useEffect } from 'react';

const isLocalhost = (host: string) =>
  host === 'localhost' ||
  host === '127.0.0.1' ||
  host === '[::1]' ||
  host.endsWith('.local');

export function ClientSecurityGuards() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isLocalhost(window.location.hostname)) return;

    const viewportContent =
      'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover';
    const ensureViewport = () => {
      let tag = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
      if (!tag) {
        tag = document.createElement('meta');
        tag.name = 'viewport';
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', viewportContent);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const ctrl = event.ctrlKey || event.metaKey;
      if (ctrl && (key === '+' || key === '=' || key === '-' || key === '0')) {
        event.preventDefault();
      }
      if (event.key === 'F12') {
        event.preventDefault();
      }
      if (ctrl && event.shiftKey && (key === 'i' || key === 'j' || key === 'c')) {
        event.preventDefault();
      }
      if (ctrl && key === 'u') {
        event.preventDefault();
      }
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) event.preventDefault();
    };

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const onGesture = (event: Event) => {
      event.preventDefault();
    };

    ensureViewport();
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('gesturestart', onGesture);
    document.addEventListener('gesturechange', onGesture);
    document.addEventListener('gestureend', onGesture);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('wheel', onWheel);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('gesturestart', onGesture);
      document.removeEventListener('gesturechange', onGesture);
      document.removeEventListener('gestureend', onGesture);
    };
  }, []);

  return null;
}
