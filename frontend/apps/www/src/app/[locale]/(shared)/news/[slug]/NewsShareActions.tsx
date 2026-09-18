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
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
    void trackShare('copy_link');
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
    <div className="mt-4 flex flex-wrap gap-2" aria-label={isId ? 'Bagikan berita' : 'Share article'}>
      <button
        type="button"
        onClick={() => void shareArticle()}
        className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200"
      >
        <Share2 className="h-3.5 w-3.5" />
        {isId ? 'Bagikan' : 'Share'}
      </button>
      <button
        type="button"
        onClick={() => void copyLink()}
        className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? (isId ? 'Tersalin' : 'Copied') : (isId ? 'Salin link' : 'Copy link')}
      </button>
    </div>
  );
}
