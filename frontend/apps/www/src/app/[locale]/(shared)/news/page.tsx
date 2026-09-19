import type { Metadata } from 'next';
import { ArrowRight, BarChart3, Building2, Clock3, Newspaper, Search, Send, Store, TrendingUp } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { buildNewsPath, buildNewsUrl, getPublishedNews } from '@/lib/news';

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
      <section className="border-y border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950"><div className="px-4 py-5 sm:px-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Lajukan News</p><h1 className="mt-1 text-3xl font-black tracking-[-0.045em] text-slate-950 dark:text-white sm:text-4xl">{isId ? 'Berita ekonomi & usaha' : 'Economy & business news'}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">{isId ? 'Berita, perkembangan daerah, dan informasi yang relevan untuk pelaku usaha.' : 'News, local developments, and information relevant to business owners.'}</p></div><Link href="/news/submit" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800"><Send className="h-4 w-4" />{isId ? 'Kirim berita' : 'Submit news'}</Link></div></div></section>

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
          <Link href={buildNewsPath(featured.slug)} className="group overflow-hidden border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">{featured.coverImage ? <div className="aspect-[16/9] overflow-hidden bg-slate-100 dark:bg-slate-800"><img
                src={featured.coverImage}
                alt={featured.title}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                loading="eager"
                onError={event => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = '/opengraph-image.png';
                }}
              /></div> : <div className="flex aspect-[16/9] items-end bg-slate-100 p-5 dark:bg-slate-800"><span className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-400">Lajukan News</span></div>}<div className="p-5 sm:p-7"><div className="flex items-center gap-2 text-xs font-extrabold text-emerald-700 dark:text-emerald-300"><span>{featured.category}</span>{featured.location ? <><span className="text-slate-300">•</span><span className="text-slate-500">{featured.location}</span></> : null}</div><h2 className="mt-2 text-3xl font-black leading-tight tracking-[-0.04em] text-slate-950 group-hover:text-emerald-800 dark:text-white sm:text-4xl">{featured.title}</h2>{featured.summary ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{featured.summary}</p> : null}<div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400"><Clock3 className="h-3.5 w-3.5" />{formatDate(featured.publishedAt, locale)}</div></div></Link>
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
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"><div><div className="mb-4 border-b-2 border-slate-950 pb-2 dark:border-white"><h2 className="text-xl font-black text-slate-950 dark:text-white">{isId ? 'Berita terbaru' : 'Latest news'}</h2></div><div className="divide-y divide-slate-200 dark:divide-white/10">{rest.map(article => <Link key={article.id} href={buildNewsPath(article.slug)} className="group grid gap-4 py-5 sm:grid-cols-[180px_minmax(0,1fr)]"><div className="aspect-[16/10] overflow-hidden bg-slate-100 dark:bg-slate-800">{article.coverImage ? <img src={article.coverImage} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.02]" loading="lazy" /> : <div className="flex h-full items-end p-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Lajukan News</div>}</div><div className="min-w-0"><div className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">{article.category}</div><h3 className="mt-1 text-xl font-extrabold leading-7 tracking-[-0.025em] text-slate-950 group-hover:text-emerald-800 dark:text-white">{article.title}</h3>{article.summary ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{article.summary}</p> : null}<p className="mt-3 text-xs font-semibold text-slate-500">{formatDate(article.publishedAt, locale)}{article.location ? ` · ${article.location}` : ''}</p></div></Link>)}</div></div><aside className="hidden lg:block"><div className="sticky top-20 border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900"><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">{isId ? 'Tentang Lajukan News' : 'About Lajukan News'}</p><p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{isId ? 'Kiriman komunitas melewati review editorial sebelum diterbitkan. Sumber dan koreksi material dicatat.' : 'Community submissions go through editorial review before publication. Sources and material corrections are recorded.'}</p></div></aside></section>
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
