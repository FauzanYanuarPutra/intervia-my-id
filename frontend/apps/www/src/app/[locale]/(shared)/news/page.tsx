import type { Metadata } from 'next';
import { ArrowRight, BarChart3, Building2, Newspaper, Send, Store, TrendingUp } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { buildNewsPath, buildNewsUrl, getPublishedNews } from '@/lib/news';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; q?: string }>;
};

const CATEGORIES = ['Ekonomi', 'Bisnis', 'UMKM', 'Teknologi', 'Keuangan', 'Regulasi', 'Industri', 'Daerah'] as const;

export async function generateMetadata({ params }: Pick<PageProps, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  const isId = locale === 'id';
  const title = isId ? 'Lajukan News | Ekonomi, Bisnis, dan UMKM' : 'Lajukan News | Economy, Business, and SMEs';
  const description = isId
    ? 'Berita ekonomi, bisnis, UMKM, teknologi, regulasi, dan daerah yang diterjemahkan menjadi dampak praktis untuk pelaku usaha.'
    : 'Economy, business, SME, technology, regulation, and local news translated into practical impact for business owners.';
  return {
    title,
    description,
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

export default async function NewsIndexPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const filters = await searchParams;
  const isId = locale === 'id';
  const category = filters.category?.trim() || undefined;
  const query = filters.q?.trim() || undefined;
  const { items } = await getPublishedNews({ category, query, limit: 36 });
  const featured = items[0];
  const rest = items.slice(1);

  return (
    <main className="page-shell page-rhythm pb-12 pt-6">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ecfdf5_52%,#fff7ed_100%)] p-5 shadow-[0_24px_64px_-48px_rgba(15,23,42,0.34)] dark:border-white/10 dark:bg-[linear-gradient(135deg,#0f172a_0%,#052e24_56%,#1c1917_100%)] sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white dark:bg-white dark:text-slate-950">
              <Newspaper className="h-3.5 w-3.5" />
              Lajukan News
            </p>
            <h1 className="mt-4 max-w-4xl text-3xl font-bold tracking-[-0.06em] text-slate-950 dark:text-white sm:text-5xl">
              {isId ? 'Berita yang berhenti bukan di headline, tapi di dampaknya ke usaha.' : 'News that goes beyond headlines to explain business impact.'}
            </h1>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300 sm:text-base">
              {isId
                ? 'Ekonomi, bisnis, UMKM, teknologi, regulasi, dan perkembangan daerah. Kiriman komunitas masuk antrean editorial sebelum dapat diterbitkan sebagai Lajukan News.'
                : 'Economy, business, SMEs, technology, regulation, and local developments. Community submissions enter editorial review before publication as Lajukan News.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/news/submit" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">
                <Send className="h-4 w-4" />
                {isId ? 'Kirim berita' : 'Submit news'}
              </Link>
              <Link href="/news/submissions" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:border-emerald-200 dark:border-white/10 dark:bg-white/10 dark:text-white">
                {isId ? 'Kiriman saya' : 'My submissions'}
              </Link>
              <Link href="/blog" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:border-emerald-200 dark:border-white/10 dark:bg-white/10 dark:text-white">
                <BarChart3 className="h-4 w-4" />
                {isId ? 'Panduan usaha' : 'Business guides'}
              </Link>
            </div>
          </div>
          <aside className="rounded-[26px] border border-white/80 bg-white/90 p-5 dark:border-white/10 dark:bg-slate-950/60">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              {isId ? 'Standar publikasi' : 'Publishing standard'}
            </p>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
              {isId
                ? 'News dipisahkan dari opini dan forum. Sumber, koreksi, jenis konten, dan jejak review disimpan agar informasi tetap dapat dipertanggungjawabkan.'
                : 'News is separated from opinion and forum content. Sources, corrections, content type, and review history are retained for accountability.'}
            </p>
          </aside>
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

      {featured ? (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
          <Link href={buildNewsPath(featured.slug)} className="group rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_22px_54px_-44px_rgba(15,23,42,0.32)] transition hover:-translate-y-0.5 hover:border-emerald-200 dark:border-white/10 dark:bg-slate-900 sm:p-7">
            <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.12em]">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">{featured.category}</span>
              {featured.location ? <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 dark:bg-white/10 dark:text-slate-300">{featured.location}</span> : null}
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-[-0.05em] text-slate-950 group-hover:text-emerald-800 dark:text-white dark:group-hover:text-emerald-200 sm:text-4xl">
              {featured.title}
            </h2>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">{featured.summary}</p>
            <div className="mt-5 flex items-center justify-between gap-3 text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>{formatDate(featured.publishedAt, locale)}</span>
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">{isId ? 'Baca berita' : 'Read'} <ArrowRight className="h-3.5 w-3.5" /></span>
            </div>
          </Link>
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
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map(article => (
            <Link key={article.id} href={buildNewsPath(article.slug)} className="group flex min-h-[260px] flex-col rounded-[28px] border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-200 dark:border-white/10 dark:bg-slate-900">
              <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.12em]">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">{article.category}</span>
                {article.articleKind === 'press_release' ? <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700 dark:bg-amber-400/10 dark:text-amber-200">{isId ? 'Rilis bisnis' : 'Business release'}</span> : null}
              </div>
              <h2 className="mt-3 text-xl font-bold tracking-[-0.04em] text-slate-950 group-hover:text-emerald-800 dark:text-white dark:group-hover:text-emerald-200">{article.title}</h2>
              <p className="mt-3 line-clamp-4 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{article.summary}</p>
              <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-xs font-bold text-slate-500 dark:text-slate-400">
                <span>{formatDate(article.publishedAt, locale)}</span>
                <ArrowRight className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
              </div>
            </Link>
          ))}
        </section>
      ) : null}
    </main>
  );
}
