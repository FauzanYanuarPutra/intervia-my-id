'use client';

import Image from 'next/image';
import { ImageIcon } from 'lucide-react';
import { useState } from 'react';

export function ExploreCardMedia({
  src,
  alt,
  attribution,
  sourceHref,
  fallbackLabel,
  className = '',
}: {
  src: string | null;
  alt: string;
  attribution?: string;
  sourceHref?: string;
  fallbackLabel?: string;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageFailed = Boolean(src && failedSrc === src);

  if (!src || imageFailed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-[linear-gradient(145deg,var(--app-surface-muted),var(--app-surface-strong))] px-3 text-center text-[11px] font-bold text-[color:var(--app-text-soft)] ${className}`}
        aria-hidden="true"
      >
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--app-surface-strong)] shadow-sm">
          <ImageIcon className="h-4 w-4" />
        </span>
        {fallbackLabel || 'LAJUKAN'}
      </div>
    );
  }

  const isGoogleMaps = attribution === 'Google Maps';

  return (
    <div
      className={`relative overflow-hidden bg-[color:var(--app-surface-muted)] ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        sizes="(max-width: 640px) 45vw, 260px"
        className="object-cover"
        onError={() => setFailedSrc(src)}
      />
      {attribution ? (
        sourceHref ? (
          <a
            href={sourceHref}
            target="_blank"
            rel="noopener noreferrer"
            translate={isGoogleMaps ? 'no' : undefined}
            className={`absolute bottom-1 left-1 z-20 max-w-[calc(100%-0.5rem)] truncate rounded bg-black/70 px-1.5 py-0.5 text-white shadow-sm ${
              isGoogleMaps
                ? 'text-xs font-normal'
                : 'text-[9px] font-semibold uppercase'
            }`}
          >
            {attribution}
          </a>
        ) : (
          <span
            translate={isGoogleMaps ? 'no' : undefined}
            className={`absolute bottom-1 left-1 max-w-[calc(100%-0.5rem)] truncate rounded bg-black/70 px-1.5 py-0.5 text-white shadow-sm ${
              isGoogleMaps
                ? 'text-xs font-normal'
                : 'text-[9px] font-semibold uppercase'
            }`}
          >
            {attribution}
          </span>
        )
      ) : null}
    </div>
  );
}
