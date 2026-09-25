import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import MyNewsSubmissions from './MyNewsSubmissions';

export const metadata: Metadata = {
  title: 'Kiriman News | Lajukan',
  robots: { index: false, follow: true },
};

export default async function MyNewsSubmissionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <main className="page-shell page-rhythm pb-12 pt-6">
    <Link href="/news" className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"><ArrowLeft className="h-3.5 w-3.5"/>Lajukan News</Link>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-[-0.05em] text-slate-950 dark:text-white">{locale==='id'?'Status kiriman berita':'News submission status'}</h1>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{locale==='id'?'Pantau status, baca catatan editor, edit kiriman yang perlu diperbaiki, atau hapus kiriman sebelum terbit.':'Track status, read editor notes, edit submissions that need changes, or remove a story before publication.'}</p>
      </div>
      <Link
        href="/news/submit"
        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-black text-white transition hover:bg-emerald-800"
      >
        <span aria-hidden="true">+</span>
        {locale==='id'?'Kirim berita baru':'Submit new story'}
      </Link>
    </div>
    <MyNewsSubmissions locale={locale}/>
  </main>;
}
