import type { Metadata } from 'next';
import { ArrowRight, Search, Send, Store, TrendingUp } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { NewsCard } from '@/components/news/NewsCard';
import { buildNewsPath, buildNewsUrl, getPublishedNews } from '@/lib/news';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; q?: string; cursor?: string }>;
};

const CATEGORIES = ['Ekonomi', 'Bisnis', 'UMKM', 'Teknologi', 'Keuangan', 'Regulasi', 'Industri', 'Daerah'] as const;

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const filters = await searchParams;
  const hasQueryVariant = Boolean(filters.q?.trim() || filters.category?.trim() || filters.cursor?.trim());
  const isId = locale === 'id';
  const title = isId ? 'Lajukan News | Ekonomi, Bisnis, dan UMKM' : 'Lajukan News | Economy, Business, and SMEs';
  const description = isId
    ? 'Berita ekonomi, bisnis, UMKM, teknologi, regulasi, dan daerah yang ringkas, jelas, dan relevan untuk pelaku usaha.'
    : 'Clear, practical economy, business, SME, technology, regulation, and local news for business owners.';

  return {
    title,
    description,
    robots: hasQueryVariant
      ? { index: false, follow: true }
      : { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
    alternates: {
      canonical: buildNewsUrl(locale),
      languages: { id: buildNewsUrl('id'), en: buildNewsUrl('en'), 'x-default': buildNewsUrl('id') },
    },
    openGraph: {
      title,
      description,
      url: buildNewsUrl(locale),
      siteName: 'Lajukan',
      type: 'website',
      locale: isId ? 'id_ID' : 'en_US',
      images: [{ url: 'https://www.lajukan.com/opengraph-image.png', width: 1200, height: 630, alt: 'Lajukan News' }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['https://www.lajukan.com/opengraph-image.png'] },
  };
}

function buildNewsIndexHref(filters: { category?: string; query?: string; cursor?: string }) {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.query) params.set('q', filters.query);
  if (filters.cursor) params.set('cursor', filters.cursor);
  const query = params.toString();
  return query ? `/news?${query}` : '/news';
}

export default async function NewsIndexPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const filters = await searchParams;
  const isId = locale === 'id';
  const category = filters.category?.trim() || undefined;
  const query = filters.q?.trim().slice(0, 160) || undefined;
  const cursor = filters.cursor?.trim() || undefined;
  const { items, nextCursor } = await getPublishedNews({
    category,
    query,
    cursor,
    language: isId ? 'id' : 'en',
    limit: 36,
  });

  const featured = cursor ? null : items[0] || null;
  const rest = cursor ? items : items.slice(1);
  const compact = rest.slice(0, 2);
  const grid = rest.slice(2);

  return (
    <main className="page-shell page-rhythm pb-12 pt-5 sm:pt-6">
      <section className="overflow-hidden rounded-[26px] border border-emerald-100 bg-[linear-gradient(135deg,#f0fdf4_0%,#ffffff_52%,#fffaf2_100%)] shadow-[0_20px_60px_-48px_rgba(15,23,42,0.3)] dark:border-white/10 dark:bg-[linear-gradient(135deg,#06261b_0%,#0f172a_62%,#1c1917_100%)]">
        <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-end lg:p-7">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-[12px] bg-emerald-700 text-sm font-black text-white shadow-sm">L</span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Lajukan</p>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">News</p>
              </div>
            </div>
            <h1 className="mt-3 max-w-3xl text-[30px] font-black leading-[1.08] tracking-[-0.055em] text-slate-950 dark:text-white sm:text-4xl">
              {isId ? 'Berita yang membantu usaha bergerak.' : 'News that helps businesses move.'}
            </h1>
            <p className="mt-2.5 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-[15px]">
              {isId
                ? 'Ringkas, jelas, dan relevan untuk memahami apa yang berubah dan apa langkah berikutnya.'
                : 'Clear, practical updates on what changed and what businesses can do next.'}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <Link href="/news/submit" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800">
              <Send className="h-4 w-4" />
              {isId ? 'Kirim berita' : 'Submit news'}
            </Link>
            <Link href="/explore" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-4 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-800 dark:border-white/10 dark:bg-slate-950/30 dark:text-slate-200">
              <Store className="h-4 w-4" />
              {isId ? 'Cari usaha' : 'Explore'}
            </Link>
          </div>
        </div>
      </section>

      <nav aria-label={isId ? 'Kategori berita' : 'News categories'} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
        <Link href="/news" className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${!category ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200'}`}>
          {isId ? 'Semua' : 'All'}
        </Link>
        {CATEGORIES.map(item => (
          <Link
            key={item}
            href={`/news/category/${item.toLowerCase()}`}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${category?.toLowerCase() === item.toLowerCase() ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200'}`}
          >
            {item}
          </Link>
        ))}
      </nav>

      <form method="get" className="flex gap-2" role="search">
        {category ? <input type="hidden" name="category" value={category} /> : null}
        <label htmlFor="news-search" className="sr-only">{isId ? 'Cari berita' : 'Search news'}</label>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="news-search"
            name="q"
            defaultValue={query}
            maxLength={160}
            placeholder={isId ? 'Cari judul, topik, atau kategori…' : 'Search title, topic, or category…'}
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:focus:ring-emerald-950"
          />
        </div>
        <button type="submit" className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white dark:bg-white dark:text-slate-950">
          {isId ? 'Cari' : 'Search'}
        </button>
      </form>

      <div className="flex min-h-5 items-center justify-between gap-3">
        <div className="min-w-0 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
          {query ? (isId ? `Hasil untuk “${query}”` : `Results for “${query}”`) : (isId ? 'Berita terbaru' : 'Latest stories')}
        </div>
        <div className="shrink-0 text-[10px] font-bold text-slate-400">
          {items.length} {isId ? 'artikel' : 'articles'}
        </div>
      </div>

      {!items.length ? (
        <section className="rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-center dark:border-white/15 dark:bg-slate-900">
          <TrendingUp className="mx-auto h-7 w-7 text-emerald-700 dark:text-emerald-300" />
          <h2 className="mt-3 text-lg font-bold text-slate-950 dark:text-white">
            {isId ? 'Belum ada berita untuk filter ini.' : 'No published news for this filter yet.'}
          </h2>
          <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
            {isId ? 'Coba kategori atau kata kunci lain.' : 'Try another category or search term.'}
          </p>
        </section>
      ) : null}

      {featured ? (
        <section className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
          <NewsCard article={featured} locale={locale} variant="hero" priority />
          <div className="grid gap-2.5">
            {compact.map(item => (
              <NewsCard key={item.id} article={item} locale={locale} variant="compact" />
            ))}
            {compact.length < 2 ? (
              <div className="hidden rounded-[20px] border border-dashed border-slate-200 bg-slate-50 p-4 lg:block dark:border-white/10 dark:bg-white/[0.03]" />
            ) : null}
          </div>
        </section>
      ) : null}

      {grid.length ? (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">{isId ? 'Arsip terbaru' : 'Latest updates'}</p>
              <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">{isId ? 'Lebih banyak berita' : 'More stories'}</h2>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {grid.map(item => <NewsCard key={item.id} article={item} locale={locale} variant="grid" />)}
          </div>
        </section>
      ) : null}

      {nextCursor ? (
        <nav aria-label={isId ? 'Navigasi berita' : 'News navigation'} className="flex justify-center pt-1">
          <Link
            href={buildNewsIndexHref({ category, query, cursor: nextCursor })}
            rel="next"
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-xs font-bold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-800 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
          >
            {isId ? 'Berita berikutnya' : 'Next articles'}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </nav>
      ) : null}
    </main>
  );
}
