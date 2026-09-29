import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { NewsInfiniteGrid } from '@/components/news/NewsInfiniteGrid';
import { buildNewsPath, buildNewsUrl, getNewsLanguageAvailability, getPublishedNews } from '@/lib/news';

const CATEGORY_BY_SLUG: Record<string, string> = {
  ekonomi: 'Ekonomi',
  bisnis: 'Bisnis',
  umkm: 'UMKM',
  teknologi: 'Teknologi',
  keuangan: 'Keuangan',
  regulasi: 'Regulasi',
  industri: 'Industri',
  daerah: 'Daerah',
};

type Props = {
  params: Promise<{ locale: string; category: string }>;
  searchParams: Promise<{ cursor?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, category } = await params;
  const filters = await searchParams;
  const label = CATEGORY_BY_SLUG[category.toLowerCase()];
  if (!label) return { robots: { index: false, follow: true } };
  const canonical = `${buildNewsUrl(locale)}/category/${category.toLowerCase()}`;
  const availability = await getNewsLanguageAvailability({ category: label });
  const currentLanguage = locale === 'en' ? 'en' : 'id';
  const indexable = availability[currentLanguage];
  return {
    title: `${label} | Lajukan News`,
    description: locale === 'id'
      ? `Berita ${label.toLowerCase()} terbaru yang relevan untuk pelaku usaha dan UMKM Indonesia.`
      : `Latest ${label.toLowerCase()} news relevant to Indonesian businesses and SMEs.`,
    alternates: {
      canonical,
      languages: {
        ...(availability.id
          ? { id: `${buildNewsUrl('id')}/category/${category.toLowerCase()}` }
          : {}),
        ...(availability.en
          ? { en: `${buildNewsUrl('en')}/category/${category.toLowerCase()}` }
          : {}),
        ...(availability.id
          ? { 'x-default': `${buildNewsUrl('id')}/category/${category.toLowerCase()}` }
          : availability.en
            ? { 'x-default': `${buildNewsUrl('en')}/category/${category.toLowerCase()}` }
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

export default async function NewsCategoryPage({ params, searchParams }: Props) {
  const { locale, category } = await params;
  const filters = await searchParams;
  const label = CATEGORY_BY_SLUG[category.toLowerCase()];
  if (!label) notFound();
  const isId = locale === 'id';
  const cursor = filters.cursor?.trim() || undefined;
  const { items, nextCursor } = await getPublishedNews({ category: label, language: isId ? 'id' : 'en', cursor, limit: 48 });

  return <main className="page-shell page-rhythm pb-12 pt-6">
    <Link href="/news" className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"><ArrowLeft className="h-3.5 w-3.5"/>Lajukan News</Link>
    <section className="rounded-[30px] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900 sm:p-7">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">{isId?'Kategori berita':'News category'}</p>
      <h1 className="mt-3 text-3xl font-bold tracking-[-0.05em] text-slate-950 dark:text-white">{label}</h1>
      <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">{isId?`Berita ${label.toLowerCase()} dengan sumber, status editorial, dan konteks dampak usaha.`:`${label} news with sources, editorial status, and business impact context.`}</p>
    </section>
    {items.length ? (
      <>
        <NewsInfiniteGrid
        initialItems={items}
        initialNextCursor={nextCursor}
        locale={locale}
        category={label}
        fallbackHref={`/news/category/${category.toLowerCase()}?cursor=${encodeURIComponent(nextCursor || '')}`}
      />
      {nextCursor ? (
        <a
          href={`/news/category/${category.toLowerCase()}?cursor=${encodeURIComponent(nextCursor)}`}
          rel="next"
          className="sr-only"
        >
          {isId ? 'Berita berikutnya' : 'Next stories'}
        </a>
        ) : null}
      </>
    ) : (
      <div className="rounded-[26px] border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500 dark:border-white/15">
        {isId ? 'Belum ada berita terbit di kategori ini.' : 'No published news in this category yet.'}
      </div>
    )}
  </main>;
}
