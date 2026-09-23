'use client';

import { LajukanImage as Image } from '@/components/common/LajukanImage';
import { MediaPreviewCarousel } from '@/components/common/MediaPreviewCarousel';
import { useEffect, useMemo, useState } from 'react';
import { Expand, ImageIcon, PlayCircle, X } from 'lucide-react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import type { CommunityFeedMedia } from '@/lib/community/types';
import { cn } from '@/lib/utils';
import {
  isVideoMedia,
  normalizeCommunityMediaItems,
  resolveCommunityMediaSrc,
} from './community-feed-helpers';

export function CommunityImageFrame({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = resolveCommunityMediaSrc(src);

  if (!resolvedSrc || failed) {
    return (
      <div
        className={cn(
          'grid place-items-center bg-[linear-gradient(135deg,#ecfdf5_0%,#f8fafc_48%,#eff6ff_100%)] text-center',
          className,
        )}
      >
        <div className="px-6">
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-[color:var(--app-accent)] shadow-[0_16px_32px_-28px_rgba(15,23,42,0.2)]">
            <ImageIcon className="h-5 w-5" />
          </span>
          <p className="mt-3 line-clamp-2 text-sm font-bold text-[color:var(--app-text)]">
            {alt}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <Image
        src={resolvedSrc}
        alt={alt}
        fill
        sizes="(max-width: 640px) 100vw, 720px"
        className="object-cover"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export function CommunityVideoFrame({
  src,
  alt,
  isId,
  variant = 'feed',
  className,
}: {
  src?: string | null;
  alt: string;
  isId: boolean;
  variant?: 'feed' | 'tile' | 'thumb';
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = resolveCommunityMediaSrc(src);
  const isFeed = variant === 'feed';
  const isThumb = variant === 'thumb';

  if (!resolvedSrc || failed) {
    return (
      <div
        className={cn(
          'grid place-items-center bg-[linear-gradient(135deg,#ecfdf5_0%,#f8fafc_48%,#eef2ff_100%)] text-center',
          isFeed ? 'min-h-[220px]' : 'h-full w-full',
          className,
        )}
      >
        <div className="px-5">
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-[color:var(--app-accent)] shadow-sm ring-1 ring-emerald-100">
            <PlayCircle className="h-5 w-5" />
          </span>
          <p className="mt-2 line-clamp-2 text-xs font-bold text-[color:var(--app-text)]">
            {isId
              ? 'Preview video belum tersedia'
              : 'Video preview unavailable'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-slate-950',
        isFeed
          ? 'border-y border-slate-900/5 px-2 py-2 sm:px-2'
          : 'h-full w-full rounded-[18px]',
        className,
      )}
    >
      {isFeed ? (
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_20%,rgba(16,185,129,0.24),transparent_34%),radial-gradient(circle_at_76%_78%,rgba(59,130,246,0.22),transparent_32%),linear-gradient(135deg,#020617,#08111f)]"
          aria-hidden="true"
        />
      ) : null}
      <div
        className={cn(
          'relative z-10 overflow-hidden bg-black shadow-[0_18px_44px_-30px_rgba(2,6,23,0.8)]',
          isFeed
            ? 'mx-auto aspect-[4/5] max-h-[540px] w-full max-w-[430px] rounded-[22px] sm:aspect-[9/16]'
            : 'h-full w-full',
        )}
      >
        <video
          src={resolvedSrc}
          aria-label={alt}
          className={cn(
            'h-full w-full bg-black',
            isFeed ? 'object-cover object-left' : 'object-contain',
          )}
          controls={!isThumb}
          muted={isThumb}
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
        />
        <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/62 px-2.5 py-1 text-[11px] font-bold text-white ">
          <PlayCircle className="h-3.5 w-3.5" />
          {isThumb ? 'Video' : isId ? 'Putar video' : 'Play video'}
        </span>
      </div>
    </div>
  );
}

function CommunityMediaTile({
  item,
  title,
  isId,
  index,
  total,
  extraCount,
  onOpen,
  className,
  imageFit = 'cover',
}: {
  item: CommunityFeedMedia;
  title: string;
  isId: boolean;
  index: number;
  total: number;
  extraCount?: number;
  onOpen: () => void;
  className?: string;
  imageFit?: 'cover' | 'contain';
}) {
  const isVideo = item.type === 'video' || isVideoMedia(item.src);
  const label =
    total > 1
      ? isId
        ? `Buka media ${index + 1} dari ${total}`
        : `Open media ${index + 1} of ${total}`
      : isId
        ? 'Buka preview media'
        : 'Open media preview';

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group/media relative block h-full min-h-0 w-full overflow-hidden bg-slate-100 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] dark:bg-slate-950',
        className,
      )}
      aria-label={label}
    >
      {isVideo ? (
        <>
          <video
            src={item.src}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full bg-slate-950 object-cover"
          />
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/62 px-2 py-1 text-[10px] font-bold text-white ">
            <PlayCircle className="h-3.5 w-3.5" />
            Video
          </span>
        </>
      ) : (
        <Image
          src={item.src}
          alt={item.alt || title}
          fill
          sizes="(max-width: 640px) 100vw, 720px"
          className={cn(
            'transition duration-500 group-hover/media:scale-[1.025]',
            imageFit === 'contain' ? 'object-contain' : 'object-cover',
          )}
        />
      )}

      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/24 via-transparent to-transparent opacity-80" />
      <span className="pointer-events-none absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/44 text-white opacity-0  transition group-hover/media:opacity-100">
        <Expand className="h-4 w-4" />
      </span>

      {extraCount && extraCount > 0 ? (
        <span className="absolute inset-0 grid place-items-center bg-black/54 text-xl font-bold text-white  sm:text-2xl">
          +{extraCount}
        </span>
      ) : null}
    </button>
  );
}

export function CommunityMediaGalleryPreview({
  mediaItems,
  title,
  isId,
  variant = 'feed',
}: {
  mediaItems: Array<CommunityFeedMedia | string | null | undefined>;
  title: string;
  isId: boolean;
  variant?: 'feed' | 'detail';
}) {
  const items = useMemo(
    () => normalizeCommunityMediaItems(mediaItems, title),
    [mediaItems, title],
  );
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useBodyScrollLock(lightboxIndex != null);

  if (items.length === 0) return null;

  const isDetail = variant === 'detail';
  const visibleItems = items.slice(0, 3);
  const extraCount = Math.max(0, items.length - visibleItems.length);
  const shellClass = cn(
    'relative overflow-hidden bg-slate-100 dark:bg-slate-950',
    isDetail
      ? 'rounded-[22px] ring-1 ring-slate-900/5'
      : 'border-y border-slate-900/5',
  );
  const frameClass =
    items.length === 1
      ? cn(
          'relative w-full',
          isDetail
            ? 'aspect-[4/3] sm:aspect-[16/10] lg:aspect-[16/9]'
            : 'aspect-[4/3] sm:aspect-[16/9]',
        )
      : cn(
          'grid w-full gap-1 bg-slate-200 p-1 dark:bg-slate-900',
          'aspect-[4/3] sm:aspect-[16/9]',
          items.length === 2 ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2',
        );

  return (
    <>
      <div className={shellClass}>
        <div className={frameClass}>
          {visibleItems.map((item, index) => (
            <CommunityMediaTile
              key={`${item.src}-${index}`}
              item={item}
              title={title}
              isId={isId}
              index={index}
              total={items.length}
              extraCount={
                index === visibleItems.length - 1 ? extraCount : undefined
              }
              onOpen={() => setLightboxIndex(index)}
              className={cn(
                items.length === 1 && 'absolute inset-0',
                items.length >= 3 && index === 0 && 'row-span-2',
                items.length >= 3 && index > 0 && 'min-h-0',
                items.length > 1 && 'rounded-[14px]',
              )}
              imageFit={isDetail && items.length === 1 ? 'contain' : 'cover'}
            />
          ))}
        </div>

        {items.length > 1 ? (
          <span className="absolute left-3 top-3 rounded-full bg-black/62 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm ">
            {items.length} {isId ? 'media' : 'media'}
          </span>
        ) : null}
      </div>

      {lightboxIndex != null ? (
        <CommunityMediaLightbox
          items={items}
          title={title}
          isId={isId}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      ) : null}
    </>
  );
}

function CommunityMediaLightbox({
  items,
  title,
  isId,
  initialIndex,
  onClose,
  onIndexChange,
}: {
  items: CommunityFeedMedia[];
  title: string;
  isId: boolean;
  initialIndex: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="ui-layer-preview fixed inset-0 z-[100] flex h-[var(--app-visual-viewport-height)] w-screen items-center justify-center overflow-hidden bg-black/96"
      role="dialog"
      aria-modal="true"
      aria-label={isId ? 'Preview media' : 'Media preview'}
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-24 bg-gradient-to-b from-black/75 to-transparent" />

      <header className="absolute inset-x-0 top-0 z-[3] flex items-center gap-3 px-3 pb-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-white sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold tracking-[-0.01em] sm:text-[15px]">
            {title}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-white/65">
            {initialIndex + 1} / {items.length}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/12 text-white ring-1 ring-white/15 backdrop-blur-md transition hover:bg-white/20 active:scale-95"
          aria-label={isId ? 'Tutup preview' : 'Close preview'}
        >
          <X className="h-6 w-6" />
        </button>
      </header>

      <div className="h-[calc(var(--app-visual-viewport-height)-7.5rem)] w-full max-w-[1500px] px-0 sm:h-[calc(var(--app-visual-viewport-height)-8.5rem)] sm:px-8">
        <MediaPreviewCarousel
          items={items}
          alt={title}
          aspectClassName="h-full w-full"
          className="rounded-none bg-transparent sm:rounded-[18px]"
          viewportClassName="rounded-none sm:rounded-[18px]"
          sizes="100vw"
          controls
          lightbox={false}
          keyboardControls
          showCounter={false}
          showDots
          objectFit="contain"
          initialIndex={initialIndex}
          onIndexChange={onIndexChange}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-8">
        <span className="rounded-full bg-black/45 px-3 py-1.5 text-[10px] font-semibold text-white/75 ring-1 ring-white/10 backdrop-blur-md">
          {items.length} {isId ? 'media' : 'media'}
        </span>
      </div>
    </div>
  );
}

export function CommunityMediaPreview({
  media,
  mediaItems,
  title,
  isId,
}: {
  media?: CommunityFeedMedia | null;
  mediaItems?: CommunityFeedMedia[];
  title: string;
  isId: boolean;
}) {
  const galleryItems =
    mediaItems && mediaItems.length > 0 ? mediaItems : [media];
  if (galleryItems.filter(Boolean).length > 1) {
    return (
      <CommunityMediaGalleryPreview
        mediaItems={galleryItems}
        title={title}
        isId={isId}
      />
    );
  }

  if (!media) return null;

  if (media.type === 'video') {
    return (
      <CommunityVideoFrame
        src={media.src}
        alt={media.alt || title}
        isId={isId}
        variant="feed"
      />
    );
  }

  return (
    <CommunityMediaGalleryPreview
      mediaItems={galleryItems}
      title={title}
      isId={isId}
    />
  );
}

