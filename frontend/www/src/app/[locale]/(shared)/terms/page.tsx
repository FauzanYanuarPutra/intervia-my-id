// app/[locale]/terms/page.tsx
import { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { TERMS_SECTIONS, TRUST_LAST_UPDATED, pickText } from '@/data/trustCenter';
import { AnchorLink, InfoChips, LegalSectionView, SummaryCard } from '@/components/trust/TrustUI';

export const metadata: Metadata = {
  title: 'Syarat & Ketentuan | Lajukan',
  description:
    'Baca Syarat & Ketentuan penggunaan platform Lajukan, hak dan kewajiban pengguna, serta aturan layanan.',
  keywords: [
    'syarat ketentuan',
    'terms of service',
    'laju',
    'aturan penggunaan',
  ],
};

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function TermsPage({ params }: PageProps) {
  const { locale } = await params;
  const isId = locale === 'id';

  return (
    <main className="page-shell page-rhythm pb-6 pt-6 lg:pb-10">
      <SummaryCard
        title={isId ? 'Aturan pakai Lajukan' : 'Lajukan Terms'}
        description={
          isId
            ? 'Ringkasan hak, kewajiban, aturan transaksi, dan hal yang tidak boleh dilakukan di platform.'
            : 'A concise overview of rights, obligations, transactions, and content moderation.'
        }
        meta={isId ? 'Aturan pakai' : 'Legal'}
      >
        {isId ? (
          <InfoChips
            items={['Hak & kewajiban', 'Aturan transaksi', 'Konten & pelanggaran']}
          />
        ) : null}
        {TERMS_SECTIONS.map((section) => (
          <AnchorLink
            key={section.id}
            href={`#${section.id}`}
            label={pickText(locale, section.title)}
          />
        ))}
        <Link href="/trust" className="ui-button-secondary inline-flex items-center px-4 text-sm">
          {isId ? 'Pusat aman & aturan' : 'Trust Center'}
        </Link>
        <Link href="/privacy" className="ui-button-secondary inline-flex items-center px-4 text-sm">
          {isId ? 'Privasi' : 'Privacy Policy'}
        </Link>
      </SummaryCard>

      <section className="text-xs text-[color:var(--app-text-soft)]">
        {isId ? 'Terakhir diperbarui' : 'Last updated'}: {pickText(locale, TRUST_LAST_UPDATED)}
      </section>

      <section className="space-y-3">
        {TERMS_SECTIONS.map((section) => (
          <div key={section.id} id={section.id}>
            <LegalSectionView section={section} locale={locale as 'id' | 'en'} />
          </div>
        ))}
      </section>
    </main>
  );
}
