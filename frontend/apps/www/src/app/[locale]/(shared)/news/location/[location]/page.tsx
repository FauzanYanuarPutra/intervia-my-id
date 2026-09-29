import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPin } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { NewsInfiniteGrid } from '@/components/news/NewsInfiniteGrid';
import { buildNewsFacetUrl, getNewsLanguageAvailability, getPublishedNews } from '@/lib/news';

type Props = {
  params: Promise<{ locale: string; location: string }>;
  searchParams: Promise<{ cursor?: string }>;
};

function cleanFacet(value: string): string {
  return value.trim().slice(0, 120);
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, location } = await params;
  const filters = await searchParams;
  const value = cleanFacet(location);
  if (!value) return { robots: { index: false, follow: true } };
  const canonical = buildNewsFacetUrl(locale, 'location', value);
  const availability = await getNewsLanguageAvailability({ location: value });
  const currentLanguage = locale === 'en' ? 'en' : 'id';
  const indexable = availability[currentLanguage];
  return {
    title: `${value} | Berita Daerah Lajukan`,
    description: locale === 'id'
      ? `Berita ekonomi, bisnis, dan UMKM terbaru dari ${value}.`
      : `Latest economy, business, and SME news from ${value}.`,
    alternates: {
      canonical,
      languages: {
        ...(availability.id ? { id: buildNewsFacetUrl('id', 'location', value) } : {}),
        ...(availability.en ? { en: buildNewsFacetUrl('en', 'location', value) } : {}),
        ...(availability.id
          ? { 'x-default': buildNewsFacetUrl('id', 'location', value) }
          : availability.en
            ? { 'x-default': buildNewsFacetUrl('en', 'location', value) }
            : {}),
      },
    },
    robots: {
      index: indexable && !filters.cursor?.trim(),
      follow: true,
      googleBot: { index: indexable && !filters.cursor?.trim(), follow: true, 'max-image-preview': 'large' },
    },
  };
}

export default async function NewsLocationPage({ params, searchParams }: Props) {
  const { locale, location } = await params;
  const filters = await searchParams;
  const value = cleanFacet(location);
  if (!value) notFound();
  const isId = locale === 'id';
  const cursor = filters.cursor?.trim() || undefined;
  const { items, nextCursor } = await getPublishedNews({ location: value, language: isId ? 'id' : 'en', cursor, limit: 48 });

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
      <>
        <NewsInfiniteGrid
          initialItems={items}
          initialNextCursor={nextCursor}
          locale={locale}
          location={value}
          fallbackHref={`/news/location/${encodeURIComponent(value)}?cursor=${encodeURIComponent(nextCursor || '')}`}
        />
        <noscript>
          {nextCursor ? (
            <a
              rel="next"
              href={`/news/location/${encodeURIComponent(value)}?cursor=${encodeURIComponent(nextCursor)}`}
              className="sr-only"
            >
              {isId ? 'Berita berikutnya' : 'Next stories'}
            </a>
          ) : null}
        </noscript>
      </>
      ) : (
        <div className="rounded-[26px] border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500 dark:border-white/15">
                    {isId ? 'Belum ada berita untuk wilayah ini.' : 'No news for this location yet.'}
        </div>
      )}
    </main>
  );
}
