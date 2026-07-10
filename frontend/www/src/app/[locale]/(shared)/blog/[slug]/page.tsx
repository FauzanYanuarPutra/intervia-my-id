import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  BLOG_ARTICLES,
  buildBlogArticleJsonLd,
  buildBlogPath,
  buildBlogUrl,
  getBlogArticle,
  getBlogArticles,
} from '@/lib/seo/blog';

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export function generateStaticParams() {
  return BLOG_ARTICLES.flatMap(article => [
    { locale: 'id', slug: article.slug },
    { locale: 'en', slug: article.slug },
  ]);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = getBlogArticle(slug, locale);
  if (!article) return {};

  return {
    title: article.localized.title,
    description: article.localized.description,
    keywords: article.keywords,
    alternates: {
      canonical: buildBlogUrl(locale, article.slug),
      languages: {
        id: buildBlogUrl('id', article.slug),
        en: buildBlogUrl('en', article.slug),
        'x-default': buildBlogUrl('id', article.slug),
      },
    },
    openGraph: {
      title: article.localized.title,
      description: article.localized.description,
      url: buildBlogUrl(locale, article.slug),
      siteName: 'Lajukan',
      type: 'article',
      locale: locale === 'en' ? 'en_US' : 'id_ID',
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      images: [
        {
          url: article.image,
          width: 1200,
          height: 630,
          alt: article.localized.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.localized.title,
      description: article.localized.description,
      images: [article.image],
    },
  };
}

export default async function BlogArticlePage({ params }: PageProps) {
  const { locale, slug } = await params;
  const isId = locale === 'id';
  const article = getBlogArticle(slug, locale);
  if (!article) notFound();

  const related = getBlogArticles(locale)
    .filter(item => item.slug !== article.slug)
    .slice(0, 3);
  const jsonLd = buildBlogArticleJsonLd(article, locale);
  const dateFormatter = new Intl.DateTimeFormat(isId ? 'id-ID' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const publishedDate = dateFormatter.format(new Date(article.publishedAt));

  return (
    <main className="page-shell page-rhythm pb-12 pt-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {isId ? 'Blog' : 'Blog'}
        </Link>
      </nav>

      <article className="overflow-hidden rounded-[34px] border border-emerald-100 bg-white shadow-[0_24px_68px_-50px_rgba(15,23,42,0.38)] dark:border-white/10 dark:bg-slate-900">
        <header className="bg-[linear-gradient(135deg,#fffdf6_0%,#effdf5_54%,#fff7ed_100%)] p-5 dark:bg-[linear-gradient(135deg,#0f172a_0%,#052e24_58%,#1c1917_100%)] sm:p-8 lg:p-10">
          <p className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
            <Sparkles className="h-3.5 w-3.5" />
            {article.localized.eyebrow}
          </p>
          <h1 className="mt-5 max-w-4xl text-3xl font-bold tracking-[-0.06em] text-slate-950 dark:text-white sm:text-5xl">
            {article.localized.title}
          </h1>
          <p className="mt-4 max-w-3xl text-base font-semibold leading-8 text-slate-600 dark:text-slate-300">
            {article.localized.hero}
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-white px-3 dark:bg-white/10">
              <CalendarDays className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
              {publishedDate}
            </span>
            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-white px-3 dark:bg-white/10">
              <Clock className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" />
              {article.localized.readTime}
            </span>
            <span className="inline-flex min-h-8 items-center rounded-full bg-emerald-50 px-3 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-100">
              {article.localized.category}
            </span>
          </div>
        </header>

        <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-10">
          <div className="min-w-0">
            <section className="rounded-[26px] border border-slate-200 bg-[#f8f5ee] p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <h2 className="text-base font-bold text-slate-950 dark:text-white">
                {isId ? 'Inti artikel' : 'Key takeaways'}
              </h2>
              <div className="mt-3 grid gap-2">
                {article.localized.takeaways.map(item => (
                  <div
                    key={item}
                    className="flex gap-2 rounded-[18px] bg-white px-3 py-2 text-sm font-semibold leading-6 text-slate-700 dark:bg-slate-950/42 dark:text-slate-200"
                  >
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-7 space-y-8">
              {article.localized.sections.map(section => (
                <section key={section.heading}>
                  <h2 className="text-2xl font-bold tracking-[-0.04em] text-slate-950 dark:text-white">
                    {section.heading}
                  </h2>
                  <div className="mt-3 space-y-4 text-[15px] font-semibold leading-8 text-slate-700 dark:text-slate-300">
                    {section.body.map(paragraph => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                  {section.bullets?.length ? (
                    <ul className="mt-4 grid gap-2">
                      {section.bullets.map(item => (
                        <li
                          key={item}
                          className="rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold leading-6 text-slate-700 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-200"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>

            <section className="mt-8 rounded-[28px] border border-emerald-100 bg-emerald-50 p-5 dark:border-emerald-400/20 dark:bg-emerald-400/10 sm:p-6">
              <h2 className="text-xl font-bold tracking-[-0.04em] text-slate-950 dark:text-white">
                {article.localized.ctaTitle}
              </h2>
              <p className="mt-2 text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">
                {article.localized.ctaDescription}
              </p>
              <Link
                href={article.localized.ctaHref}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-emerald-700 px-5 text-sm font-bold text-white transition hover:bg-emerald-800"
              >
                {article.localized.ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </section>
          </div>

          <aside className="space-y-3 lg:sticky lg:top-[calc(88px+env(safe-area-inset-top))] lg:self-start">
            <section className="rounded-[26px] border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <p className="text-sm font-bold text-slate-950 dark:text-white">
                {isId ? 'Topik terkait' : 'Related topics'}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {article.keywords.slice(0, 6).map(keyword => (
                  <span
                    key={keyword}
                    className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-950/42 dark:text-slate-300"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-[26px] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
              <p className="text-sm font-bold text-slate-950 dark:text-white">
                {isId ? 'Baca juga' : 'Read next'}
              </p>
              <div className="mt-3 grid gap-2">
                {related.map(item => (
                  <Link
                    key={item.slug}
                    href={buildBlogPath(item.slug)}
                    className="group rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-3 transition hover:border-emerald-200 dark:border-white/10 dark:bg-white/[0.04]"
                  >
                    <span className="block text-sm font-bold leading-5 text-slate-900 group-hover:text-emerald-800 dark:text-white dark:group-hover:text-emerald-200">
                      {item.localized.title}
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {item.localized.readTime}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </article>
    </main>
  );
}
