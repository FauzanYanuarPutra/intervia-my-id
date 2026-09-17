import type { Metadata } from 'next';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import SubmitNewsForm from './SubmitNewsForm';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const isId = locale === 'id';
  return {
    title: isId ? 'Kirim Berita | Lajukan News' : 'Submit News | Lajukan News',
    description: isId ? 'Kirim berita, analisis, atau rilis bisnis untuk review editorial Lajukan News.' : 'Submit news, analysis, or a business release for Lajukan News editorial review.',
    robots: { index: false, follow: true },
  };
}

export default async function SubmitNewsPage({ params }: PageProps) {
  const { locale } = await params;
  const isId = locale === 'id';
  return (
    <main className="page-shell page-shell-readable page-rhythm pb-12 pt-6">
<div className="flex flex-wrap gap-2">
      <Link href="/news" className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:border-emerald-200 hover:text-emerald-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">
        <ArrowLeft className="h-3.5 w-3.5" />
        Lajukan News
      </Link>
        <Link href="/news/submissions" className="inline-flex min-h-9 items-center rounded-full border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:border-emerald-200 hover:text-emerald-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">
          {isId ? 'Kiriman saya' : 'My submissions'}
        </Link>
      </div>

      <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_24px_64px_-48px_rgba(15,23,42,0.34)] dark:border-white/10 dark:bg-slate-900 sm:p-8">
        <div className="mb-7">
          <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            {isId ? 'Open contribution, controlled publication' : 'Open contribution, controlled publication'}
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-[-0.05em] text-slate-950 dark:text-white">{isId ? 'Kirim berita ke Lajukan' : 'Submit news to Lajukan'}</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">
            {isId
              ? 'Siapa pun yang memiliki akun dapat mengirim. Kiriman baru menjadi Lajukan News setelah melewati pemeriksaan editorial.'
              : 'Anyone with an account can submit. A submission becomes Lajukan News only after editorial review.'}
          </p>
        </div>
        <SubmitNewsForm locale={locale} />
      </section>
    </main>
  );
}
