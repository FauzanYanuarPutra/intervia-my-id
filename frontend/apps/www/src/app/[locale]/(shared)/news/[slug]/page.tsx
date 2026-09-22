import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { ArrowLeft, BookOpenText, CalendarDays, ExternalLink, Hash, MapPin, Newspaper, Store, Timer } from 'lucide-react';
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
import { serializeJsonLd } from '@/lib/seo/jsonLd';
import NewsAnalytics from './NewsAnalytics';
import NewsShareActions from './NewsShareActions';
import { NewsArticleMedia } from '@/components/news/NewsMedia';

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = await getPublishedNewsArticle(slug);
  if (!article) return { robots: { index: false, follow: true } };
  const isRetracted = article.editorialStatus === 'retracted';
  const description = isRetracted
    ? (locale === 'id'
        ? 'Artikel ini telah ditarik dari publikasi Lajukan News.'
        : 'This article has been retracted from Lajukan News.')
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
      images: article.coverImage
        ? [{ url: article.coverImage, alt: article.title }]
        : [{ url: 'https://www.lajukan.com/opengraph-image.png', width: 1200, height: 630, alt: article.title }],
    },
    authors: [{ name: article.byline }],
    keywords: article.tags,
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description,
      images: [article.coverImage || 'https://www.lajukan.com/opengraph-image.png'],
    },
  };
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function readingMinutes(text: string): number {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return Math.max(1, Math.ceil(words / 220));
}

function sourceHost(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www./, '');
  } catch {
    return value;
  }
}

export default async function NewsArticlePage({ params }: PageProps) {
  const { locale, slug } = await params;
  const isId = locale === 'id';
  const article = await getPublishedNewsArticle(slug);
  if (!article) notFound();
  const requestedLanguage = locale === 'en' ? 'en' : 'id';
  if (article.language !== requestedLanguage) {
    permanentRedirect(`/${article.language}${buildNewsPath(article.slug)}`);
  }
  const isRetracted = article.editorialStatus === 'retracted';
  const relatedArticles = isRetracted
    ? []
    : await getRelatedNewsArticles(article, 3);

  const paragraphs = article.body
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(Boolean);
  const estimatedMinutes = readingMinutes(article.body || article.richBody.replace(/<[^>]+>/g, ' '));

  const jsonLd = isRetracted
    ? [buildNewsBreadcrumbJsonLd(article, article.language)]
    : [
        buildNewsArticleJsonLd(article, article.language),
        buildNewsBreadcrumbJsonLd(article, article.language),
      ];

  return (
    <main className="page-shell page-shell-readable page-rhythm pb-12 pt-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <NewsAnalytics articleId={article.id} slug={article.slug} category={article.category} />

      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/news" className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">
            <ArrowLeft className="h-3.5 w-3.5" />
            {isId ? 'News' : 'News'}
          </Link>
          <span className="text-slate-300">/</span>
          <Link href={buildNewsFacetPath('topic', article.category)} className="truncate text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-300">
            {article.category}
          </Link>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-emerald-700 text-xs font-black text-white shadow-sm">L</span>
          <span className="text-xs font-black text-slate-500 dark:text-slate-400">Lajukan News</span>
        </div>
      </nav>

      <article id="news-article" className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_24px_68px_-52px_rgba(15,23,42,0.4)] dark:border-white/10 dark:bg-slate-900">
        <header className="bg-[linear-gradient(135deg,#f8fafc_0%,#ecfdf5_56%,#fff7ed_100%)] p-4 dark:bg-[linear-gradient(135deg,#0f172a_0%,#052e24_58%,#1c1917_100%)] sm:p-7 lg:p-9">
          <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.14em]">
            <span className="rounded-full bg-emerald-700 px-3 py-1.5 text-white">{article.category}</span>
            {isRetracted ? <span className="rounded-full bg-rose-100 px-3 py-1.5 text-rose-800 dark:bg-rose-400/15 dark:text-rose-200">{isId ? 'Ditarik' : 'Retracted'}</span> : null}
            {article.articleKind === 'press_release' ? <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200">{isId ? 'Rilis bisnis' : 'Business release'}</span> : null}
            {article.articleKind === 'analysis' ? <span className="rounded-full bg-sky-100 px-3 py-1.5 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200">{isId ? 'Analisis' : 'Analysis'}</span> : null}
          </div>
          <h1 className="mt-4 max-w-4xl text-[31px] font-black leading-[1.06] tracking-[-0.055em] text-slate-950 dark:text-white sm:text-[48px]">{article.title}</h1>
          {!isRetracted && article.summary ? <p className="mt-3 max-w-3xl text-[15px] font-semibold leading-7 sm:text-base sm:leading-8 text-slate-600 dark:text-slate-300">{article.summary}</p> : null}
          <div className="mt-6">
            <NewsArticleMedia article={article} isId={isId} />
          </div>
          <div className="mt-5 grid gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 sm:flex sm:flex-wrap">
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-white px-3 dark:bg-white/10">
              <CalendarDays className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
              {formatDate(article.publishedAt, locale)}
            </span>
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-white px-3 dark:bg-white/10">
              <Timer className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
              {estimatedMinutes} {isId ? 'menit baca' : 'min read'}
            </span>
            <span className="inline-flex min-h-8 items-center rounded-full bg-white px-3 dark:bg-white/10">
              {article.byline}
            </span>
            {article.location ? (
              <Link
                href={buildNewsFacetPath('location', article.location)}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-white px-3 transition hover:text-emerald-700 dark:bg-white/10 dark:hover:text-emerald-300"
              >
                <MapPin className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
                {article.location}
              </Link>
            ) : null}
            {article.updatedAt !== article.publishedAt ? (
              <span className="inline-flex min-h-8 items-center rounded-full bg-white/70 px-3 text-slate-500 dark:bg-white/5 dark:text-slate-400">
                {isId ? 'Diperbarui' : 'Updated'} {formatDate(article.updatedAt, locale)}
              </span>
            ) : null}
          </div>
          {article.tags.length ? (
            <nav aria-label={isId ? 'Topik berita' : 'News topics'} className="mt-4 flex flex-wrap gap-2">
              {article.tags.map(tag => (
                <Link
                  key={tag}
                  href={buildNewsFacetPath('topic', tag)}
                  className="inline-flex min-h-8 items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-3 text-xs font-bold text-slate-600 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-300 dark:hover:text-emerald-300"
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

        <div className="grid gap-7 p-4 sm:p-7 lg:grid-cols-[minmax(0,760px)_280px] lg:items-start lg:gap-9 lg:p-9">
          <div className="min-w-0">
            {isRetracted ? (
              <section className="rounded-[24px] border border-rose-200 bg-rose-50 p-5 dark:border-rose-400/20 dark:bg-rose-400/10">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-rose-700 dark:text-rose-200">{isId ? 'Pemberitahuan penarikan' : 'Retraction notice'}</p>
                <p className="mt-3 text-sm font-semibold leading-7 text-rose-950 dark:text-rose-100">
                  {article.retractionNote || (isId
                    ? 'Artikel ini telah ditarik dari publikasi. Konten asli tidak lagi ditampilkan.'
                    : 'This article has been retracted. The original content is no longer displayed.')}
                </p>
              </section>
            ) : (
              <>
                {article.richBody ? (
                  <div className="prose prose-slate max-w-none text-[15px] leading-8 sm:text-[15.5px] [&_p]:leading-8 [&_h2]:mt-9 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:tracking-tight [&_h3]:mt-8 [&_h3]:text-xl [&_h3]:font-black dark:prose-invert [&_a]:text-emerald-700 [&_a]:font-semibold [&_blockquote]:border-emerald-500 [&_img]:rounded-2xl [&_img]:shadow-sm" dangerouslySetInnerHTML={{ __html: article.richBody }} />
                ) : (
                  <div className="space-y-5 text-[15px] font-medium leading-8 text-slate-700 dark:text-slate-200 sm:text-[15.5px]">
                    {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                  </div>
                )}

            {article.businessImpact ? (
              <section className="mt-6 rounded-[22px] border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-400/20 dark:bg-emerald-400/10">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">{isId ? 'Dampak untuk pelaku usaha' : 'Impact for business owners'}</p>
                <p className="mt-3 text-sm font-semibold leading-7 text-emerald-950 dark:text-emerald-100">{article.businessImpact}</p>
              </section>
            ) : null}

            {article.correctionNote ? (
              <section className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 p-5 dark:border-amber-400/20 dark:bg-amber-400/10">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-800 dark:text-amber-200">{isId ? 'Catatan koreksi' : 'Correction note'}</p>
                <p className="mt-3 text-sm font-semibold leading-7 text-amber-950 dark:text-amber-100">{article.correctionNote}</p>
              </section>
            ) : null}

            {article.sourceUrls.length ? (
              <section className="mt-8 border-t border-slate-200 pt-6 dark:border-white/10">
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">{isId ? 'Sumber' : 'Sources'}</h2>
                <div className="mt-3 grid gap-2">
                  {article.sourceUrls.map((source, index) => (
                    <a
                      key={source}
                      href={source}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      data-news-action="source_clicked"
                      className="group rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 transition hover:border-emerald-200 hover:bg-emerald-50/60 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-emerald-400/10"
                    >
                      <div className="flex items-start gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm dark:bg-white/10 dark:text-emerald-300">
                          <ExternalLink className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                            {isId ? `Sumber ${index + 1}` : `Source ${index + 1}`}
                          </span>
                          <span className="mt-1 block truncate text-sm font-black text-slate-800 group-hover:text-emerald-800 dark:text-slate-100 dark:group-hover:text-emerald-300">
                            {sourceHost(source)}
                          </span>
                          <span className="mt-1 block line-clamp-2 break-all text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
                            {source}
                          </span>
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            ) : null}
              </>
            )}
          </div>

          <aside className="space-y-3 lg:sticky lg:top-24">
            <div className="rounded-[20px] border border-emerald-100 bg-emerald-50/60 p-4 sm:p-5 dark:border-emerald-400/15 dark:bg-emerald-400/5">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                {isId ? 'Ringkasan artikel' : 'Article snapshot'}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/75 p-3 dark:bg-white/5">
                  <dt className="text-[10px] font-bold text-slate-500">{isId ? 'Waktu baca' : 'Read time'}</dt>
                  <dd className="mt-1 text-sm font-black text-slate-900 dark:text-white">{estimatedMinutes} {isId ? 'menit' : 'min'}</dd>
                </div>
                <div className="rounded-xl bg-white/75 p-3 dark:bg-white/5">
                  <dt className="text-[10px] font-bold text-slate-500">{isId ? 'Sumber' : 'Sources'}</dt>
                  <dd className="mt-1 text-sm font-black text-slate-900 dark:text-white">{article.sourceUrls.length}</dd>
                </div>
                <div className="col-span-2 rounded-xl bg-white/75 p-3 dark:bg-white/5">
                  <dt className="text-[10px] font-bold text-slate-500">{isId ? 'Jenis' : 'Type'}</dt>
                  <dd className="mt-1 text-sm font-black text-slate-900 dark:text-white">
                    {article.articleKind === 'analysis' ? (isId ? 'Analisis' : 'Analysis') : article.articleKind === 'press_release' ? (isId ? 'Rilis bisnis' : 'Business release') : (isId ? 'Berita' : 'News')}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.04]">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{isId ? 'Tentang publikasi' : 'About this publication'}</p>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200">
                {isRetracted
                  ? (isId ? 'Artikel ini telah ditarik dari publikasi. Halaman dipertahankan sebagai catatan transparansi dan konten lama tidak ditampilkan.' : 'This article has been retracted. The URL is retained for transparency and the old content is no longer displayed.')
                  : article.articleKind === 'press_release'
                    ? (isId ? 'Rilis bisnis berasal dari pihak pengirim dan tetap melewati pemeriksaan editorial dasar sebelum dipublikasikan.' : 'Business releases originate from the submitting party and still pass basic editorial review before publication.')
                    : (isId ? 'Artikel ini diterbitkan melalui alur editorial Lajukan News. Koreksi material dicatat pada artikel.' : 'This article is published through the Lajukan News editorial workflow. Material corrections are recorded on the article.')}
              </p>
            </div>
            <Link href="/blog" data-news-action="related_clicked" className="block rounded-[20px] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
              <BookOpenText className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
              <p className="mt-3 font-bold text-slate-950 dark:text-white">{isId ? 'Pelajari topiknya' : 'Learn the topic'}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{isId ? 'Buka panduan evergreen Lajukan untuk konteks dan cara menerapkannya ke usaha.' : 'Open evergreen Lajukan guides for context and practical application.'}</p>
            </Link>
            <Link href="/explore" data-news-action="related_clicked" className="block rounded-[20px] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
              <Store className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
              <p className="mt-3 font-bold text-slate-950 dark:text-white">{isId ? 'Cari produk, jasa, dan supplier' : 'Find products, services, and suppliers'}</p>
            </Link>
            {relatedArticles.length ? (
              <section className="rounded-[22px] border border-slate-200 bg-white p-4 sm:p-5 dark:border-white/10 dark:bg-slate-900">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{isId ? 'Berita terkait' : 'Related news'}</p>
                <div className="mt-3 grid gap-3">
                  {relatedArticles.map(related => (
                    <Link
                      key={related.id}
                      href={buildNewsPath(related.slug)}
                      data-news-action="related_clicked"
                      className="group grid grid-cols-[76px_minmax(0,1fr)] gap-3 rounded-xl bg-slate-50 p-2.5 transition hover:bg-emerald-50 dark:bg-white/[0.04] dark:hover:bg-emerald-400/10"
                    >
                      <div className="overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-800">
                        {related.coverImage ? (
                          <img src={related.coverImage} alt="" className="aspect-[4/3] h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" loading="lazy" decoding="async" />
                        ) : (
                          <div className="grid aspect-[4/3] place-items-center bg-emerald-50 text-emerald-700/40 dark:bg-emerald-950/40 dark:text-emerald-300/40">
                            <Newspaper className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-700 dark:text-emerald-300">{related.category}</span>
                        <p className="mt-1 line-clamp-3 text-sm font-bold leading-5 text-slate-900 transition-colors group-hover:text-emerald-800 dark:text-white dark:group-hover:text-emerald-300">{related.title}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        </div>

        {!isRetracted ? (
          <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-5 sm:px-7 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-950 dark:text-white">
                  {isId ? 'Mau baca berita lain yang relevan?' : 'Want more relevant news?'}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {isId ? 'Lanjutkan ke Lajukan News untuk kategori, topik, dan berita terbaru.' : 'Continue to Lajukan News for categories, topics, and the latest stories.'}
                </p>
              </div>
              <Link href="/news" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-black text-white transition hover:bg-emerald-800">
                {isId ? 'Jelajahi News' : 'Explore News'}
                <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
              </Link>
            </div>
          </div>
        ) : null}
      </article>
    </main>
  );
}
