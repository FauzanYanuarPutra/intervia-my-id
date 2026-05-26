'use client';

import Image, { type ImageProps } from 'next/image';
import { ImageOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

type LajukanImageProps = Omit<ImageProps, 'src'> & {
  src?: ImageProps['src'] | null;
};

function shouldBypassOptimizer(src: ImageProps['src'] | null | undefined) {
  return typeof src === 'string' && /^(https?:)?\/\/|^data:|^blob:/i.test(src);
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
      style={style}
      className={cn(
        'flex items-center justify-center bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-300',
        fill && 'absolute inset-0 h-full w-full',
        !fill && 'min-h-16 min-w-16',
        className,
      )}
    >
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-white/72 shadow-sm ring-1 ring-black/5 dark:bg-slate-950/62 dark:ring-white/10 sm:h-16 sm:w-16">
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
  const key = useMemo(() => imageKey(src), [src]);
  const bypassOptimizer = shouldBypassOptimizer(src);
  const failed = !src || failedKey === key;

  if (!src || failed) {
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
      src={src}
      alt={alt}
      unoptimized={unoptimized ?? bypassOptimizer}
      onError={event => {
        onError?.(event);
        setFailedKey(key);
      }}
    />
  );
}
