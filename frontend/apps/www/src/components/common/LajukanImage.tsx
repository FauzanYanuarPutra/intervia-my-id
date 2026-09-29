'use client';

import Image, { type ImageProps } from 'next/image';
import { ImageOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { normalizeContentMediaUrl } from '@/lib/content/catalog';

type LajukanImageProps = Omit<ImageProps, 'src'> & {
  src?: ImageProps['src'] | null;
};

const OPTIMIZABLE_REMOTE_HOSTS = new Set([
  'lh3.googleusercontent.com',
  'images.unsplash.com',
  'commons.wikimedia.org',
  'upload.wikimedia.org',
  'images.pexels.com',
  'picsum.photos',
  'i.pravatar.cc',
  'i.vimeocdn.com',
  'www.lajukan.com',
  'lajukan.com',
]);

function isOptimizableRemoteUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    return OPTIMIZABLE_REMOTE_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function shouldBypassOptimizer(src: ImageProps['src'] | null | undefined) {
  if (typeof src !== 'string') return false;

  // Keep data/blob URLs completely client-side. Public relative media is
  // intentionally routed through Next's Image Optimizer so the browser can
  // receive AVIF/WebP at the requested dimensions instead of the original file.
  if (/^data:|^blob:/i.test(src)) return true;
  // Chat media is authenticated and must never be fetched by the public
  // optimizer without the viewer's room authorization context.
  if (src.startsWith('/api/chat/media/')) return true;
  if (src.startsWith('/')) return false;
  if (/^https?:\/\//i.test(src)) return !isOptimizableRemoteUrl(src);

  return true;
}

function normalizeImageSrc(
  src: ImageProps['src'] | null | undefined,
): ImageProps['src'] | null | undefined {
  if (typeof src !== 'string') return src;
  let value = normalizeContentMediaUrl(src);
  if (!value) return value;
  value = value.trim().replace(/^["']+|["']+$/g, '');
  if (!value) return value;

  if (value.startsWith('//')) value = 'https:' + value;

  // Canonical Lajukan absolute URLs are same-origin media. Collapse them to
  // relative paths so Next's optimizer treats them as local media.
  try {
    const parsed = new URL(value);
    if (
      ['www.lajukan.com', 'lajukan.com'].includes(parsed.hostname.toLowerCase())
    ) {
      return parsed.pathname + parsed.search + parsed.hash;
    }
  } catch {
    // Continue with the existing normalization rules below.
  }

  if (/^(https?:|data:|blob:)/i.test(value) || value.startsWith('/')) {
    return value;
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(value)) {
    return 'https://' + value;
  }
  return '/' + value.replace(/^\/+/, '');
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
          width: typeof width === 'number' ? String(width) + 'px' : width,
          height: typeof height === 'number' ? String(height) + 'px' : height,
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
      quality={props.quality ?? 72}
      unoptimized={unoptimized ?? bypassOptimizer}
      onError={event => {
        onError?.(event);
        setFailedKey(key);
      }}
    />
  );
}
