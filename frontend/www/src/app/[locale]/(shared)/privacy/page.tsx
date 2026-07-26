import { Database, Eye, Lock, ShieldCheck } from 'lucide-react';
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

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function PrivacyPage({ params }: PageProps) {
  const { locale } = await params;
  const isId = locale === 'id';
  const promises = [
    {
      icon: Lock,
      text: isId
        ? 'Data kamu tidak dijual ke pihak ketiga.'
        : 'Your data is not sold to third parties.',
    },
    {
      icon: ShieldCheck,
      text: isId
        ? 'Verifikasi dan keamanan transaksi dilakukan bertahap.'
        : 'Verification and transaction safety are rolled out gradually.',
    },
    {
      icon: Database,
      text: isId
        ? 'Data dipakai untuk menjalankan layanan Lajukan.'
        : 'Data is used to run Lajukan services.',
    },
    {
      icon: Eye,
      text: isId
        ? 'Kamu bisa meminta akses, ekspor, atau penghapusan data.'
        : 'You can request access, export, or deletion.',
    },
  ];
  const dataUses = isId
    ? [
        'Membuat akun dan menjaga login tetap aman.',
        'Menghubungkan pembeli, penjual, dan penyedia jasa.',
        'Menjalankan chat, listing, transaksi, dan support.',
        'Mencegah spam, penipuan, dan penyalahgunaan platform.',
      ]
    : [
        'Create accounts and keep login safe.',
        'Connect buyers, sellers, and service providers.',
        'Run chat, listings, transactions, and support.',
        'Prevent spam, fraud, and platform abuse.',
      ];

  return (
    <main className="page-shell page-rhythm pb-10 pt-4">
      <SummaryCard
        title={isId ? 'Privasi kamu di Lajukan' : 'Your privacy at Lajukan'}
        description={
          isId
            ? 'Kami memakai data seperlunya untuk akun, chat, transaksi, keamanan, dan bantuan pengguna.'
            : 'We use only what is needed for accounts, chat, transactions, security, and support.'
        }
        meta={isId ? 'Privasi' : 'Privacy'}
      >
        <div className="grid w-full gap-2 sm:grid-cols-2">
          {promises.map(item => {
            const Icon = item.icon;
            return (
              <div
                key={item.text}
                className="flex items-start gap-2 rounded-[16px] bg-[color:var(--app-surface-muted)] px-3 py-2 text-sm text-[color:var(--app-text-soft)]"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                <span>{item.text}</span>
              </div>
            );
          })}
        </div>

        <div className="w-full">
          <InfoChips
            items={[
              isId ? 'Akun & identitas' : 'Account & identity',
              isId ? 'Transaksi & pembayaran' : 'Transactions & payments',
              isId ? 'Chat & komunikasi' : 'Chat & communication',
              isId ? 'Hak pengguna' : 'User rights',
            ]}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {PRIVACY_POLICY_SECTIONS.map(section => (
            <AnchorLink
              key={section.id}
              href={`#${section.id}`}
              label={pickText(locale, section.title)}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <PrivacyActions locale={isId ? 'id' : 'en'} />
          <Link
            href="/trust"
            className="ui-button-secondary inline-flex items-center px-4 text-sm"
          >
            {isId ? 'Pusat keamanan' : 'Trust Center'}
          </Link>
        </div>
      </SummaryCard>

      <section className="text-xs text-[color:var(--app-text-soft)]">
        {isId ? 'Terakhir diperbarui' : 'Last updated'}:{' '}
        {pickText(locale, TRUST_LAST_UPDATED)}
      </section>

      <section className="ui-panel rounded-[24px] p-5">
        <h2 className="text-lg font-bold text-[color:var(--app-text)]">
          {isId ? 'Data dipakai untuk apa?' : 'How your data is used'}
        </h2>
        <div className="mt-4 grid gap-2 text-sm text-[color:var(--app-text-soft)] sm:grid-cols-2">
          {dataUses.map(item => (
            <p
              key={item}
              className="rounded-[16px] bg-[color:var(--app-surface-muted)] px-3 py-2"
            >
              {item}
            </p>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        {PRIVACY_POLICY_SECTIONS.map(section => (
          <div key={section.id} id={section.id} className="scroll-mt-24">
            <LegalSectionView
              section={section}
              locale={locale as 'id' | 'en'}
            />
          </div>
        ))}
      </section>

      <section className="ui-panel ui-hero-panel rounded-[24px] p-6 text-center sm:p-8">
        <h3 className="text-lg font-bold text-[color:var(--app-text)]">
          {isId
            ? 'Kamu tetap punya kontrol atas data kamu.'
            : 'You stay in control of your data.'}
        </h3>
        <p className="mt-2 text-sm text-[color:var(--app-text-soft)]">
          {isId
            ? 'Gunakan pengaturan akun atau support untuk permintaan data.'
            : 'Use account settings or support for data requests.'}
        </p>
      </section>
    </main>
  );
}
