import type { Metadata } from 'next';
import { Search, Send, Store, TrendingUp } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { NewsCard } from '@/components/news/NewsCard';
import { NewsCarousel } from '@/components/news/NewsCarousel';
import { buildNewsFacetPath, buildNewsUrl, getPublishedNews } from '@/lib/news';

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

  const sliderItems = items.slice(0, 6);
  const grid = cursor ? items.slice(6) : items.slice(1);

  return (
    <main className="page-shell page-rhythm pb-12 pt-4 sm:pt-6">
      <section className="overflow-hidden rounded-[28px] border border-emerald-100/80 bg-[linear-gradient(135deg,#effcf5_0%,#ffffff_48%,#fffaf1_100%)] shadow-[0_28px_70px_-58px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[linear-gradient(135deg,#06261b_0%,#0f172a_62%,#1c1917_100%)]">
        <div className="p-4 sm:p-6 lg:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] border border-emerald-100 bg-white p-2 shadow-sm dark:border-emerald-400/20 dark:bg-white/10">
                <img src="/logo.svg" alt="" className="h-5 w-auto object-contain" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Lajukan News</p>
                <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {isId ? 'Berita ekonomi & usaha' : 'Economy & business news'}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/news/submit"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-emerald-200 bg-white/90 px-3 text-xs font-black text-emerald-800 transition hover:border-emerald-300 hover:bg-white dark:border-emerald-400/20 dark:bg-white/[0.04] dark:text-emerald-200"
              >
                <Send className="h-3.5 w-3.5" />
                {isId ? 'Kirim berita' : 'Submit'}
              </Link>
              <Link
                href="/explore"
                className="hidden min-h-9 items-center gap-1.5 rounded-xl bg-slate-950 px-3 text-xs font-black text-white transition hover:bg-slate-800 sm:inline-flex dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                <Store className="h-3.5 w-3.5" />
                {isId ? 'Cari usaha' : 'Explore'}
              </Link>
            </div>
          </div>

          <div className="mt-5 max-w-3xl">
            <h1 className="text-[30px] font-black leading-[1.03] tracking-[-0.055em] text-slate-950 dark:text-white sm:text-[42px]">
              {isId ? 'Berita yang bantu kamu mengambil langkah.' : 'News that helps you decide what to do next.'}
            </h1>
            <p className="mt-2.5 max-w-2xl text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300 sm:text-[15px]">
              {isId
                ? 'Ringkas, jelas, dan fokus pada perubahan yang punya arti untuk usaha.'
                : 'Clear, practical updates focused on changes that matter to businesses.'}
            </p>
          </div>

          <form method="get" className="mt-5 flex flex-col gap-2 sm:flex-row" role="search">
            {category ? <input type="hidden" name="category" value={category} /> : null}
            <label htmlFor="news-search" className="sr-only">{isId ? 'Cari berita' : 'Search news'}</label>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="news-search"
                name="q"
                defaultValue={query}
                maxLength={160}
                placeholder={isId ? 'Cari berita, topik, atau kategori…' : 'Search stories, topics, or categories…'}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-white/10 dark:bg-slate-950/30 dark:text-white dark:focus:ring-emerald-950"
              />
            </div>
            <button type="submit" className="min-h-11 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white transition hover:bg-emerald-800">
              {isId ? 'Cari berita' : 'Search'}
            </button>
          </form>
        </div>
      </section>

      <nav aria-label={isId ? 'Kategori berita' : 'News categories'} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 scrollbar-none">
        <Link
          href="/news"
          className={!category
            ? 'shrink-0 rounded-full bg-emerald-700 px-3.5 py-2 text-xs font-black text-white shadow-sm'
            : 'shrink-0 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200'}
        >
          {isId ? 'Semua' : 'All'}
        </Link>
        {CATEGORIES.map(item => (
          <Link
            key={item}
            href={buildNewsFacetPath('topic', item)}
            className={category?.toLowerCase() === item.toLowerCase()
              ? 'shrink-0 rounded-full bg-emerald-700 px-3.5 py-2 text-xs font-black text-white shadow-sm'
              : 'shrink-0 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200'}
          >
            {item}
          </Link>
        ))}
      </nav>

      {!items.length ? (
        <section className="rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-center dark:border-white/15 dark:bg-slate-900">
          <TrendingUp className="mx-auto h-7 w-7 text-emerald-700 dark:text-emerald-300" />
          <h2 className="mt-3 text-lg font-black text-slate-950 dark:text-white">
            {isId ? 'Belum ada berita untuk filter ini.' : 'No stories for this filter yet.'}
          </h2>
          <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
            {isId ? 'Coba kata kunci atau kategori lain.' : 'Try another keyword or category.'}
          </p>
        </section>
      ) : null}

      {sliderItems.length ? (
        <NewsCarousel
          articles={sliderItems}
          locale={locale}
          eyebrow={query ? (isId ? 'Hasil pencarian' : 'Search results') : (isId ? 'Pilihan terbaru' : 'Latest picks')}
          title={isId ? 'Cerita yang layak dibaca' : 'Stories worth reading'}
        />
      ) : null}

      {grid.length ? (
        <section className="mt-8">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                {isId ? 'Lebih banyak' : 'More stories'}
              </p>
              <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">
                {isId ? 'Berita terbaru lainnya' : 'More from Lajukan News'}
              </h2>
            </div>
            <span className="shrink-0 text-[10px] font-bold text-slate-400">
              {grid.length} {isId ? 'artikel' : 'stories'}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {grid.map(item => (
              <NewsCard key={item.id} article={item} locale={locale} variant="grid" />
            ))}
          </div>
        </section>
      ) : null}

      {nextCursor ? (
        <nav aria-label={isId ? 'Navigasi berita' : 'News navigation'} className="flex justify-center pt-5">
          <Link
            href={buildNewsIndexHref({ category, query, cursor: nextCursor })}
            rel="next"
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-xs font-black text-slate-700 transition hover:border-emerald-300 hover:text-emerald-800 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
          >
            {isId ? 'Berita berikutnya' : 'Next stories'}
          </Link>
        </nav>
      ) : null}
    </main>
  );
}
