import type { Metadata } from 'next';
import { BookOpenText, Search, Send, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { buildBlogIndexJsonLd, buildBlogPath, buildBlogUrl, getPublishedBlogArticles } from '@/lib/blog';
import { serializeJsonLd } from '@/lib/seo/jsonLd';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
};

const CATEGORIES = ['UMKM','Bisnis','Supplier','Operasional','Teknologi','AI','Pemasaran','Keuangan','Produksi','Inspirasi'] as const;

function pageNumber(raw?: string): number {
  const value = Number(raw || '1');
  return Number.isFinite(value) ? Math.min(100, Math.max(1, Math.floor(value))) : 1;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const filters = await searchParams;
  const isId = locale !== 'en';
  const filtered = Boolean(filters.q?.trim() || filters.category?.trim() || pageNumber(filters.page) > 1);
  const title = isId ? 'Blog Lajukan | Panduan UMKM & Bisnis' : 'Lajukan Blog | SME & Business Guides';
  const description = isId
    ? 'Panduan praktis untuk UMKM dan pelaku usaha Indonesia: supplier, operasional, teknologi, pemasaran, AI, dan keuangan.'
    : 'Practical guides for Indonesian SMEs and business owners: suppliers, operations, technology, marketing, AI, and finance.';
  return {
    title,
    description,
    robots: filtered ? { index: false, follow: true } : { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
    alternates: { canonical: buildBlogUrl(locale), languages: { id: buildBlogUrl('id'), en: buildBlogUrl('en'), 'x-default': buildBlogUrl('id') } },
    openGraph: { title, description, url: buildBlogUrl(locale), siteName: 'Lajukan', type: 'website', images: [{ url: 'https://www.lajukan.com/opengraph-image.png', width: 1200, height: 630, alt: 'Lajukan Blog' }] },
  };
}

export default async function BlogIndexPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const filters = await searchParams;
  const page = pageNumber(filters.page);
  const { items, hasMore } = await getPublishedBlogArticles(locale, { query: filters.q, category: filters.category, offset: (page - 1) * 24, limit: 24 });
  const isId = locale !== 'en';
  const featured = page === 1 ? items[0] || null : null;
  const rest = featured ? items.slice(1) : items;

  return (
    <main className="page-shell page-rhythm pb-12 pt-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildBlogIndexJsonLd(locale, items)) }} />
      <section className="overflow-hidden rounded-[30px] border border-emerald-100 bg-[linear-gradient(135deg,#fffdf6_0%,#effdf5_48%,#fff7ed_100%)] p-5 shadow-sm dark:border-white/10 dark:bg-slate-950 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-white"><BookOpenText className="h-3.5 w-3.5" />Lajukan Blog</p>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.055em] text-slate-950 dark:text-white sm:text-5xl">{isId ? 'Panduan yang membantu usaha bergerak.' : 'Guides that help businesses move.'}</h1>
            <p className="mt-3 text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">{isId ? 'Konten dari komunitas, pelaku usaha, dan tim Lajukan. Artikel bisa dikirim untuk review atau diterbitkan langsung sesuai hak publikasi.' : 'Content from the community, business owners, and Lajukan. Articles can go through review or be published instantly when permitted.'}</p>
          </div>
          <Link href="/blog/submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-700 px-5 text-sm font-black text-white hover:bg-emerald-800"><Send className="h-4 w-4" />{isId ? 'Tulis artikel' : 'Write article'}</Link>
        </div>
      </section>

      <nav aria-label={isId ? 'Kategori blog' : 'Blog categories'} className="flex gap-1.5 overflow-x-auto py-2">
        <Link href="/blog" className={!filters.category ? 'rounded-full bg-emerald-700 px-3 py-1.5 text-xs font-black text-white' : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold dark:border-white/10 dark:bg-slate-900 dark:text-white'}>{isId ? 'Semua' : 'All'}</Link>
        {CATEGORIES.map(category => <Link key={category} href={'/blog?category=' + encodeURIComponent(category)} className={filters.category?.toLowerCase() === category.toLowerCase() ? 'rounded-full bg-emerald-700 px-3 py-1.5 text-xs font-black text-white' : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold dark:border-white/10 dark:bg-slate-900 dark:text-white'}>{category}</Link>)}
      </nav>

      <form method="get" className="flex gap-2">
        {filters.category ? <input type="hidden" name="category" value={filters.category} /> : null}
        <label htmlFor="blog-search" className="sr-only">{isId ? 'Cari artikel' : 'Search articles'}</label>
        <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input id="blog-search" name="q" defaultValue={filters.q} maxLength={120} placeholder={isId ? 'Cari topik, judul, atau panduan…' : 'Search topics, titles, or guides…'} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-900 dark:text-white" /></div>
        <button type="submit" className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-black text-white dark:bg-white dark:text-slate-950">{isId ? 'Cari' : 'Search'}</button>
      </form>

      {!items.length ? (
        <section className="rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-center dark:border-white/10 dark:bg-slate-900"><h2 className="text-lg font-black">{isId ? 'Belum ada artikel untuk filter ini.' : 'No articles for this filter yet.'}</h2></section>
      ) : (
        <>
          {featured ? (
            <Link href={buildBlogPath(featured.slug)} className="group block overflow-hidden rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-7">
              <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
                <div className="overflow-hidden rounded-2xl bg-slate-100 aspect-[4/3]">{featured.coverImage ? <img src={featured.coverImage} alt={featured.title} className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-emerald-50 to-slate-100 dark:from-emerald-950/40 dark:to-slate-900" />}</div>
                <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">{featured.category}</p><h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">{featured.title}</h2><p className="mt-3 text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">{featured.summary}</p><div className="mt-4 text-xs font-bold text-slate-500">{featured.authorName} · {new Date(featured.publishedAt || featured.updatedAt).toLocaleDateString(isId ? 'id-ID' : 'en-US')}</div></div>
              </div>
            </Link>
          ) : null}
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rest.map(article => <Link key={article.id} href={buildBlogPath(article.slug)} className="group flex min-h-[260px] flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm hover:border-emerald-200 dark:border-white/10 dark:bg-slate-900">
              {article.coverImage ? <img src={article.coverImage} alt={article.title} className="aspect-[16/9] w-full object-cover" loading="lazy" /> : <div className="aspect-[16/9] bg-gradient-to-br from-emerald-50 to-slate-100 dark:from-emerald-950/40 dark:to-slate-900" />}
              <div className="flex flex-1 flex-col p-4"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">{article.category}</p><h2 className="mt-2 line-clamp-3 text-lg font-black text-slate-950 dark:text-white">{article.title}</h2><p className="mt-2 line-clamp-3 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">{article.summary}</p><div className="mt-auto pt-4 text-xs font-bold text-slate-500">{article.authorName} · {new Date(article.publishedAt || article.updatedAt).toLocaleDateString(isId ? 'id-ID' : 'en-US')}</div></div>
            </Link>)}
          </section>
          <div className="flex items-center justify-center gap-2 pt-2">
            {page > 1 ? <Link href={'/blog?' + new URLSearchParams({ ...(filters.q ? { q: filters.q } : {}), ...(filters.category ? { category: filters.category } : {}), page: String(page - 1) }).toString()} rel="prev" className="rounded-full border px-4 py-2 text-xs font-bold">{isId ? 'Sebelumnya' : 'Previous'}</Link> : null}
            {hasMore ? <Link href={'/blog?' + new URLSearchParams({ ...(filters.q ? { q: filters.q } : {}), ...(filters.category ? { category: filters.category } : {}), page: String(page + 1) }).toString()} rel="next" className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-4 py-2 text-xs font-bold text-white">{isId ? 'Berikutnya' : 'Next'}<ArrowRight className="h-3.5 w-3.5" /></Link> : null}
          </div>
        </>
      )}
    </main>
  );
}
