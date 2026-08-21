'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect } from 'react';

const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

function resetPageScroll() {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

export default function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return undefined;

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useIsomorphicLayoutEffect(() => {
    resetPageScroll();
    const raf = window.requestAnimationFrame(resetPageScroll);
    return () => window.cancelAnimationFrame(raf);
  }, [pathname]);

  return null;
}
