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
import { buildStaticPublicPageMetadata } from '@/lib/seo/publicStaticPageMetadata';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== 'id' && locale !== 'en') notFound();
  return buildStaticPublicPageMetadata('trust', locale);
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
        ? 'Pelajari langkah dasar menjaga akses akun.'
        : 'Learn the basics of protecting account access.',
    },
    {
      href: '/support',
      icon: LifeBuoy,
      title: isId ? 'Butuh bantuan?' : 'Need help?',
      description: isId
        ? 'Buka support jika ada kendala atau laporan.'
        : 'Open support for an issue or report.',
    },
  ];

  return (
    <main className="page-shell page-shell-readable page-rhythm pb-6 pt-4 lg:pb-10">
      <SummaryCard
        title={isId ? 'Kepercayaan & keamanan' : 'Trust & safety'}
        description={
          isId
            ? 'Pahami perlindungan akun, privasi, transaksi, pelaporan, dan aturan penting sebelum beraktivitas.'
            : 'Understand account protection, privacy, transactions, reporting, and important rules before participating.'
        }
        meta={`${isId ? 'Diperbarui' : 'Updated'} ${TRUST_LAST_UPDATED}`}
      >
        <InfoChips
          items={[
            isId ? 'Privasi' : 'Privacy',
            isId ? 'Keamanan akun' : 'Account security',
            isId ? 'Transaksi' : 'Transactions',
            isId ? 'Pelaporan' : 'Reporting',
          ]}
        />
      </SummaryCard>

      <section className="grid gap-3 sm:grid-cols-2">
        {quickActions.map(item => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="ui-panel group flex items-start gap-3 rounded-[22px] p-4 transition hover:-translate-y-0.5"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-[color:var(--app-text)]">
                  {item.title}
                </span>
                <span className="mt-1 block text-sm leading-6 text-[color:var(--app-text-soft)]">
                  {item.description}
                </span>
              </span>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[color:var(--app-text-muted)] transition group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        {TRUST_TOPICS.map(topic => (
          <div key={topic.id} className="ui-panel rounded-[22px] p-5">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                {topic.id === 'security' ? (
                  <ShieldCheck className="h-5 w-5" />
                ) : (
                  <MessageCircleWarning className="h-5 w-5" />
                )}
              </span>
              <div>
                <h2 className="text-base font-bold text-[color:var(--app-text)]">
                  {pickText(topic.title, locale)}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
                  {pickText(topic.description, locale)}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {topic.badges.map(badge => (
                <TrustBadge key={badge.id} label={pickText(badge.label, locale)} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-[color:var(--app-text)]">
          {isId ? 'Dokumen penting' : 'Important documents'}
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {LEGAL_SUMMARIES.map(item => (
            <LegalSummaryCard key={item.href} item={item} locale={locale} />
          ))}
        </div>
      </section>
    </main>
  );
}
