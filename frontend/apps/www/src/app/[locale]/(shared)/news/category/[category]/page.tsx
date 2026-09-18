import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
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

type Props = { params: Promise<{ locale: string; category: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, category } = await params;
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
        'x-default': availability.id
          ? `${buildNewsUrl('id')}/category/${category.toLowerCase()}`
          : `${buildNewsUrl('en')}/category/${category.toLowerCase()}`,
      },
    },
    robots: {
      index: indexable,
      follow: true,
      googleBot: { index: indexable, follow: true, 'max-image-preview': 'large' },
    },
  };
}

export default async function NewsCategoryPage({ params }: Props) {
  const { locale, category } = await params;
  const label = CATEGORY_BY_SLUG[category.toLowerCase()];
  if (!label) notFound();
  const isId = locale === 'id';
  const { items } = await getPublishedNews({ category: label, language: isId ? 'id' : 'en', limit: 48 });

  return <main className="page-shell page-rhythm pb-12 pt-6">
    <Link href="/news" className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"><ArrowLeft className="h-3.5 w-3.5"/>Lajukan News</Link>
    <section className="rounded-[30px] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900 sm:p-7">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">{isId?'Kategori berita':'News category'}</p>
      <h1 className="mt-3 text-3xl font-bold tracking-[-0.05em] text-slate-950 dark:text-white">{label}</h1>
      <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">{isId?`Berita ${label.toLowerCase()} dengan sumber, status editorial, dan konteks dampak usaha.`:`${label} news with sources, editorial status, and business impact context.`}</p>
    </section>
    {items.length ? <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(article => <Link key={article.id} href={buildNewsPath(article.slug)} className="group flex min-h-[240px] flex-col rounded-[26px] border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-200 dark:border-white/10 dark:bg-slate-900">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">{article.category}{article.location?` • ${article.location}`:''}</p>
        <h2 className="mt-3 text-xl font-bold tracking-[-0.04em] text-slate-950 group-hover:text-emerald-800 dark:text-white dark:group-hover:text-emerald-200">{article.title}</h2>
        <p className="mt-3 line-clamp-4 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{article.summary}</p>
        <span className="mt-auto inline-flex items-center gap-1 pt-5 text-xs font-bold text-emerald-700 dark:text-emerald-300">{isId?'Baca':'Read'}<ArrowRight className="h-3.5 w-3.5"/></span>
      </Link>)}
    </section> : <div className="rounded-[26px] border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500 dark:border-white/15">{isId?'Belum ada berita terbit di kategori ini.':'No published news in this category yet.'}</div>}
  </main>;
}
