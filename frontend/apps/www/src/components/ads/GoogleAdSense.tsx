'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

export default function GoogleAdSense() {
  useEffect(() => {
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {
      // AdSense may be unavailable in local/dev environments.
    }
  }, []);

  return (
    <div className="w-full px-4 py-3" aria-label="Advertisement">
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-7020398942986974"
        data-ad-slot="4886770179"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
