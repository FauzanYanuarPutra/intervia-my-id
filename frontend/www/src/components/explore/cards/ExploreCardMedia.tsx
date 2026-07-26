import Image from 'next/image';

export function ExploreCardMedia({
  src,
  alt,
  attribution,
  sourceHref,
  className = '',
}: {
  src: string | null;
  alt: string;
  attribution?: string;
  sourceHref?: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-[color:var(--app-surface-muted)] text-xs font-bold text-[color:var(--app-text-soft)] ${className}`}
        aria-hidden="true"
      >
        LAJUKAN
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
