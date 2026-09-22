'use client';

import { Newspaper } from 'lucide-react';
import type { LajukanNewsArticle } from '@/lib/news';

type NewsMediaVariant = 'hero' | 'card' | 'thumb' | 'detail';

function variantClass(variant: NewsMediaVariant): string {
  if (variant === 'hero') return 'aspect-[16/8] sm:aspect-[16/7]';
  if (variant === 'thumb') return 'aspect-[4/3]';
  if (variant === 'detail') return 'aspect-[16/9]';
  return 'aspect-[16/10]';
}

export function NewsMedia({
  article,
  variant = 'card',
  priority = false,
  className = '',
  showLabels = true,
}: {
  article: LajukanNewsArticle;
  variant?: NewsMediaVariant;
  priority?: boolean;
  className?: string;
  showLabels?: boolean;
}) {
  const [failed, setFailed] = React.useState(false);
  const showImage = Boolean(article.coverImage) && !failed;

  return (
    <div className={'group relative overflow-hidden bg-slate-100 dark:bg-slate-800 ' + variantClass(variant) + ' ' + className}>
      {showImage ? (
        <img
          src={article.coverImage as string}
          alt={variant === 'thumb' ? '' : article.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : null}

      {!showImage ? (
        <div className="absolute inset-0 flex items-center justify-between gap-4 bg-[linear-gradient(135deg,#ecfdf5_0%,#f8fafc_58%,#fff7ed_100%)] p-4 dark:bg-[linear-gradient(135deg,#082319_0%,#0f172a_62%,#1c1917_100%)] sm:p-5">
          <div className="min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-emerald-700 text-sm font-black text-white shadow-sm">L</div>
            <p className="mt-2 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-800 dark:text-emerald-300">Lajukan News</p>
            <p className="mt-1 truncate text-xs font-bold text-slate-600 dark:text-slate-300">{article.category}</p>
          </div>
          <Newspaper className="h-9 w-9 shrink-0 text-emerald-700/20 dark:text-emerald-300/20" />
        </div>
      ) : null}

      {showImage ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
      ) : null}

      {showLabels ? (
        <div className="absolute left-3 top-3 flex min-w-0 items-center gap-1.5">
          <span className="max-w-[48%] truncate rounded-full bg-white/92 px-2 py-1 text-[9px] font-extrabold text-emerald-800 shadow-sm backdrop-blur dark:bg-slate-950/90 dark:text-emerald-300">
            {article.category}
          </span>
          <span className="max-w-[45%] truncate rounded-full bg-black/50 px-2 py-1 text-[9px] font-bold text-white backdrop-blur">
            {article.articleKind === 'analysis'
              ? article.language === 'id' ? 'Analisis' : 'Analysis'
              : article.articleKind === 'press_release'
                ? article.language === 'id' ? 'Rilis' : 'Press release'
                : article.language === 'id' ? 'Berita' : 'News'}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function NewsArticleMedia({
  article,
  isId,
}: {
  article: LajukanNewsArticle;
  isId: boolean;
}) {
  const [failed, setFailed] = React.useState(false);
  const showImage = Boolean(article.coverImage) && !failed;

  return (
    <div className="overflow-hidden rounded-[24px] border border-emerald-100 bg-slate-100 dark:border-white/10 dark:bg-slate-800">
      {showImage ? (
        <>
          <img
            src={article.coverImage as string}
            alt={article.title}
            className="aspect-[16/9] w-full object-cover"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            onError={() => setFailed(true)}
          />
          <p className="px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {isId ? 'Media utama artikel' : 'Article featured media'}
          </p>
        </>
      ) : (
        <div className="flex min-h-36 items-center justify-between gap-5 bg-[linear-gradient(135deg,#ecfdf5_0%,#f8fafc_58%,#fff7ed_100%)] p-5 dark:bg-[linear-gradient(135deg,#06261b_0%,#0f172a_62%,#1c1917_100%)] sm:min-h-40 sm:p-7">
          <div className="min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-emerald-700 text-sm font-black text-white shadow-sm">L</div>
            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800 dark:text-emerald-300">Lajukan News</p>
            <p className="mt-1 text-sm font-black text-slate-700 dark:text-slate-200">{article.category}</p>
            <p className="mt-1 max-w-lg text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
              {isId ? 'Artikel ini tidak menggunakan gambar sampul.' : 'This article does not use a cover image.'}
            </p>
          </div>
          <Newspaper className="h-12 w-12 shrink-0 text-emerald-700/20 dark:text-emerald-300/20" />
        </div>
      )}
    </div>
  );
}
