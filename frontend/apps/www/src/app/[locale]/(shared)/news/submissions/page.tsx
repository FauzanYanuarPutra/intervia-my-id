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
    <div>
      <h1 className="text-3xl font-bold tracking-[-0.05em] text-slate-950 dark:text-white">{locale==='id'?'Status kiriman berita':'News submission status'}</h1>
      <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">{locale==='id'?'Lihat catatan editor dan kirim revisi tanpa membuat artikel baru.':'View editor notes and resubmit revisions without creating a new article.'}</p>
    </div>
    <MyNewsSubmissions locale={locale}/>
  </main>;
}
