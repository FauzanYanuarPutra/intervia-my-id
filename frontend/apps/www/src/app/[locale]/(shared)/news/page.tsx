import type { Metadata } from 'next';
import { ArrowRight, Building2, Clock3, Newspaper, Search, Send, Store, TrendingUp } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { buildNewsPath, buildNewsUrl, getPublishedNews, type LajukanNewsArticle } from '@/lib/news';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; q?: string; cursor?: string }>;
};

const CATEGORIES = ['Ekonomi', 'Bisnis', 'UMKM', 'Teknologi', 'Keuangan', 'Regulasi', 'Industri', 'Daerah'] as const;

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const filters = await searchParams;
  const hasQueryVariant = Boolean(
    filters.q?.trim() || filters.category?.trim() || filters.cursor?.trim(),
  );
  const isId = locale === 'id';
  const title = isId ? 'Lajukan News | Ekonomi, Bisnis, dan UMKM' : 'Lajukan News | Economy, Business, and SMEs';
  const description = isId
    ? 'Berita ekonomi, bisnis, UMKM, teknologi, regulasi, dan daerah yang diterjemahkan menjadi dampak praktis untuk pelaku usaha.'
    : 'Economy, business, SME, technology, regulation, and local news translated into practical impact for business owners.';
  return {
    title,
    description,
    robots: hasQueryVariant
      ? { index: false, follow: true }
      : {
          index: true,
          follow: true,
          googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
        },
    alternates: {
      canonical: buildNewsUrl(locale),
      languages: {
        id: buildNewsUrl('id'),
        en: buildNewsUrl('en'),
        'x-default': buildNewsUrl('id'),
      },
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

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}


function articleKindLabel(
  kind: LajukanNewsArticle['articleKind'],
  isId: boolean,
) {
  if (kind === 'analysis') return isId ? 'Analisis' : 'Analysis';
  if (kind === 'press_release') return isId ? 'Rilis bisnis' : 'Business release';
  return isId ? 'Berita' : 'News';
}

function NewsMedia({
  article,
  variant = 'card',
}: {
  article: LajukanNewsArticle;
  variant?: 'hero' | 'card' | 'thumb';
}) {
  const sizeClass =
    variant === 'hero'
      ? 'aspect-[16/8] sm:aspect-[16/7]'
      : variant === 'thumb'
        ? 'aspect-[4/3]'
        : 'aspect-[16/10]';

  if (!article.coverImage) {
    return (
      <div className={'relative overflow-hidden ' + sizeClass + ' bg-[linear-gradient(135deg,#ecfdf5_0%,#f8fafc_54%,#fff7ed_100%)] dark:bg-[linear-gradient(135deg,#082319_0%,#0f172a_62%,#1c1917_100%)]'}>
        <div className="absolute inset-0 flex items-center justify-between gap-4 p-5 sm:p-7">
          <div className="min-w-0">
            <span className="inline-flex rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-800 dark:bg-slate-950/70 dark:text-emerald-300">
              Lajukan News
            </span>
            <p className="mt-2 truncate text-sm font-black text-slate-700 dark:text-slate-200">
              {article.category}
            </p>
          </div>
          <Newspaper className="h-9 w-9 shrink-0 text-emerald-700/25 dark:text-emerald-300/25" />
        </div>
      </div>
    );
  }

  return (
    <div className={'relative overflow-hidden bg-slate-100 dark:bg-slate-800 ' + sizeClass}>
      <img
        src={article.coverImage}
        alt=""
        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
        loading={variant === 'hero' ? 'eager' : 'lazy'}
        decoding="async"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
    </div>
  );
}

function buildNewsIndexHref(filters: {
  category?: string;
  query?: string;
  cursor?: string;
}) {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.query) params.set('q', filters.query);
  if (filters.cursor) params.set('cursor', filters.cursor);
  const queryString = params.toString();
  return queryString ? `/news?${queryString}` : '/news';
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
  const featured = cursor ? undefined : items[0];
  const rest = cursor ? items : items.slice(1);

  return (
    <main className="page-shell page-rhythm pb-12 pt-6">
      <section className="overflow-hidden rounded-[28px] border border-emerald-100 bg-[linear-gradient(135deg,#f0fdf4_0%,#ffffff_48%,#fffaf2_100%)] shadow-[0_20px_60px_-46px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[linear-gradient(135deg,#06261b_0%,#0f172a_62%,#1c1917_100%)]">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end lg:p-8">
          <div className="min-w-0">
            <span className="inline-flex rounded-full bg-emerald-700 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white">Lajukan News</span>
            <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-[-0.055em] text-slate-950 dark:text-white sm:text-4xl">{isId ? 'Berita ekonomi, bisnis, dan peluang usaha.' : 'Economy, business, and opportunity in one place.'}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">{isId ? 'Berita yang ringkas, jelas, dan relevan untuk membantu pelaku usaha mengambil langkah berikutnya.' : 'Clear, practical news to help businesses understand what matters and what to do next.'}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <Link href="/news/submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800"><Send className="h-4 w-4" />{isId ? 'Kirim berita' : 'Submit news'}</Link>
            <Link href="/explore" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-4 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-800 dark:border-white/10 dark:bg-slate-950/30 dark:text-slate-200"><Store className="h-4 w-4" />{isId ? 'Cari usaha terkait' : 'Explore businesses'}</Link>
          </div>
        </div>
      </section>

      <nav aria-label={isId ? 'Kategori berita' : 'News categories'} className="flex gap-2 overflow-x-auto pb-1">
        <Link href="/news" className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-bold ${!category ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200'}`}>
          {isId ? 'Semua' : 'All'}
        </Link>
        {CATEGORIES.map(item => (
          <Link
            key={item}
            href={`/news/category/${item.toLowerCase()}`}
            className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-bold ${category?.toLowerCase() === item.toLowerCase() ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200'}`}
          >
            {item}
          </Link>
        ))}
      </nav>

      <form method="get" className="flex gap-2 border-b border-slate-200 pb-4 dark:border-white/10" role="search">{category ? <input type="hidden" name="category" value={category} /> : null}<label htmlFor="news-search" className="sr-only">{isId ? 'Cari berita' : 'Search news'}</label><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input id="news-search" name="q" defaultValue={query} maxLength={160} placeholder={isId ? 'Cari berita…' : 'Search news…'} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-900 dark:text-white" /></div><button type="submit" className="min-h-11 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white dark:bg-white dark:text-slate-950">{isId ? 'Cari' : 'Search'}</button></form>

      {query ? (
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {isId ? 'Hasil pencarian untuk' : 'Search results for'} “{query}”
        </p>
      ) : null}

      {featured ? (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
          <Link href={buildNewsPath(featured.slug)} className="group overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_50px_-42px_rgba(15,23,42,0.38)] dark:border-white/10 dark:bg-slate-900"><NewsMedia article={featured} variant="hero" /><div className="p-5 sm:p-7"><div className="flex items-center gap-2 text-xs font-extrabold text-emerald-700 dark:text-emerald-300"><span>{featured.category}</span>{featured.location ? <><span className="text-slate-300">•</span><span className="text-slate-500">{featured.location}</span></> : null}</div><h2 className="mt-2 text-3xl font-black leading-tight tracking-[-0.04em] text-slate-950 group-hover:text-emerald-800 dark:text-white sm:text-4xl">{featured.title}</h2>{featured.summary ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{featured.summary}</p> : null}<div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400"><Clock3 className="h-3.5 w-3.5" />{formatDate(featured.publishedAt, locale)}</div></div></Link>
          <div className="grid gap-3">
            <Link href="/explore" className="rounded-[26px] border border-slate-200 bg-[#f8f5ee] p-5 dark:border-white/10 dark:bg-white/[0.04]">
              <Store className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
              <h3 className="mt-3 font-bold text-slate-950 dark:text-white">{isId ? 'Temukan pelaku usaha terkait' : 'Discover related businesses'}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{isId ? 'Berita bisa menjadi pintu masuk ke supplier, jasa, produk, dan usaha di Lajukan.' : 'News can lead into suppliers, services, products, and businesses on Lajukan.'}</p>
            </Link>
            <Link href="/community" className="rounded-[26px] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
              <Building2 className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
              <h3 className="mt-3 font-bold text-slate-950 dark:text-white">{isId ? 'Diskusi tetap di Community' : 'Discussion stays in Community'}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{isId ? 'Opini dan percakapan pengguna tidak dicampur dengan berita yang telah direview.' : 'User opinion and discussion are not mixed with reviewed news.'}</p>
            </Link>
          </div>
        </section>
      ) : (
        <section className="rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-center dark:border-white/15 dark:bg-slate-900">
          <TrendingUp className="mx-auto h-7 w-7 text-emerald-700 dark:text-emerald-300" />
          <h2 className="mt-3 text-lg font-bold text-slate-950 dark:text-white">{isId ? 'Belum ada berita terbit untuk filter ini.' : 'No published news for this filter yet.'}</h2>
          <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">{isId ? 'Berita baru akan muncul setelah melewati review editorial.' : 'New items appear after editorial review.'}</p>
        </section>
      )}

      {rest.length > 0 ? (
        <section className="mt-2">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                {isId ? 'Update' : 'Updates'}
              </p>
              <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">
                {isId ? 'Berita terbaru' : 'Latest news'}
              </h2>
            </div>
            <span className="text-xs font-bold text-slate-400">
              {rest.length}
              {isId ? ' artikel' : ' articles'}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rest.map(article => (
              <Link
                key={article.id}
                href={buildNewsPath(article.slug)}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm dark:border-white/10 dark:bg-slate-900"
              >
                <NewsMedia article={article} />
                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.1em]">
                    <span className="text-emerald-700 dark:text-emerald-300">{article.category}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-400">{articleKindLabel(article.articleKind, isId)}</span>
                  </div>
                  <h3 className="mt-1.5 line-clamp-3 text-base font-black leading-6 tracking-[-0.02em] text-slate-950 group-hover:text-emerald-800 dark:text-white dark:group-hover:text-emerald-300">
                    {article.title}
                  </h3>
                  {article.summary ? (
                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600 dark:text-slate-300">
                      {article.summary}
                    </p>
                  ) : null}
                  <div className="mt-3 flex min-w-0 items-center justify-between gap-2 text-[10px] font-bold text-slate-400">
                    <span className="min-w-0 truncate">{article.location || article.byline}</span>
                    <span className="shrink-0">{formatDate(article.publishedAt, locale)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {nextCursor ? (
        <nav aria-label={isId ? 'Navigasi berita' : 'News navigation'} className="flex justify-center">
          <Link
            href={buildNewsIndexHref({ category, query, cursor: nextCursor })}
            rel="next"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-800 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
          >
            {isId ? 'Berita berikutnya' : 'Next articles'}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </nav>
      ) : null}
    </main>
  );
}
