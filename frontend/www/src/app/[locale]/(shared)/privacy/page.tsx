import { Link } from '@/i18n/navigation';
import {
  PRIVACY_POLICY_SECTIONS,
  TRUST_LAST_UPDATED,
  pickText,
} from '@/data/trustCenter';
import { AnchorLink, InfoChips, LegalSectionView, SummaryCard } from '@/components/trust/TrustUI';
import { PrivacyActions } from '@/components/trust/PrivacyActions';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function PrivacyPage({ params }: PageProps) {
  const { locale } = await params;
  const isId = locale === 'id';

  return (
    <main className="page-shell page-rhythm pb-24 pt-6 lg:pb-10">
      <SummaryCard
        title={isId ? 'Privasi & data di Lajukan' : 'Lajukan Privacy Policy'}
        description={
          isId
            ? 'Ringkasan singkat soal data akun, transaksi, chat, verifikasi, dan hak kamu sebagai pengguna.'
            : 'A concise summary of how data is collected, processed, stored, and protected.'
        }
        meta={isId ? 'Privasi' : 'Legal'}
      >
        {isId ? (
          <InfoChips
            items={['Data akun', 'Transaksi & chat', 'Hak akses & hapus data']}
          />
        ) : null}
        {PRIVACY_POLICY_SECTIONS.map((section) => (
          <AnchorLink
            key={section.id}
            href={`#${section.id}`}
            label={pickText(locale, section.title)}
          />
        ))}
        <PrivacyActions locale={isId ? 'id' : 'en'} />
        <Link href="/trust" className="ui-button-secondary inline-flex items-center px-4 text-sm">
          {isId ? 'Pusat aman & aturan' : 'Trust Center'}
        </Link>
      </SummaryCard>

      <section className="text-xs text-[color:var(--app-text-soft)]">
        {isId ? 'Terakhir diperbarui' : 'Last updated'}: {pickText(locale, TRUST_LAST_UPDATED)}
      </section>

      <section className="space-y-3">
        {PRIVACY_POLICY_SECTIONS.map((section) => (
          <div key={section.id} id={section.id}>
            <LegalSectionView section={section} locale={locale as 'id' | 'en'} />
          </div>
        ))}
      </section>
    </main>
  );
}
