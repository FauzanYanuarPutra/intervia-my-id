'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Z_INDEX } from './constants/z-index';

type TimerRef = React.MutableRefObject<ReturnType<typeof setTimeout> | null>;

export default function GlobalLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  const [showLoader, setShowLoader] = useState(true);

  const delayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minDisplayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failSafeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loaderVisibleRef = useRef(false);
  const currentRouteRef = useRef('');

  const DEBOUNCE_DELAY = 500;
  const MIN_DISPLAY = 200;
  const FAIL_SAFE_HIDE = 8000;

  const clearTimer = (timer: TimerRef) => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => {
    currentRouteRef.current = window.location.pathname + window.location.search;

    const timeout = setTimeout(() => {
      setShowLoader(false);
    }, 500);

    return () => {
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    const scheduleLoader = () => {
      clearTimer(delayTimer);

      delayTimer.current = setTimeout(() => {
        setShowLoader(true);
        loaderVisibleRef.current = true;
      }, DEBOUNCE_DELAY);

      clearTimer(failSafeTimer);

      failSafeTimer.current = setTimeout(() => {
        clearTimer(delayTimer);
        clearTimer(minDisplayTimer);
        loaderVisibleRef.current = false;
        setShowLoader(false);
      }, FAIL_SAFE_HIDE);
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
      clearTimer(minDisplayTimer);
      clearTimer(failSafeTimer);
    };
  }, []);

  useEffect(() => {
    const nextRoute = pathname + (search ? `?${search}` : '');

    if (!currentRouteRef.current) {
      currentRouteRef.current = nextRoute;
      return;
    }

    if (nextRoute === currentRouteRef.current) return;

    currentRouteRef.current = nextRoute;

    clearTimer(delayTimer);
    clearTimer(failSafeTimer);

    if (!loaderVisibleRef.current) return;

    clearTimer(minDisplayTimer);

    minDisplayTimer.current = setTimeout(() => {
      loaderVisibleRef.current = false;
      setShowLoader(false);
    }, MIN_DISPLAY);

    return () => {
      clearTimer(minDisplayTimer);
    };
  }, [pathname, search]);

  return (
    <AnimatePresence>
      {showLoader && (
        <motion.div
          key="global-loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_20%,_transparent)] backdrop-blur-md flex items-center justify-center"
          style={{ zIndex: Z_INDEX.loading }}
        >
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[color:var(--app-accent-border)] border-t-transparent" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}