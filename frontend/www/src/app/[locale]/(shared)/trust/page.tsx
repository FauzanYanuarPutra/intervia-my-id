import { ShieldCheck, ArrowRight, LifeBuoy } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  LEGAL_SUMMARIES,
  TRUST_LAST_UPDATED,
  TRUST_TOPICS,
  pickText,
} from '@/data/trustCenter';
import {
  InfoChips,
  LegalSummaryCard,
  SummaryCard,
  TrustBadge,
} from '@/components/trust/TrustUI';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function TrustCenterPage({ params }: PageProps) {
  const { locale } = await params;
  const isId = locale === 'id';

  return (
    <main className="page-shell page-rhythm pb-24 pt-6 lg:pb-10">
      <section className="ui-panel ui-hero-panel rounded-[32px] p-6 sm:p-8">
        <p className="ui-inline-meta bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
          <ShieldCheck className="h-3.5 w-3.5" />
          {isId ? 'Pusat aman & aturan' : 'Trust Center'}
        </p>
        <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-[color:var(--app-text)] sm:text-4xl">
          {isId
            ? 'Hal penting soal data, transaksi, dan keamanan dibuat lebih gampang dipahami.'
            : 'Transparency, controls, and safe flows for suppliers, services, and businesses.'}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--app-text-soft)]">
          {isId
            ? 'Kalau kamu mau tahu soal privasi, pembayaran, keamanan akun, atau aturan pakai Lajukan, mulainya dari sini. Isinya sengaja dibuat ringkas dan langsung ke inti.'
            : 'Quick summaries for supplier deals, storefronts, operational services, fulfillment, compliance, and transactions that need strong evidence.'}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="#trust-topics" className="ui-button-primary inline-flex items-center gap-2 px-4 text-sm">
            {isId ? 'Lihat topik penting' : 'View topics'}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/privacy" className="ui-button-secondary inline-flex items-center px-4 text-sm">
            {isId ? 'Privasi' : 'Privacy Policy'}
          </Link>
          <Link href="/support" className="ui-button-secondary inline-flex items-center px-4 text-sm">
            {isId ? 'Minta bantuan' : 'Get support'}
          </Link>
        </div>
        <div className="mt-4 text-xs text-[color:var(--app-text-soft)]">
          {isId ? 'Terakhir diperbarui' : 'Last updated'}: {pickText(locale, TRUST_LAST_UPDATED)}
        </div>
      </section>

      <section id="trust-topics" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
              {isId ? 'Yang sering dicari' : 'Core topics'}
            </p>
            <h2 className="mt-2 text-2xl font-black text-[color:var(--app-text)]">
              {isId ? 'Topik yang paling sering ditanya' : 'Trust controls for the business economy'}
            </h2>
            <p className="mt-2 text-sm text-[color:var(--app-text-soft)]">
              {isId
                ? 'Pilih topik yang paling dekat dengan masalahmu. Fokusnya ke hal yang benar-benar terasa di akun, transaksi, supplier, dan operasional usaha.'
                : 'Open a topic to see the controls and risks that matter most for sourcing, services, delivery, and storefronts.'}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {TRUST_TOPICS.map((topic) => (
            <Link
              key={topic.slug}
              href={`/trust/${topic.slug}`}
              className="ui-panel-muted ui-card-hover block rounded-[24px] p-4"
            >
              <TrustBadge label={pickText(locale, topic.badge)} />
              <h3 className="mt-3 text-lg font-bold text-[color:var(--app-text)]">
                {pickText(locale, topic.shortTitle)}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
                {pickText(locale, topic.summary)}
              </p>
              <div className="mt-3 text-[11px] text-[color:var(--app-text-soft)]">
                {pickText(locale, topic.audience)}
              </div>
              <span className="mt-4 inline-flex text-xs font-semibold bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                {isId ? 'Buka detail' : 'Open detail'}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SummaryCard
          title={isId ? 'Aturan penting, dibikin lebih jelas' : 'Concise legal references'}
          description={
            isId
              ? 'Privasi, syarat pakai, dan cookie kami ringkas dulu di bagian pentingnya. Detail lengkapnya tetap ada kalau kamu perlu baca lebih dalam.'
              : 'Privacy, terms, and cookie policy stay concise, while technical detail covers supplier deals, escrow, fulfillment, and data rights.'
          }
          meta={isId ? 'Aturan dasar' : 'Legal'}
        >
          <InfoChips
            items={[
              isId ? 'Consent & hak data' : 'Consent & data rights',
              isId ? 'Transaksi & sengketa' : 'Transactions & disputes',
              isId ? 'Cookie & preferensi' : 'Cookies & preferences',
            ]}
          />
        </SummaryCard>

        <div className="grid gap-3 md:grid-cols-3">
          {LEGAL_SUMMARIES.map((item) => (
            <LegalSummaryCard
              key={item.key}
              title={pickText(locale, item.title)}
              summary={pickText(locale, item.summary)}
              bullets={item.bullets.map((bullet) => pickText(locale, bullet))}
              href={item.href}
              cta={isId ? 'Baca ringkas' : 'Read summary'}
            />
          ))}
        </div>
      </section>

      <section className="ui-panel rounded-[24px] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
              {isId ? 'Butuh bantuan' : 'Support'}
            </p>
            <h2 className="mt-2 text-xl font-black text-[color:var(--app-text)]">
              {isId ? 'Ada masalah akun, data, atau transaksi?' : 'Need verification or reporting?'}
            </h2>
            <p className="mt-2 text-sm text-[color:var(--app-text-soft)]">
              {isId
                ? 'Kalau ada supplier bermasalah, akun butuh verifikasi, transaksi macet, atau data yang perlu diklarifikasi, masuk lewat support supaya cepat ditindak.'
                : 'Use support for problematic suppliers, disputed services, storefront verification, or transactions that require escalation.'}
            </p>
          </div>
          <Link href="/support" className="ui-button-primary inline-flex items-center gap-2 px-4 text-sm">
            <LifeBuoy className="h-4 w-4" />
            {isId ? 'Buka support' : 'Open support'}
          </Link>
        </div>
      </section>
    </main>
  );
}
