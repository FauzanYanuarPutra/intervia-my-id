'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const ADSENSE_CLIENT = 'ca-pub-7020398942986974';
const DEFAULT_SLOT = '4886770179';

type GoogleAdSenseUnitProps = {
  slot?: string;
  className?: string;
};

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function GoogleAdSenseUnit({
  slot = DEFAULT_SLOT,
  className = '',
}: GoogleAdSenseUnitProps) {
  const pathname = usePathname();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const insRef = useRef<HTMLModElement | null>(null);
  const pushedRef = useRef(false);
  const retryTimerRef = useRef<number | null>(null);
  const [adState, setAdState] = useState<'pending' | 'filled' | 'unfilled'>('pending');

  useEffect(() => {
    pushedRef.current = false;
    setAdState('pending');
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    return () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [pathname, slot]);

  useEffect(() => {
    const host = hostRef.current;
    const ins = insRef.current;
    if (!host || !ins) return;

    const readStatus = () => {
      const status = ins.getAttribute('data-ad-status');
      if (status === 'unfilled') {
        setAdState('unfilled');
      } else if (status === 'filled') {
        setAdState('filled');
      }
    };

    readStatus();
    const observer = new MutationObserver(readStatus);
    observer.observe(ins, {
      attributes: true,
      attributeFilter: ['data-ad-status'],
    });

    return () => observer.disconnect();
  }, [pathname, slot]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || pushedRef.current || adState === 'unfilled') return;

    const pushAd = () => {
      if (pushedRef.current) return;
      try {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
        pushedRef.current = true;
      } catch {
        // AdSense can fail transiently; keep the slot eligible for a later
        // observer callback without blocking the rest of the page.
      }
    };

    const observeTarget = () => {
      if (pushedRef.current) return;

      const scriptReady =
        typeof window !== 'undefined' &&
        Boolean(
          document.querySelector(
            'script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]',
          ),
        );

      if (!scriptReady) {
        retryTimerRef.current = window.setTimeout(observeTarget, 500);
        return;
      }

      retryTimerRef.current = null;
      pushAd();
    };

    if (typeof IntersectionObserver === 'undefined') {
      observeTarget();
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          observeTarget();
          observer.disconnect();
        }
      },
      { rootMargin: '320px 0px' },
    );

    observer.observe(host);
    return () => {
      observer.disconnect();
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [adState, pathname, slot]);

  if (adState === 'unfilled') return null;

  return (
    <div
      ref={hostRef}
      className={
        adState === 'pending'
          ? 'pointer-events-none h-px w-full min-w-0 overflow-hidden opacity-0 ' + className
          : 'w-full min-w-0 overflow-hidden ' + className
      }
      data-ad-placement="adsense-autorelaxed"
      data-ad-slot={slot}
      data-ad-state={adState}
      aria-hidden={adState === 'pending' ? true : undefined}
    >
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block', minHeight: 0 }}
        data-ad-format="auto"
        data-full-width-responsive="true"
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
      />
    </div>
  );
}

export default GoogleAdSenseUnit;
