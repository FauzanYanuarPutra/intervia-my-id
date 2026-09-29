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
  if (src.startsWith('/')) return false;
  if (/^https?:\/\//i.test(src)) return !isOptimizableRemoteUrl(src);

  return true;
}

function normalizeImageSrc(
