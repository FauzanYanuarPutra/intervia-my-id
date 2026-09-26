import type { Metadata } from 'next';
import { BookOpenText, CalendarDays, ExternalLink, Hash, MapPin, Timer } from 'lucide-react';
import { notFound, permanentRedirect } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import {
  buildNewsArticleJsonLd,
  buildNewsBreadcrumbJsonLd,
  buildNewsFacetPath,
  buildNewsPath,
  buildNewsUrl,
  getPublishedNewsArticle,
  getRelatedNewsArticles,
} from '@/lib/news';
import { NewsArticleMedia } from '@/components/news/NewsMedia';
import { NewsCarousel } from '@/components/news/NewsCarousel';
import { serializeJsonLd } from '@/lib/seo/jsonLd';
import { absoluteNewsMediaUrl } from '@/lib/newsMediaUrl';
import { plainTextToNewsHtml, sanitizeNewsRichText } from '@/lib/newsRichText';
import NewsAnalytics from './NewsAnalytics';
import NewsShareActions from './NewsShareActions';

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = await getPublishedNewsArticle(slug);
  if (!article) return { robots: { index: false, follow: true } };

  const isRetracted = article.editorialStatus === 'retracted';
  const description = isRetracted
    ? locale === 'id'
      ? 'Artikel ini telah ditarik dari publikasi Lajukan News.'
      : 'This article has been retracted from Lajukan News.'
    : article.summary || article.body.slice(0, 160);

  return {
    title: `${article.title}${isRetracted ? (locale === 'id' ? ' — Ditarik' : ' — Retracted') : ''} | Lajukan News`,
    description,
    robots: {
      index: !isRetracted,
      follow: true,
      googleBot: {
        index: !isRetracted,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    alternates: {
      canonical: buildNewsUrl(article.language, article.slug),
      languages: {
        [article.language]: buildNewsUrl(article.language, article.slug),
        'x-default': buildNewsUrl(article.language, article.slug),
      },
    },
    openGraph: {
      title: article.title,
      description,
      url: buildNewsUrl(article.language, article.slug),
      siteName: 'Lajukan',
      type: 'article',
      locale: article.language === 'en' ? 'en_US' : 'id_ID',
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      images: absoluteNewsMediaUrl(article.coverImage)
        ? [{ url: absoluteNewsMediaUrl(article.coverImage)!, alt: article.title }]
        : [{ url: 'https://www.lajukan.com/opengraph-image.png', width: 1200, height: 630, alt: 'Lajukan News' }],
    },
    authors: [{ name: article.byline }],
    keywords: article.tags,
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description,
      images: [absoluteNewsMediaUrl(article.coverImage) || 'https://www.lajukan.com/opengraph-image.png'],
    },
  };
}

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function readingMinutes(text: string): number {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return Math.max(1, Math.ceil(words / 220));
}

function sourceHost(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return value;
  }
}

function typeLabel(articleKind: string, isId: boolean) {
  if (articleKind === 'analysis') return isId ? 'Analisis' : 'Analysis';
  if (articleKind === 'press_release') return isId ? 'Rilis bisnis' : 'Business release';
  return isId ? 'Berita' : 'News';
}

export default async function NewsArticlePage({ params }: PageProps) {
  const { locale, slug } = await params;
  const isId = locale !== 'en';
  const article = await getPublishedNewsArticle(slug);
  if (!article) notFound();

  const requestedLanguage = locale === 'en' ? 'en' : 'id';
  if (article.language !== requestedLanguage) {
    permanentRedirect('/' + article.language + buildNewsPath(article.slug));
  }

  const isRetracted = article.editorialStatus === 'retracted';
  const relatedArticles = isRetracted ? [] : await getRelatedNewsArticles(article, 4);
  const articleRichHtml = sanitizeNewsRichText(
    article.richBody || plainTextToNewsHtml(article.body),
  );
  const articleText = article.body || article.richBody.replace(/<[^>]+>/g, ' ');
  const estimatedMinutes = readingMinutes(articleText);

  const jsonLd = isRetracted
    ? [buildNewsBreadcrumbJsonLd(article, article.language)]
    : [
        buildNewsArticleJsonLd(article, article.language),
        buildNewsBreadcrumbJsonLd(article, article.language),
      ];

  return (
    <main className="page-shell page-shell-readable page-rhythm pb-14 pt-4 sm:pt-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <NewsAnalytics articleId={article.id} slug={article.slug} category={article.category} />

      <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.13em]">
        <span className="rounded-full bg-emerald-700 px-2.5 py-1.5 text-white">{article.category}</span>
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-slate-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400">
          {typeLabel(article.articleKind, isId)}
        </span>
        {isRetracted ? (
          <span className="rounded-full bg-rose-100 px-2.5 py-1.5 text-rose-800 dark:bg-rose-400/15 dark:text-rose-200">
            {isId ? 'Ditarik' : 'Retracted'}
          </span>
        ) : null}
        <span className="text-slate-300">•</span>
        <Link
          href="/news"
          data-news-action="news_home_clicked"
          className="text-emerald-700 transition hover:text-emerald-800 hover:underline dark:text-emerald-300"
        >
          Lajukan News
        </Link>
      </div>

      <article id="news-article" className="mt-4">
        <header className="max-w-4xl">
          <h1 className="text-[34px] font-black leading-[1.04] tracking-[-0.055em] text-slate-950 dark:text-white sm:text-[48px] lg:text-[56px]">
            {article.title}
          </h1>

          {!isRetracted && article.summary ? (
            <p className="mt-4 max-w-3xl text-[15px] font-semibold leading-7 text-slate-600 dark:text-slate-300 sm:text-[17px] sm:leading-8">
              {article.summary}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400">
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-slate-100 px-3 dark:bg-white/[0.06]">
              <CalendarDays className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
              {formatDate(article.publishedAt, locale)}
            </span>
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-slate-100 px-3 dark:bg-white/[0.06]">
              <Timer className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
              {estimatedMinutes} {isId ? 'menit baca' : 'min read'}
            </span>
            <span className="inline-flex min-h-8 items-center rounded-full bg-slate-100 px-3 dark:bg-white/[0.06]">
              {article.byline}
            </span>
            {article.location ? (
              <Link
                href={buildNewsFacetPath('location', article.location)}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-slate-100 px-3 transition hover:text-emerald-700 dark:bg-white/[0.06] dark:hover:text-emerald-300"
              >
                <MapPin className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                {article.location}
              </Link>
            ) : null}
            {article.updatedAt !== article.publishedAt ? (
              <span className="inline-flex min-h-8 items-center rounded-full bg-slate-100 px-3 text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
                {isId ? 'Diperbarui' : 'Updated'} {formatDate(article.updatedAt, locale)}
              </span>
            ) : null}
          </div>

          {article.tags.length ? (
            <nav aria-label={isId ? 'Topik berita' : 'News topics'} className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
              {article.tags.map(tag => (
                <Link
                  key={tag}
                  href={buildNewsFacetPath('topic', tag)}
                  className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-600 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-emerald-300"
                >
                  <Hash className="h-3.5 w-3.5" />
                  {tag}
                </Link>
              ))}
            </nav>
          ) : null}

          {!isRetracted ? (
            <NewsShareActions
              articleId={article.id}
              slug={article.slug}
              category={article.category}
              title={article.title}
              isId={isId}
            />
          ) : null}
        </header>

        <div className="mt-6">
          <NewsArticleMedia article={article} isId={isId} />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-12">
          <div className="min-w-0">
            {isRetracted ? (
              <section className="rounded-[22px] border border-rose-200 bg-rose-50 p-4 dark:border-rose-400/20 dark:bg-rose-400/10">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-rose-700 dark:text-rose-200">
                  {isId ? 'Pemberitahuan penarikan' : 'Retraction notice'}
                </p>
                <p className="mt-2.5 text-sm font-semibold leading-7 text-rose-950 dark:text-rose-100">
                  {article.retractionNote || (isId
                    ? 'Artikel ini telah ditarik dari publikasi. Konten lama tidak lagi ditampilkan.'
                    : 'This article has been retracted. The old content is no longer displayed.')}
                </p>
              </section>
            ) : (
              <>
                <section className="prose prose-slate max-w-none text-[15px] leading-8 sm:text-[15.5px] dark:prose-invert [&_p]:mb-5 [&_p]:leading-8 [&_p:last-child]:mb-0 [&_h2]:mt-9 [&_h2]:text-[22px] [&_h2]:font-black [&_h2]:tracking-tight [&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-black [&_a]:font-semibold [&_a]:text-emerald-700 [&_blockquote]:border-emerald-500 [&_img]:rounded-2xl [&_img]:shadow-sm">
                  {articleRichHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: articleRichHtml }} />
                  ) : null}
                </section>

                {article.businessImpact ? (
                  <section className="mt-8 rounded-[22px] border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-400/20 dark:bg-emerald-400/10">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                      {isId ? 'Dampak untuk pelaku usaha' : 'Impact for business owners'}
                    </p>
                    <p className="mt-2.5 text-sm font-semibold leading-7 text-emerald-950 dark:text-emerald-100">
                      {article.businessImpact}
                    </p>
                  </section>
                ) : null}

                {article.correctionNote ? (
                  <section className="mt-7 rounded-[22px] border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-400/20 dark:bg-amber-400/10">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-800 dark:text-amber-200">
                      {isId ? 'Catatan koreksi' : 'Correction note'}
                    </p>
                    <p className="mt-2.5 text-sm font-semibold leading-7 text-amber-950 dark:text-amber-100">
                      {article.correctionNote}
                    </p>
                  </section>
                ) : null}

                {article.sourceUrls.length ? (
                  <section className="mt-10 border-t border-slate-200 pt-7 dark:border-white/10">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                          {isId ? 'Referensi' : 'References'}
                        </p>
                        <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">
                          {isId ? 'Sumber yang digunakan' : 'Sources used'}
                        </h2>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">{article.sourceUrls.length}</span>
                    </div>
                    <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-[18px] border border-slate-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-slate-900">
                      {article.sourceUrls.map((source, index) => (
                        <a
                          key={source}
                          href={source}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          data-news-action="source_clicked"
                          className="group flex items-start gap-3 p-3.5 transition hover:bg-emerald-50/60 dark:hover:bg-emerald-400/5"
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-100 text-emerald-700 transition group-hover:bg-emerald-100 dark:bg-white/[0.06] dark:text-emerald-300">
                            <ExternalLink className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                              {isId ? 'Sumber ' + (index + 1) : 'Source ' + (index + 1)}
                            </span>
                            <span className="mt-1 block truncate text-sm font-black text-slate-800 group-hover:text-emerald-800 dark:text-slate-100 dark:group-hover:text-emerald-300">
                              {sourceHost(source)}
                            </span>
                            <span className="mt-1 block line-clamp-2 break-all text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
                              {source}
                            </span>
                          </span>
                        </a>
                      ))}
                    </div>
                  </section>
                ) : null}
              </>
            )}
          </div>

          <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[20px] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                  <BookOpenText className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.13em] text-emerald-700 dark:text-emerald-300">
                    {isId ? 'Ringkasan' : 'Snapshot'}
                  </p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    {isId ? 'Biar cepat paham' : 'At a glance'}
                  </p>
                </div>
              </div>
              <dl className="mt-4 space-y-2">
                <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-white/[0.04]">
                  <dt className="text-[10px] font-bold text-slate-500">{isId ? 'Waktu baca' : 'Read time'}</dt>
                  <dd className="text-xs font-black text-slate-900 dark:text-white">{estimatedMinutes} {isId ? 'menit' : 'min'}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-white/[0.04]">
                  <dt className="text-[10px] font-bold text-slate-500">{isId ? 'Sumber' : 'Sources'}</dt>
                  <dd className="text-xs font-black text-slate-900 dark:text-white">{article.sourceUrls.length}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-white/[0.04]">
                  <dt className="text-[10px] font-bold text-slate-500">{isId ? 'Jenis' : 'Type'}</dt>
                  <dd className="text-xs font-black text-slate-900 dark:text-white">{typeLabel(article.articleKind, isId)}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-[20px] border border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-400/15 dark:bg-emerald-400/5">
              <p className="text-[10px] font-black uppercase tracking-[0.13em] text-emerald-700 dark:text-emerald-300">
                {isId ? 'Konteks Lajukan' : 'Lajukan context'}
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-emerald-950 dark:text-emerald-100">
                {isRetracted
                  ? (isId ? 'URL tetap tersedia untuk transparansi, tetapi isi lama tidak ditampilkan.' : 'The URL remains available for transparency while the old content stays hidden.')
                  : (isId ? 'Artikel mengikuti alur editorial Lajukan News. Koreksi material dicatat pada halaman.' : 'Stories follow the Lajukan News editorial workflow. Material corrections are recorded on the page.')}
              </p>
            </div>
          </aside>
        </div>

        {relatedArticles.length ? (
          <section className="mt-12 border-t border-slate-200 pt-8 dark:border-white/10">
            <NewsCarousel
              articles={relatedArticles}
              locale={locale}
              eyebrow={isId ? 'Lanjut baca' : 'Continue reading'}
              title={isId ? 'Berita terkait' : 'Related news'}
              related
            />
            <div className="mt-3 flex justify-end">
              <Link
                href="/news"
                data-news-action="related_clicked"
                className="text-xs font-bold text-emerald-700 transition hover:underline dark:text-emerald-300"
              >
                {isId ? 'Lihat semua berita' : 'View all news'}
              </Link>
            </div>
          </section>
        ) : null}

      </article>
    </main>
  );
}
