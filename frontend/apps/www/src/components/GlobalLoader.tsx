'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from '@/i18n/navigation';
import { ROUTE_LOADER_DELAY_MS } from '@/lib/async/loadingTimings';
import { useSearchParams } from 'next/navigation';
import { Z_INDEX } from './constants/z-index';

type TimerRef = React.MutableRefObject<ReturnType<typeof setTimeout> | null>;

const FAIL_SAFE_HIDE_MS = 8000;

function clearTimer(timer: TimerRef) {
  if (timer.current === null) return;
  clearTimeout(timer.current);
  timer.current = null;
}

export default function GlobalLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  const [showLoader, setShowLoader] = useState(false);

  const delayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failSafeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loaderVisibleRef = useRef(false);
  const currentRouteRef = useRef('');

  const hideLoader = useCallback(() => {
    clearTimer(delayTimer);
    clearTimer(failSafeTimer);
    loaderVisibleRef.current = false;
    setShowLoader(false);
  }, []);

  useEffect(() => {
    currentRouteRef.current = window.location.pathname + window.location.search;
  }, []);

  useEffect(() => {
    const scheduleLoader = () => {
      clearTimer(delayTimer);

      delayTimer.current = setTimeout(() => {
        setShowLoader(true);
        loaderVisibleRef.current = true;
      }, ROUTE_LOADER_DELAY_MS);

      clearTimer(failSafeTimer);
      failSafeTimer.current = setTimeout(() => {
        hideLoader();
      }, FAIL_SAFE_HIDE_MS);
    };

    const handleClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      const link = (e.target as HTMLElement | null)?.closest('a');
      if (!link) return;
      if (link.target && link.target !== '_self') return;
      if (link.hasAttribute('download')) return;

      let targetUrl: URL;
      try {
        targetUrl = new URL(link.href, window.location.href);
      } catch {
        return;
      }

      if (targetUrl.origin !== window.location.origin) return;

      const nextRoute = `${targetUrl.pathname}${targetUrl.search}`;

      if (
        nextRoute === currentRouteRef.current ||
        (targetUrl.hash && nextRoute === currentRouteRef.current)
      ) {
        return;
      }

      scheduleLoader();
    };

    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('click', handleClick);
      clearTimer(delayTimer);
      clearTimer(failSafeTimer);
    };
  }, [hideLoader]);

  useEffect(() => {
    const nextRoute = pathname + (search ? `?${search}` : '');

    if (!currentRouteRef.current) {
      currentRouteRef.current = nextRoute;
      return;
    }

    if (nextRoute === currentRouteRef.current) return;

    currentRouteRef.current = nextRoute;
    const clearAfterNavigation = setTimeout(hideLoader, 0);

    return () => clearTimeout(clearAfterNavigation);
  }, [hideLoader, pathname, search]);

  if (!showLoader) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading page"
      className="pointer-events-none fixed inset-x-0 top-0 h-0.5 overflow-hidden bg-[color:var(--app-border)]"
      style={{ zIndex: Z_INDEX.loading }}
    >
      <span className="sr-only">Loading page</span>
      <span className="block h-full w-2/3 animate-pulse rounded-full bg-[color:var(--app-accent)] motion-reduce:animate-none" />
    </div>
  );
}
