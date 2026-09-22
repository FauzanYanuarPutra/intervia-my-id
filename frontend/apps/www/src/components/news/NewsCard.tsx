import { ArrowRight, Clock3, MapPin } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { LajukanNewsArticle } from '@/lib/news';
import { buildNewsPath } from '@/lib/news';
import { NewsMedia } from '@/components/news/NewsMedia';

type NewsCardVariant = 'hero' | 'grid' | 'compact';

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function kindLabel(article: LajukanNewsArticle, isId: boolean) {
  if (article.articleKind === 'analysis') return isId ? 'Analisis' : 'Analysis';
  if (article.articleKind === 'press_release') return isId ? 'Rilis' : 'Release';
  return isId ? 'Berita' : 'News';
}

export function NewsCard({
  article,
  locale,
  variant = 'grid',
  priority = false,
}: {
  article: LajukanNewsArticle;
  locale: string;
  variant?: NewsCardVariant;
  priority?: boolean;
}) {
  const isId = locale === 'id';
  const href = buildNewsPath(article.slug);

  if (variant === 'compact') {
    return (
      <Link
        href={href}
        className="group grid min-w-0 grid-cols-[96px_minmax(0,1fr)] gap-3 rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-2.5 text-left transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-surface-muted)]"
      >
        <NewsMedia
          article={article}
          variant="thumb"
          showLabels={false}
          className="w-full rounded-[12px]"
        />
        <div className="min-w-0 py-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="max-w-[52%] truncate text-[9px] font-black uppercase tracking-[0.09em] text-[color:var(--app-accent)]">
              {article.category}
            </span>
            <span className="truncate text-[9px] font-semibold text-[color:var(--app-text-soft)]">
              {kindLabel(article, isId)}
            </span>
          </div>
          <h3 className="mt-1 line-clamp-2 text-[12px] font-extrabold leading-[17px] tracking-[-0.018em] text-[color:var(--app-text)] group-hover:text-[color:var(--app-accent)] sm:text-[13px]">
            {article.title}
          </h3>
          <div className="mt-1.5 flex min-w-0 items-center gap-1 text-[9px] font-semibold text-[color:var(--app-text-soft)]">
            <Clock3 className="h-3 w-3 shrink-0" />
            <span className="truncate">{formatDate(article.publishedAt, locale) || (isId ? 'Terbaru' : 'Latest')}</span>
          </div>
        </div>
      </Link>
    );
  }

  if (variant === 'hero') {
    return (
      <Link
        href={href}
        className="group flex min-w-0 h-full flex-col overflow-hidden rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] text-left shadow-[0_16px_38px_-32px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[0_22px_44px_-34px_rgba(15,23,42,0.32)]"
      >
        <NewsMedia
          article={article}
          variant="hero"
          priority={priority}
          showLabels={false}
          className="w-full"
        />
        <div className="flex-1 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.1em]">
            <span className="text-[color:var(--app-accent)]">{article.category}</span>
            <span className="text-slate-300">•</span>
            <span className="text-[color:var(--app-text-soft)]">{kindLabel(article, isId)}</span>
          </div>
          <h2 className="mt-1.5 line-clamp-3 text-[21px] font-black leading-[25px] tracking-[-0.035em] text-[color:var(--app-text)] sm:text-[26px] sm:leading-[30px]">
            {article.title}
          </h2>
          {article.summary ? (
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-[color:var(--app-text-soft)] sm:text-sm sm:leading-6">
              {article.summary}
            </p>
          ) : null}
          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-semibold text-[color:var(--app-text-soft)]">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3 w-3" />
              {formatDate(article.publishedAt, locale) || (isId ? 'Terbaru' : 'Latest')}
            </span>
            {article.location ? (
              <span className="inline-flex min-w-0 items-center gap-1 truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{article.location}</span>
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] text-left transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-sm"
    >
      <NewsMedia article={article} variant="card" showLabels={false} className="w-full" />
      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.1em]">
          <span className="text-[color:var(--app-accent)]">{article.category}</span>
          <span className="text-slate-300">•</span>
          <span className="text-[color:var(--app-text-soft)]">{kindLabel(article, isId)}</span>
        </div>
        <h3 className="mt-1.5 line-clamp-3 text-[14px] font-black leading-5 tracking-[-0.018em] text-[color:var(--app-text)] group-hover:text-[color:var(--app-accent)] sm:text-[15px]">
          {article.title}
        </h3>
        {article.summary ? (
          <p className="mt-1.5 line-clamp-3 text-[10px] leading-4 text-[color:var(--app-text-soft)] sm:text-xs sm:leading-5">
            {article.summary}
          </p>
        ) : null}
        <div className="mt-auto pt-3 flex items-center justify-between gap-2 text-[9px] font-bold text-[color:var(--app-text-soft)]">
          <span className="min-w-0 truncate">{article.location || article.byline}</span>
          <span className="shrink-0">{formatDate(article.publishedAt, locale)}</span>
        </div>
      </div>
      <div className="flex items-center justify-end border-t border-[color:var(--app-border)] px-3.5 py-2 text-[10px] font-extrabold text-[color:var(--app-accent)] sm:px-4">
        {isId ? 'Baca berita' : 'Read story'}
        <ArrowRight className="ml-1 h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
