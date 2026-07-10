import { Link } from '@/i18n/navigation';
import {
  PRIVACY_POLICY_SECTIONS,
  TRUST_LAST_UPDATED,
  pickText,
} from '@/data/trustCenter';
import {
  AnchorLink,
  InfoChips,
  LegalSectionView,
  SummaryCard,
} from '@/components/trust/TrustUI';
import { PrivacyActions } from '@/components/trust/PrivacyActions';
import {
  ShieldCheck,
  Lock,
  Eye,
  Database,
} from 'lucide-react';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function PrivacyPage({ params }: PageProps) {
  const { locale } = await params;
  const isId = locale === 'id';

  return (
    <main className="page-shell page-rhythm pb-10 pt-8">

      {/* HERO SUMMARY */}
      <SummaryCard
        title={isId ? 'Privasi kamu di Lajukan' : 'Your privacy at Lajukan'}
        description={
          isId
            ? 'Kami hanya mengumpulkan data yang diperlukan untuk menjalankan transaksi, chat, dan verifikasi bisnis.'
            : 'We only collect what is needed to run transactions, chat, and business verification safely.'
        }
        meta={isId ? 'Trust & Privacy' : 'Legal & Privacy'}
      >
        <div className="mt-3 grid gap-2 text-sm text-[color:var(--app-text-soft)]">

          <p className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            {isId
              ? 'Data kamu tidak dijual ke pihak ketiga'
              : 'Your data is never sold to third parties'}
          </p>

          <p className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            {isId
              ? 'Verifikasi dan keamanan transaksi dikembangkan bertahap'
              : 'Verification and transaction safety are being rolled out gradually'}
          </p>

          <p className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            {isId
              ? 'Data hanya dipakai untuk layanan Lajukan'
              : 'Data is used only to power Lajukan services'}
          </p>

          <p className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            {isId
              ? 'Kamu bisa lihat & hapus data kapan saja'
              : 'You can access or delete your data anytime'}
          </p>
        </div>

        {/* QUICK NAV */}
        <div className="mt-5">
          {isId && (
            <InfoChips
              items={[
                'Akun & identitas',
                'Transaksi & pembayaran',
                'Chat & komunikasi',
                'Hak pengguna',
              ]}
            />
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {PRIVACY_POLICY_SECTIONS.map((section) => (
              <AnchorLink
                key={section.id}
                href={`#${section.id}`}
                label={pickText(locale, section.title)}
              />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <PrivacyActions locale={isId ? 'id' : 'en'} />

            <Link
              href="/trust"
              className="ui-button-secondary inline-flex items-center px-4 text-sm"
            >
              {isId ? 'Pusat Keamanan' : 'Trust Center'}
            </Link>
          </div>
        </div>
      </SummaryCard>

      {/* LAST UPDATED */}
      <section className="text-xs text-[color:var(--app-text-soft)] px-1">
        {isId ? 'Terakhir diperbarui' : 'Last updated'}:{' '}
        {pickText(locale, TRUST_LAST_UPDATED)}
      </section>

      {/* DATA FLOW EXPLAINER (NEW) */}
      <section className="ui-panel p-6 sm:p-8">
        <h2 className="text-lg font-bold">
          {isId ? 'Data kamu digunakan untuk apa?' : 'How your data is used'}
        </h2>

        <div className="mt-4 grid gap-3 text-sm text-[color:var(--app-text-soft)]">
          <p>• {isId ? 'Membuat akun & login' : 'Account creation & login'}</p>
          <p>• {isId ? 'Menghubungkan buyer & seller' : 'Connecting buyers & sellers'}</p>
          <p>• {isId ? 'Menjalankan chat & transaksi' : 'Running chat & transactions'}</p>
          <p>• {isId ? 'Verifikasi & keamanan transaksi' : 'Verification & transaction safety'}</p>
        </div>
      </section>

      {/* LEGAL SECTIONS */}
      <section className="space-y-3">
        {PRIVACY_POLICY_SECTIONS.map((section) => (
          <div key={section.id} id={section.id}>
            <LegalSectionView
              section={section}
              locale={locale as 'id' | 'en'}
            />
          </div>
        ))}
      </section>

      {/* FINAL TRUST CTA */}
      <section className="ui-panel ui-hero-panel p-6 sm:p-8 text-center">
        <h3 className="text-lg font-bold">
          {isId
            ? 'Kamu tetap punya kontrol penuh atas data kamu'
            : 'You stay in full control of your data'}
        </h3>

        <p className="mt-2 text-sm text-[color:var(--app-text-soft)]">
          {isId
            ? 'Lihat, ekspor, atau hapus data kapan saja dari akun kamu.'
            : 'View, export, or delete your data anytime from your account.'}
        </p>

        <div className="mt-5">
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
