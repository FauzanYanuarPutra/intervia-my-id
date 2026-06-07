'use client';

import { MediaPreviewCarousel } from '@/components/common/MediaPreviewCarousel';

export default function ImageCarousel({ images }: { images: string[] }) {
  if (!images.length) return null;

  return (
    <MediaPreviewCarousel
      items={images}
      alt="Listing media"
      aspectClassName="aspect-video max-h-[360px] sm:max-h-[420px] lg:max-h-[520px]"
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 960px"
      controls
      lightbox
      priority
    />
  );
}
