'use client';

import Image, { type ImageProps } from 'next/image';
import { ImageOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { normalizeContentMediaUrl } from '@/lib/content/catalog';

type LajukanImageProps = Omit<ImageProps, 'src'> & {
  src?: ImageProps['src'] | null;
};

function shouldBypassOptimizer(src: ImageProps['src'] | null | undefined) {
  return (
    typeof src === 'string' &&
    (/^(https?:)?\/\/|^data:|^blob:/i.test(src) ||
      src.startsWith('/uploads/') ||
      src.startsWith('/api/content/media/') ||
      src.startsWith('/api/chat/media/') ||
      src.startsWith('/api/forum/media/'))
  );
}

function normalizeImageSrc(
  src: ImageProps['src'] | null | undefined,
): ImageProps['src'] | null | undefined {
  if (typeof src !== 'string') return src;
  let value = normalizeContentMediaUrl(src);
  if (!value) return value;
  value = value.trim().replace(/^["'`]+|["'`]+$/g, '');
  if (!value) return value;

  if (value.startsWith('//')) return `https:${value}`;
  if (
    /^(https?:|data:|blob:)/i.test(value) ||
    value.startsWith('/')
  ) {
    return value;
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(value)) {
    return `https://${value}`;
  }
  return `/${value.replace(/^\/+/, '')}`;
}

function imageKey(src: ImageProps['src'] | null | undefined) {
  if (!src) return '';
  if (typeof src === 'string') return src;
  if ('src' in src) return src.src;
  return String(src);
}

function FallbackImage({
  alt,
  fill,
  width,
  height,
  className,
}: Pick<LajukanImageProps, 'alt' | 'fill' | 'width' | 'height' | 'className'>) {
  const style =
    !fill && width && height
      ? {
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
        }
      : undefined;

  return (
    <div
      role="img"
      aria-label={alt || 'Gambar tidak tersedia'}
      aria-hidden={alt ? undefined : 'true'}
      style={style}
      className={cn(
        'flex items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#e5eef7_0%,#f3f7fb_48%,#edf7f7_100%)] text-slate-500 dark:bg-[linear-gradient(135deg,#111827_0%,#1f2937_48%,#0f172a_100%)] dark:text-slate-300',
        fill && 'absolute inset-0 h-full w-full',
        !fill && 'min-h-16 min-w-16',
        className,
      )}
    >
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-white/75 shadow-sm ring-1 ring-black/5 dark:bg-slate-950/62 dark:ring-white/10 sm:h-16 sm:w-16">
        <ImageOff className="h-8 w-8 sm:h-9 sm:w-9" />
      </span>
    </div>
  );
}

export function LajukanImage({
  src,
  alt,
  unoptimized,
  onError,
  ...props
}: LajukanImageProps) {
  const [failedKey, setFailedKey] = useState('');
  const normalizedSrc = useMemo(() => normalizeImageSrc(src), [src]);
  const key = useMemo(() => imageKey(normalizedSrc), [normalizedSrc]);
  const bypassOptimizer = shouldBypassOptimizer(normalizedSrc);
  const failed = !normalizedSrc || failedKey === key;

  if (!normalizedSrc || failed) {
    return (
      <FallbackImage
        alt={alt}
        fill={props.fill}
        width={props.width}
        height={props.height}
        className={props.className}
      />
    );
  }

  return (
    <Image
      {...props}
      src={normalizedSrc}
      alt={alt}
      unoptimized={unoptimized ?? bypassOptimizer}
      onError={event => {
        onError?.(event);
        setFailedKey(key);
      }}
    />
  );
}
