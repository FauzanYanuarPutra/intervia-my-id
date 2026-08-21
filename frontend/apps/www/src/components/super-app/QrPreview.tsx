'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';

type QrPreviewProps = {
  value: string;
  label: string;
  size?: number;
};

export function QrPreview({ value, label, size = 180 }: QrPreviewProps) {
  const [src, setSrc] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: size,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((next) => {
        if (!active) return;
        setError(null);
        setSrc(next);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setSrc('');
        setError(err instanceof Error ? err.message : 'Failed to render QR');
      });
    return () => {
      active = false;
    };
  }, [size, value]);

  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-3 shadow-sm border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
        {label}
      </p>
      <div className="mt-3 flex min-h-[180px] items-center justify-center rounded-2xl  text-[color:var(--app-accent)]">
        {src ? (
          <Image
            src={src}
            alt={label}
            width={size}
            height={size}
            unoptimized
            className="h-auto w-full max-w-[180px]"
          />
        ) : (
          <p className="px-4 text-center text-xs  text-[color:var(--app-accent)]">
            {error || 'Generating QR...'}
          </p>
        )}
      </div>
    </div>
  );
}

