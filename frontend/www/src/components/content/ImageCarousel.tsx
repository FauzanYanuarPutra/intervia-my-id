'use client';

import { useState } from 'react';
import NextImage from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ImageCarousel({ images }: { images: string[] }) {
  const [idx, setIdx] = useState(0);
  if (!images.length) return null;

  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);

  return (
    <div className="relative overflow-hidden bg-[linear-gradient(180deg,rgba(239,246,255,0.96),rgba(226,232,240,0.78))] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.88))] aspect-video max-h-[360px] sm:max-h-[420px] lg:max-h-[520px]">
      <NextImage
        src={images[idx]}
        alt=""
        fill
        priority={idx === 0}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 960px"
        className="object-cover"
        unoptimized
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/12 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/28 to-transparent" />
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/88 text-slate-700 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.45)] backdrop-blur-sm transition hover:bg-white dark:bg-slate-950/82 dark:text-slate-100 dark:hover:bg-slate-950"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/88 text-slate-700 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.45)] backdrop-blur-sm transition hover:bg-white dark:bg-slate-950/82 dark:text-slate-100 dark:hover:bg-slate-950"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-white/74 px-2.5 py-1.5 shadow-[0_14px_26px_-22px_rgba(15,23,42,0.42)] backdrop-blur-sm dark:bg-slate-950/72">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === idx
                    ? 'w-5 bg-[color:var(--app-accent)]'
                    : 'bg-slate-300 hover:bg-slate-400 dark:bg-slate-700 dark:hover:bg-slate-500'
                }`}
                aria-label={`Image ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
