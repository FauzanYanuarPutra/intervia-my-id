import { Link } from '@/i18n/navigation';
import {
  COOKIE_POLICY_SECTIONS,
  TRUST_LAST_UPDATED,
  pickText,
} from '@/data/trustCenter';
import { AnchorLink, LegalSectionView, SummaryCard } from '@/components/trust/TrustUI';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function CookiePolicyPage({ params }: PageProps) {
  const { locale } = await params;
  const isId = locale === 'id';

  return (
    <main className="page-shell page-rhythm pb-6 pt-6 lg:pb-10">
      <SummaryCard
        title={isId ? 'Cookie Policy' : 'Cookie Policy'}
        description={
          isId
            ? 'Ringkasan jenis cookie, tujuan pemakaian, dan kontrol pengguna.'
            : 'A concise summary of cookie types, purposes, and user controls.'
        }
        meta={isId ? 'Legal' : 'Legal'}
      >
        {COOKIE_POLICY_SECTIONS.map((section) => (
          <AnchorLink
            key={section.id}
            href={`#${section.id}`}
            label={pickText(locale, section.title)}
          />
        ))}
        <Link href="/trust" className="ui-button-secondary inline-flex items-center px-4 text-sm">
          {isId ? 'Trust Center' : 'Trust Center'}
        </Link>
      </SummaryCard>

      <section className="text-xs text-[color:var(--app-text-soft)]">
        {isId ? 'Terakhir diperbarui' : 'Last updated'}: {pickText(locale, TRUST_LAST_UPDATED)}
      </section>

      <section className="space-y-3">
        {COOKIE_POLICY_SECTIONS.map((section) => (
          <div key={section.id} id={section.id}>
            <LegalSectionView section={section} locale={locale as 'id' | 'en'} />
          </div>
        ))}
      </section>
    </main>
  );
}
