import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, MapPin } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { buildNewsFacetUrl, buildNewsPath, getPublishedNews } from '@/lib/news';

type Props = { params: Promise<{ locale: string; location: string }> };

function cleanFacet(value: string): string {
  return decodeURIComponent(value).trim().slice(0, 120);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, location } = await params;
  const value = cleanFacet(location);
  if (!value) return { robots: { index: false, follow: true } };
  const canonical = buildNewsFacetUrl(locale, 'location', value);
  return {
    title: `${value} | Berita Daerah Lajukan`,
    description: locale === 'id'
      ? `Berita ekonomi, bisnis, dan UMKM terbaru dari ${value}.`
      : `Latest economy, business, and SME news from ${value}.`,
    alternates: {
      canonical,
      languages: {
        id: buildNewsFacetUrl('id', 'location', value),
        en: buildNewsFacetUrl('en', 'location', value),
        'x-default': buildNewsFacetUrl('id', 'location', value),
      },
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
    },
  };
}

export default async function NewsLocationPage({ params }: Props) {
  const { locale, location } = await params;
  const value = cleanFacet(location);
  if (!value) notFound();
  const isId = locale === 'id';
  const { items } = await getPublishedNews({ location: value, limit: 48 });

  return (
    <main className="page-shell page-rhythm pb-12 pt-6">
      <Link href="/news" className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">
        <ArrowLeft className="h-3.5 w-3.5" /> Lajukan News
      </Link>
      <section className="rounded-[30px] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900 sm:p-7">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300"><MapPin className="h-4 w-4" /><span className="text-[11px] font-bold uppercase tracking-[0.14em]">{isId ? 'Berita daerah' : 'Local news'}</span></div>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.05em] text-slate-950 dark:text-white">{value}</h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">{isId ? 'Perkembangan ekonomi dan usaha yang relevan dengan wilayah ini.' : 'Economic and business developments relevant to this area.'}</p>
      </section>
      {items.length ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(article => (
            <Link key={article.id} href={buildNewsPath(article.slug)} className="group flex min-h-[230px] flex-col rounded-[26px] border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-200 dark:border-white/10 dark:bg-slate-900">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">{article.category}</p>
              <h2 className="mt-3 text-xl font-bold tracking-[-0.04em] text-slate-950 group-hover:text-emerald-800 dark:text-white">{article.title}</h2>
              <p className="mt-3 line-clamp-4 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{article.summary}</p>
              <span className="mt-auto inline-flex items-center gap-1 pt-5 text-xs font-bold text-emerald-700 dark:text-emerald-300">{isId ? 'Baca' : 'Read'}<ArrowRight className="h-3.5 w-3.5" /></span>
            </Link>
          ))}
        </section>
      ) : (
        <div className="rounded-[26px] border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500 dark:border-white/15">{isId ? 'Belum ada berita untuk wilayah ini.' : 'No news for this location yet.'}</div>
      )}
    </main>
  );
}
