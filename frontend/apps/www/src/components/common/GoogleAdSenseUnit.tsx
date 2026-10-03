'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const ADSENSE_CLIENT = 'ca-pub-7020398942986974';
const DEFAULT_SLOT = '2055669263';

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
  const insRef = useRef<HTMLElement | null>(null);
  const pushedRef = useRef(false);
  const [adState, setAdState] = useState<'pending' | 'filled' | 'unfilled'>('pending');

  useEffect(() => {
    pushedRef.current = false;
  }, [pathname, slot]);

  useEffect(() => {
    const ins = insRef.current;
    if (!ins) return;

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

    const timer = window.setInterval(readStatus, 1000);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [pathname, slot]);

  useEffect(() => {
    if (pushedRef.current) return;

    const pushAd = () => {
      try {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
        pushedRef.current = true;
      } catch {
        pushedRef.current = false;
      }
    };

    if (
      typeof window !== 'undefined' &&
      document.querySelector(
        'script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]',
      )
    ) {
      pushAd();
      return;
    }

    const timer = window.setTimeout(pushAd, 250);
    return () => window.clearTimeout(timer);
  }, [pathname, slot]);

  if (adState === 'unfilled') return null;

  return (
    <div
      className={'w-full min-w-0 overflow-hidden ' + className}
      data-ad-placement="adsense-autorelaxed"
      data-ad-slot={slot}
      data-ad-state={adState}
      aria-hidden={adState === 'unfilled' ? true : undefined}
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
