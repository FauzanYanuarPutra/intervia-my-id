import type { Metadata } from 'next';
import {
  ArrowRight,
  BookOpenText,
  Search,
  Sparkles,
  Store,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  buildBlogIndexJsonLd,
  buildBlogPath,
  buildBlogUrl,
  getBlogArticles,
} from '@/lib/seo/blog';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const isId = locale === 'id';
  const title = isId
    ? 'Blog Lajukan | Panduan UMKM, Supplier Lokal, AI Bisnis'
    : 'Lajukan Blog | SME, Local Supplier, and Business AI Guides';
  const description = isId
    ? 'Panduan praktis untuk UMKM Indonesia: cari supplier lokal, rapikan profil usaha, pakai AI dengan aman, local SEO, dan substitusi impor.'
    : 'Practical guides for Indonesian SMEs: local suppliers, business profiles, safe AI use, local SEO, and import substitution.';

  return {
    title,
    description,
    alternates: {
      canonical: buildBlogUrl(locale),
      languages: {
        id: buildBlogUrl('id'),
        en: buildBlogUrl('en'),
        'x-default': buildBlogUrl('id'),
      },
    },
    openGraph: {
      title,
      description,
      url: buildBlogUrl(locale),
      siteName: 'Lajukan',
      type: 'website',
      locale: isId ? 'id_ID' : 'en_US',
      images: [
        {
          url: 'https://www.lajukan.com/opengraph-image.png',
          width: 1200,
          height: 630,
          alt: isId ? 'Blog Lajukan' : 'Lajukan Blog',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['https://www.lajukan.com/opengraph-image.png'],
    },
  };
}

export default async function BlogIndexPage({ params }: PageProps) {
  const { locale } = await params;
  const isId = locale === 'id';
  const articles = getBlogArticles(locale);
  const featured = articles[0];
  const rest = articles.slice(1);
  const jsonLd = buildBlogIndexJsonLd(locale);

  const topicLinks = [
    {
      href: '/search?type=product&side=supply&q=supplier',
      label: isId ? 'Cari supplier' : 'Find suppliers',
      icon: Search,
    },
    {
      href: '/usaha',
      label: isId ? 'Kelola usaha' : 'Manage business',
      icon: Store,
    },
    {
      href: '/umkm',
      label: isId ? 'Peta UMKM' : 'UMKM map',
      icon: Sparkles,
    },
  ];

  return (
    <main className="page-shell page-rhythm pb-12 pt-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="overflow-hidden rounded-[32px] border border-emerald-100 bg-[linear-gradient(135deg,#fffdf6_0%,#effdf5_48%,#fff7ed_100%)] p-5 shadow-[0_24px_64px_-48px_rgba(15,23,42,0.34)] dark:border-white/10 dark:bg-[linear-gradient(135deg,#0f172a_0%,#052e24_58%,#1c1917_100%)] sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
              <BookOpenText className="h-3.5 w-3.5" />
              {isId ? 'Knowledge hub' : 'Knowledge hub'}
            </p>
            <h1 className="mt-4 max-w-4xl text-3xl font-bold tracking-[-0.06em] text-slate-950 dark:text-white sm:text-5xl">
              {isId
                ? 'Panduan praktis supaya usaha lebih mudah ditemukan.'
                : 'Practical guides to make businesses easier to discover.'}
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300 sm:text-base">
              {isId
                ? 'Blog Lajukan berisi panduan supplier lokal, UMKM digital, AI untuk bisnis, local SEO, dan pasokan Indonesia. Fokusnya bukan konten massal, tapi jawaban yang bisa dipakai owner.'
                : 'The Lajukan Blog covers local suppliers, digital SME profiles, business AI, local SEO, and Indonesian supply. The focus is not bulk content, but answers owners can use.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {topicLinks.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-emerald-100 bg-white px-3.5 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-400/20 dark:bg-white/10 dark:text-emerald-100"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <aside className="rounded-[26px] border border-white/80 bg-white/86 p-4 shadow-[0_20px_54px_-42px_rgba(15,23,42,0.42)]  dark:border-white/10 dark:bg-slate-950/60">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              {isId ? 'Fokus SEO sehat' : 'Healthy SEO focus'}
            </p>
            <div className="mt-3 grid gap-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
              <p>
                {isId
                  ? 'Konten harus membantu orang beli, jual, atau menjalankan usaha.'
                  : 'Content should help people buy, sell, or operate a business.'}
              </p>
              <p>
                {isId
                  ? 'Setiap artikel punya internal link ke fitur Lajukan yang relevan.'
                  : 'Each article links internally to relevant Lajukan features.'}
              </p>
            </div>
          </aside>
        </div>
      </section>

      {featured ? (
        <section className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <Link
            href={buildBlogPath(featured.slug)}
            className="group overflow-hidden rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_22px_54px_-44px_rgba(15,23,42,0.32)] transition hover:-translate-y-0.5 hover:border-emerald-200 dark:border-white/10 dark:bg-slate-900 sm:p-6"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              {isId ? 'Artikel utama' : 'Featured article'}
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-[-0.05em] text-slate-950 group-hover:text-emerald-800 dark:text-white dark:group-hover:text-emerald-200 sm:text-3xl">
              {featured.localized.title}
            </h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">
              {featured.localized.description}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">
                {featured.localized.category}
              </span>
              <span>{featured.localized.readTime}</span>
            </div>
          </Link>

          <div className="rounded-[30px] border border-slate-200 bg-[#f8f5ee] p-5 dark:border-white/10 dark:bg-white/[0.04] sm:p-6">
            <p className="text-sm font-bold text-slate-950 dark:text-white">
              {isId ? 'Kenapa blog penting?' : 'Why a blog matters'}
            </p>
            <p className="mt-3 text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">
              {isId
                ? 'Blog membuat Lajukan punya halaman yang menjawab pertanyaan calon pengguna sebelum mereka siap daftar. Ini bantu discovery, internal link, dan kepercayaan brand.'
                : 'A blog gives Lajukan pages that answer potential users before they are ready to sign up. It supports discovery, internal links, and brand trust.'}
            </p>
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map(article => (
          <Link
            key={article.slug}
            href={buildBlogPath(article.slug)}
            className="group flex min-h-[260px] flex-col rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_44px_-40px_rgba(15,23,42,0.3)] transition hover:-translate-y-0.5 hover:border-emerald-200 dark:border-white/10 dark:bg-slate-900"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              {article.localized.eyebrow}
            </p>
            <h2 className="mt-3 text-xl font-bold tracking-[-0.04em] text-slate-950 group-hover:text-emerald-800 dark:text-white dark:group-hover:text-emerald-200">
              {article.localized.title}
            </h2>
            <p className="mt-3 line-clamp-4 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
              {article.localized.description}
            </p>
            <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-xs font-bold">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 dark:bg-white/10 dark:text-slate-300">
                {article.localized.readTime}
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                {isId ? 'Baca' : 'Read'}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
