import { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import {
  TERMS_SECTIONS,
  TRUST_LAST_UPDATED,
  pickText,
} from '@/data/trustCenter';
import {
  AnchorLink,
  InfoChips,
  LegalSectionView,
  SummaryCard,
} from '@/components/trust/TrustUI';
import {
  ShieldCheck,
  FileText,
  Handshake,
  Ban,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Syarat & Ketentuan | Lajukan',
  description:
    'Aturan penggunaan platform Lajukan, hak dan kewajiban pengguna, serta standar transaksi aman.',
  keywords: [
    'syarat ketentuan',
    'terms of service',
    'lajukan',
    'aturan marketplace',
  ],
};

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function TermsPage({ params }: PageProps) {
  const { locale } = await params;
  const isId = locale === 'id';

  return (
    <main className="page-shell page-rhythm pb-10 pt-8">

      {/* HERO SUMMARY */}
      <SummaryCard
        title={isId ? 'Aturan penggunaan Lajukan' : 'Lajukan Terms of Service'}
        description={
          isId
            ? 'Aturan ini menjaga transaksi tetap aman, jelas, dan adil untuk semua pengguna.'
            : 'These terms ensure safe, fair, and transparent transactions for all users.'
        }
        meta={isId ? 'Legal & Trust' : 'Legal'}
      >

        {/* PRINCIPLES */}
        <div className="mt-3 grid gap-2 text-sm text-[color:var(--app-text-soft)]">

          <p className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            {isId
              ? 'Keamanan transaksi adalah prioritas utama'
              : 'Transaction safety is our top priority'}
          </p>

          <p className="flex items-center gap-2">
            <Handshake className="h-4 w-4" />
            {isId
              ? 'Kami menghubungkan buyer & seller secara adil'
              : 'We connect buyers and sellers fairly'}
          </p>

          <p className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {isId
              ? 'Setiap transaksi memiliki aturan yang jelas'
              : 'Every transaction follows clear rules'}
          </p>

          <p className="flex items-center gap-2">
            <Ban className="h-4 w-4" />
            {isId
              ? 'Aktivitas ilegal & penipuan tidak diperbolehkan'
              : 'Illegal or fraudulent activities are not allowed'}
          </p>
        </div>

        {/* QUICK NAV */}
        <div className="mt-5">
          {isId && (
            <InfoChips
              items={[
                'Hak & kewajiban',
                'Aturan transaksi',
                'Pelarangan',
                'Penyelesaian masalah',
              ]}
            />
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {TERMS_SECTIONS.map((section) => (
              <AnchorLink
                key={section.id}
                href={`#${section.id}`}
                label={pickText(locale, section.title)}
              />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/trust"
              className="ui-button-secondary inline-flex items-center px-4 text-sm"
            >
              {isId ? 'Pusat Keamanan' : 'Trust Center'}
            </Link>

            <Link
              href="/privacy"
              className="ui-button-secondary inline-flex items-center px-4 text-sm"
            >
              {isId ? 'Privasi' : 'Privacy Policy'}
            </Link>
          </div>
        </div>
      </SummaryCard>

      {/* LAST UPDATED */}
      <section className="text-xs text-[color:var(--app-text-soft)] px-1">
        {isId ? 'Terakhir diperbarui' : 'Last updated'}:{' '}
        {pickText(locale, TRUST_LAST_UPDATED)}
      </section>

      {/* SIMPLE EXPLANATION (NEW UX LAYER) */}
      <section className="ui-panel p-6 sm:p-8">
        <h2 className="text-lg font-bold">
          {isId ? 'Apa arti aturan ini untuk kamu?' : 'What these terms mean for you'}
        </h2>

        <div className="mt-4 grid gap-3 text-sm text-[color:var(--app-text-soft)]">

          <p>• {isId ? 'Kamu boleh jual & beli di platform' : 'You can buy and sell on the platform'}</p>

          <p>• {isId ? 'Kami menyediakan sistem transaksi aman' : 'We provide secure transaction system'}</p>

          <p>• {isId ? 'Kami tidak bertanggung jawab atas kesepakatan di luar platform' : 'We are not responsible for off-platform deals'}</p>

          <p>• {isId ? 'Pelanggaran dapat menyebabkan akun dibatasi' : 'Violations may lead to account restrictions'}</p>
        </div>
      </section>

      {/* LEGAL CONTENT */}
      <section className="space-y-3">
        {TERMS_SECTIONS.map((section) => (
          <div key={section.id} id={section.id}>
            <LegalSectionView
              section={section}
              locale={locale as 'id' | 'en'}
            />
          </div>
        ))}
      </section>

      {/* FINAL CTA TRUST */}
      <section className="ui-panel ui-hero-panel p-6 sm:p-8 text-center">
        <h3 className="text-lg font-bold">
          {isId
            ? 'Gunakan Lajukan dengan aman & bertanggung jawab'
            : 'Use Lajukan safely and responsibly'}
        </h3>

        <p className="mt-2 text-sm text-[color:var(--app-text-soft)]">
          {isId
            ? 'Semua transaksi terbaik terjadi ketika kedua pihak mengikuti aturan yang sama.'
            : 'The best transactions happen when both parties follow the same rules.'}
        </p>

        <div className="mt-5 flex justify-center gap-3">
          <Link
            href="/trust"
            className="ui-button-primary inline-flex items-center px-5 text-sm"
          >
            {isId ? 'Buka Trust Center' : 'Open Trust Center'}
          </Link>
        </div>
      </section>

    </main>
  );
}