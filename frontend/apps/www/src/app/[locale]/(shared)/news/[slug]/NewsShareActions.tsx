'use client';

import { useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { trackLajukanEvent } from '@/lib/analytics/lajukanEvents';

type Props = {
  articleId: string;
  slug: string;
  category: string;
  title: string;
  isId: boolean;
};

export default function NewsShareActions({
  articleId,
  slug,
  category,
  title,
  isId,
}: Props) {
  const [copied, setCopied] = useState(false);

  const trackShare = (method: string) =>
    trackLajukanEvent('news.share_clicked', {
      entityType: 'news',
      entityId: articleId,
      source: 'news_article',
      properties: { slug, category, method },
    });

  const copyLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
      } else {
        window.prompt(
          isId ? 'Salin tautan berita:' : 'Copy article link:',
          window.location.href,
        );
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      void trackShare('copy_link');
    } catch {
      window.prompt(
        isId ? 'Salin tautan berita:' : 'Copy article link:',
        window.location.href,
      );
    }
  };

  const shareArticle = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url: window.location.href });
        void trackShare('native_share');
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    await copyLink();
  };

  return (
    <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center" aria-label={isId ? 'Bagikan berita' : 'Share article'}>
      <button
        type="button"
        onClick={() => void shareArticle()}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-black text-white shadow-[0_10px_24px_-16px_rgba(4,120,87,0.75)] transition hover:-translate-y-0.5 hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 dark:focus-visible:ring-emerald-900"
      >
        <Share2 className="h-4 w-4" />
        {isId ? 'Bagikan' : 'Share'}
      </button>

      <button
        type="button"
        onClick={() => void copyLink()}
        className={
          copied
            ? 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-xs font-extrabold text-emerald-800 transition dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200'
            : 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-extrabold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.07]'
        }
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? (isId ? 'Tautan tersalin' : 'Link copied') : (isId ? 'Salin tautan' : 'Copy link')}
      </button>

      <span className="hidden text-[10px] font-semibold text-slate-400 sm:inline">
        {isId ? 'Bagikan ke WhatsApp, chat, atau media sosial.' : 'Share to chat or social apps.'}
      </span>
    </div>
  );
}
