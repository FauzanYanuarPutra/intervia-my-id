'use client';

import { useEffect, useRef } from 'react';
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
  const pushedRef = useRef(false);

  useEffect(() => {
    pushedRef.current = false;
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

  return (
    <div
      className={'w-full min-w-0 overflow-hidden ' + className}
      data-ad-placement="adsense-autorelaxed"
      data-ad-slot={slot}
    >
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-format="autorelaxed"
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
      />
    </div>
  );
}

export default GoogleAdSenseUnit;
