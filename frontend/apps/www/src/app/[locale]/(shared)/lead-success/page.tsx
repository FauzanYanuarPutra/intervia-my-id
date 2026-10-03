import type { Metadata } from 'next';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { LocalizedLink } from '@/components/ui-kit';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const isId = locale === 'id';

  return {
    title: isId ? 'Terima Kasih | Lajukan' : 'Thank You | Lajukan',
    description: isId
      ? 'Konfirmasi bahwa formulir Lajukan berhasil dikirim.'
      : 'Confirmation that your Lajukan form was successfully submitted.',
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function LeadSuccessPage({ params }: PageProps) {
  const { locale } = await params;
  const isId = locale === 'id';

  return (
    <main className="page-shell page-rhythm flex min-h-[60vh] items-center justify-center py-10">
      <section
        className="ui-panel ui-hero-panel w-full max-w-xl p-6 text-center sm:p-8"
        data-conversion-page="lead-success"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
          <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
        </div>

        <p className="ui-page-eyebrow mt-5">
          {isId ? 'Formulir berhasil dikirim' : 'Form submitted'}
        </p>

        <h1 className="ui-page-title mt-2">
          {isId ? 'Terima kasih sudah menghubungi Lajukan.' : 'Thanks for contacting Lajukan.'}
        </h1>

        <p className="ui-page-copy mx-auto mt-3 max-w-lg">
          {isId
            ? 'Data kamu sudah diterima. Tim Lajukan akan menindaklanjutinya sesuai kebutuhan.'
            : 'Your information has been received. The Lajukan team will follow up as needed.'}
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <LocalizedLink
            href="/"
            className="ui-button-primary inline-flex items-center gap-2 px-4"
          >
            {isId ? 'Kembali ke Lajukan' : 'Back to Lajukan'}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </LocalizedLink>
        </div>
      </section>
    </main>
  );
}
