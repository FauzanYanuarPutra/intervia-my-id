import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  CreditCard,
  LifeBuoy,
  LockKeyhole,
  MessageCircleWarning,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
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

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== 'id' && locale !== 'en') notFound();
  const isId = locale === 'id';
  const canonical = `https://www.lajukan.com/${locale}/trust`;
  const title = isId
    ? 'Keamanan, Privasi, dan Kepercayaan | Lajukan'
    : 'Safety, Privacy, and Trust | Lajukan';
  const description = isId
    ? 'Pelajari keamanan akun, privasi data, pembayaran, ulasan, pelaporan, dan aturan penting sebelum beraktivitas di Lajukan.'
    : 'Learn about account security, data privacy, payments, reviews, reporting, and important rules before using Lajukan.';

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        'id-ID': 'https://www.lajukan.com/id/trust',
        'en-US': 'https://www.lajukan.com/en/trust',
        'x-default': 'https://www.lajukan.com/id/trust',
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'Lajukan',
      type: 'website',
      locale: isId ? 'id_ID' : 'en_US',
    },
  };
}

export default async function TrustCenterPage({ params }: PageProps) {
  const { locale } = await params;
  const isId = locale === 'id';
  const quickActions = [
    {
      href: '/privacy',
      icon: LockKeyhole,
      title: isId ? 'Data & privasi' : 'Data & privacy',
      description: isId
        ? 'Cek data apa yang dipakai dan hak kamu.'
        : 'See what data is used and your rights.',
    },
    {
      href: '/trust/payments',
      icon: CreditCard,
      title: isId ? 'Pembayaran' : 'Payments',
      description: isId
        ? 'Pahami hold, refund, dan bukti transaksi.'
        : 'Understand holds, refunds, and payment proof.',
    },
    {
      href: '/trust/security',
      icon: UserCheck,
      title: isId ? 'Akun aman' : 'Secure account',
      description: isId
        ? 'Login, sesi, dan aktivitas penting.'
        : 'Login, sessions, and sensitive actions.',
    },
    {
      href: '/support',
      icon: MessageCircleWarning,
      title: isId ? 'Laporkan masalah' : 'Report a problem',
      description: isId
        ? 'Untuk akun, transaksi, konten, atau penipuan.'
        : 'For account, transaction, content, or fraud issues.',
    },
  ];

  return (
    <main className="page-shell page-rhythm pb-6 pt-4 lg:pb-10">
      <section className="ui-panel ui-hero-panel overflow-hidden rounded-[30px] p-5 sm:p-7">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <p className="ui-inline-meta border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
              <ShieldCheck className="h-3.5 w-3.5" />
              {isId ? 'Pusat keamanan Lajukan' : 'Lajukan Trust Center'}
            </p>
            <h1 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-[color:var(--app-text)] sm:text-4xl">
              {isId
                ? 'Pahami yang aman sebelum transaksi.'
                : 'Understand safety before you transact.'}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--app-text-soft)]">
              {isId
                ? 'Ringkasan soal akun, data, pembayaran, ulasan, laporan, dan aturan penting di Lajukan.'
                : 'A concise guide to accounts, data, payments, reviews, reports, and important rules on Lajukan.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="#trust-topics"
                className="ui-button-primary inline-flex items-center gap-2 px-4 text-sm"
              >
                {isId ? 'Lihat topik' : 'View topics'}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/support"
                className="ui-button-secondary inline-flex items-center gap-2 px-4 text-sm"
              >
                <LifeBuoy className="h-4 w-4" />
                {isId ? 'Minta bantuan' : 'Get support'}
              </Link>
            </div>
          </div>

          <div className="rounded-[24px] border border-[color:var(--app-border)] bg-white/78 p-4 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.22)] dark:bg-slate-950/54">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
              {isId ? 'Yang bisa dicek di sini' : 'What you can check here'}
            </p>
            <div className="mt-3 grid gap-2 text-sm text-[color:var(--app-text)]">
              {(isId
                ? ['Keamanan akun', 'Hak data pribadi', 'Pembayaran & refund']
                : [
                    'Account security',
                    'Personal data rights',
                    'Payments & refunds',
                  ]
              ).map(item => (
                <div key={item} className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-semibold">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-[16px] bg-[color:var(--app-surface-muted)] px-3 py-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
              {isId ? 'Terakhir diperbarui' : 'Last updated'}:{' '}
              {pickText(locale, TRUST_LAST_UPDATED)}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map(item => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="ui-panel-muted ui-card-hover rounded-[22px] p-4"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-[16px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-3 text-sm font-bold text-[color:var(--app-text)]">
                {item.title}
              </h2>
              <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                {item.description}
              </p>
            </Link>
          );
        })}
      </section>

      <section id="trust-topics" className="scroll-mt-24 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="inline-flex rounded-full bg-[color:var(--app-accent-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
              {isId ? 'Topik utama' : 'Core topics'}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[color:var(--app-text)]">
              {isId
                ? 'Pilih yang ingin dicek'
                : 'Choose what you need to check'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--app-text-soft)]">
              {isId
                ? 'Bahasannya dibuat singkat: apa risikonya, kontrolnya apa, dan harus ke mana kalau butuh bantuan.'
                : 'Each topic explains the risk, the control, and where to go when you need help.'}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {TRUST_TOPICS.map(topic => (
            <Link
              key={topic.slug}
              href={`/trust/${topic.slug}`}
              className="ui-panel-muted ui-card-hover flex min-h-[218px] flex-col rounded-[24px] p-4"
            >
              <TrustBadge label={pickText(locale, topic.badge)} />
              <h3 className="mt-3 text-lg font-bold text-[color:var(--app-text)]">
                {pickText(locale, topic.shortTitle)}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
                {pickText(locale, topic.summary)}
              </p>
              <div className="mt-3 rounded-[14px] bg-white/70 px-3 py-2 text-[11px] leading-5 text-[color:var(--app-text-soft)] dark:bg-slate-950/45">
                <span className="font-bold text-[color:var(--app-text)]">
                  {isId ? 'Untuk:' : 'For:'}
                </span>{' '}
                {pickText(locale, topic.audience)}
              </div>
              <span className="mt-auto inline-flex pt-4 text-xs font-semibold text-[color:var(--app-accent)]">
                {isId ? 'Buka detail' : 'Open detail'}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SummaryCard
          title={
            isId ? 'Aturan penting, versi ringkas' : 'Concise legal references'
          }
          description={
            isId
              ? 'Untuk hal legal, mulai dari ringkasan dulu. Detail tetap tersedia di halaman masing-masing.'
              : 'Start with concise summaries. Full details stay available in each legal page.'
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
          {LEGAL_SUMMARIES.map(item => (
            <LegalSummaryCard
              key={item.key}
              title={pickText(locale, item.title)}
              summary={pickText(locale, item.summary)}
              bullets={item.bullets.map(bullet => pickText(locale, bullet))}
              href={item.href}
              cta={isId ? 'Baca ringkas' : 'Read summary'}
            />
          ))}
        </div>
      </section>

      <section className="ui-panel rounded-[24px] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="inline-flex rounded-full bg-[color:var(--app-accent-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
              {isId ? 'Butuh bantuan' : 'Support'}
            </p>
            <h2 className="mt-2 text-xl font-bold text-[color:var(--app-text)]">
              {isId
                ? 'Ada masalah akun, data, transaksi, atau konten?'
                : 'Need help with account, data, transaction, or content issues?'}
            </h2>
            <p className="mt-2 text-sm text-[color:var(--app-text-soft)]">
              {isId
                ? 'Kirim lewat support supaya ada riwayat dan bisa ditindak dengan jelas.'
                : 'Use support so there is a clear trail and the issue can be handled properly.'}
            </p>
          </div>
          <Link
            href="/support"
            className="ui-button-primary inline-flex items-center gap-2 px-4 text-sm"
          >
            <LifeBuoy className="h-4 w-4" />
            {isId ? 'Buka support' : 'Open support'}
          </Link>
        </div>
      </section>
    </main>
  );
}
