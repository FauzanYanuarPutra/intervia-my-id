import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, Clock3, ArrowLeft, ArrowRight } from 'lucide-react';
import {
  buildBlogArticleJsonLd,
  buildBlogBreadcrumbJsonLd,
  buildBlogCanonicalAlternates,
  buildBlogPath,
  buildBlogRobots,
  buildBlogUrl,
  getPublishedBlogArticle,
  getPublishedBlogArticles,
  getRelatedBlogArticles,
} from '@/lib/blog';
import { serializeJsonLd } from '@/lib/seo/jsonLd';

type PageProps = { params: Promise<{ locale: string; slug: string }> };

function formatDate(value: string | null, locale: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function safeRichBody(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(['"]?)\s*(javascript:|data:|vbscript:)[^'">\s]*\2/gi, '$1=$2$2');
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = await getPublishedBlogArticle(slug, locale);
  if (!article) return { robots: { index: false, follow: true } };

  return {
    title: article.title + ' | Lajukan Blog',
    description: article.summary || article.body.slice(0, 160),
    keywords: article.topics,
    robots: buildBlogRobots(article),
    alternates: buildBlogCanonicalAlternates(article),
    openGraph: {
      title: article.title,
      description: article.summary || article.body.slice(0, 160),
      url: buildBlogUrl(article.language, article.slug),
      siteName: 'Lajukan',
      type: 'article',
      locale: article.language === 'en' ? 'en_US' : 'id_ID',
      publishedTime: article.publishedAt || article.createdAt,
      modifiedTime: article.updatedAt,
      images: [{ url: article.coverImage || 'https://www.lajukan.com/opengraph-image.png', alt: article.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.summary || article.body.slice(0, 160),
      images: [article.coverImage || 'https://www.lajukan.com/opengraph-image.png'],
    },
  };
}

export default async function BlogArticlePage({ params }: PageProps) {
  const { locale, slug } = await params;
  const requestedLanguage = locale === 'en' ? 'en' : 'id';
  const article = await getPublishedBlogArticle(slug, locale);
  if (!article) notFound();
  if (article.language !== requestedLanguage) {
    permanentRedirect('/' + article.language + buildBlogPath(article.slug));
  }

  const sameLanguage = await getPublishedBlogArticles(article.language, { limit: 24 });
  const related = getRelatedBlogArticles(article, sameLanguage.items, 4);
  const richBody = article.richBody
    ? safeRichBody(article.richBody)
    : article.body
        .split(/\n{2,}/)
        .filter(Boolean)
        .map(paragraph => '<p>' + paragraph.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>')
        .join('');

  return (
    <main className="page-shell page-shell-readable page-rhythm pb-12 pt-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd([buildBlogArticleJsonLd(article), buildBlogBreadcrumbJsonLd(article)]) }}
      />
      <div className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-500">
        <Link href={buildBlogPath()} className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />Blog
        </Link>
        <span>/</span>
        <span className="text-emerald-700">{article.category}</span>
      </div>

      <article className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <header className="bg-[linear-gradient(135deg,#fffdf6_0%,#effdf5_54%,#fff7ed_100%)] p-5 dark:bg-[linear-gradient(135deg,#0f172a_0%,#052e24_58%,#1c1917_100%)] sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em]">
            <span className="rounded-full bg-emerald-700 px-2.5 py-1.5 text-white">{article.category}</span>
            <span className="rounded-full bg-white/80 px-2.5 py-1.5 text-slate-600 dark:bg-white/10 dark:text-slate-300">{article.authorName}</span>
          </div>
          <h1 className="mt-4 max-w-5xl text-3xl font-black tracking-[-0.06em] text-slate-950 dark:text-white sm:text-5xl">{article.title}</h1>
          {article.summary ? <p className="mt-4 max-w-3xl text-base font-semibold leading-8 text-slate-600 dark:text-slate-300">{article.summary}</p> : null}
          <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-slate-500">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{formatDate(article.publishedAt || article.createdAt, article.language)}</span>
            <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{Math.max(1, Math.ceil(article.body.trim().split(/\s+/).filter(Boolean).length / 220))} menit baca</span>
          </div>
          {article.coverImage ? <img src={article.coverImage} alt={article.title} className="mt-6 aspect-[16/8] w-full rounded-2xl object-cover" fetchPriority="high" /> : null}
        </header>

        <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:p-10">
          <div className="min-w-0">
            <div className="prose prose-slate max-w-none dark:prose-invert [&_h2]:mt-9 [&_h2]:text-2xl [&_h2]:font-black [&_h3]:mt-7 [&_h3]:text-xl [&_h3]:font-black [&_a]:font-semibold [&_a]:text-emerald-700 [&_img]:rounded-2xl" dangerouslySetInnerHTML={{ __html: richBody }} />
            {article.topics.length ? (
              <div className="mt-8 flex flex-wrap gap-1.5">
                {article.topics.map(topic => (
                  <Link key={topic} href={'/blog?category=' + encodeURIComponent(article.category)} className="rounded-full border px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:border-white/10 dark:text-slate-300">#{topic}</Link>
                ))}
              </div>
            ) : null}

            <section className="mt-8 rounded-[22px] border border-emerald-100 bg-emerald-50 p-5 dark:border-emerald-400/20 dark:bg-emerald-400/10">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">Lajukan</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">Temukan supplier, jasa, UMKM, dan kebutuhan usaha di Lajukan.</p>
              <Link href="/explore" className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-xs font-black text-white">Jelajahi Lajukan<ArrowRight className="h-3.5 w-3.5" /></Link>
            </section>
          </div>

          <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
            <section className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <p className="text-sm font-black text-slate-950 dark:text-white">Tentang artikel</p>
              <dl className="mt-3 grid gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <div><dt>Penulis</dt><dd className="text-slate-950 dark:text-white">{article.authorName}</dd></div>
                <div><dt>Dipublikasikan</dt><dd>{formatDate(article.publishedAt || article.createdAt, article.language)}</dd></div>
                <div><dt>Diperbarui</dt><dd>{formatDate(article.updatedAt, article.language)}</dd></div>
              </dl>
            </section>
            {related.length ? (
              <section className="rounded-[22px] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
                <p className="text-sm font-black text-slate-950 dark:text-white">Artikel terkait</p>
                <div className="mt-3 grid gap-2">
                  {related.map(item => <Link key={item.id} href={buildBlogPath(item.slug)} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold hover:border-emerald-200 dark:border-white/10 dark:bg-white/[0.03] dark:text-white">{item.title}</Link>)}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </article>
    </main>
  );
}
