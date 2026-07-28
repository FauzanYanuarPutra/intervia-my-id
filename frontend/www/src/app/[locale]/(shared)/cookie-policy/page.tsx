import { Cookie, SlidersHorizontal, ShieldCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  COOKIE_POLICY_SECTIONS,
  TRUST_LAST_UPDATED,
  pickText,
} from '@/data/trustCenter';
import {
  AnchorLink,
  InfoChips,
  LegalSectionView,
  SummaryCard,
} from '@/components/trust/TrustUI';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function CookiePolicyPage({ params }: PageProps) {
  const { locale } = await params;
  const isId = locale === 'id';
  const points = [
    {
      icon: Cookie,
      text: isId
        ? 'Cookie membantu login, preferensi, dan keamanan.'
        : 'Cookies help login, preferences, and security.',
    },
    {
      icon: ShieldCheck,
      text: isId
        ? 'Cookie sensitif dibatasi sesuai kebutuhan layanan.'
        : 'Sensitive cookies are limited to service needs.',
    },
    {
      icon: SlidersHorizontal,
      text: isId
        ? 'Preferensi bisa diatur dari browser atau pengaturan akun.'
        : 'Preferences can be managed in your browser or account settings.',
    },
  ];

  return (
    <main className="page-shell page-shell-readable page-rhythm pb-6 pt-4 lg:pb-10">
      <SummaryCard
        title={isId ? 'Cookie di Lajukan' : 'Cookies at Lajukan'}
        description={
          isId
            ? 'Ringkasan jenis cookie, kenapa dipakai, dan cara mengontrolnya.'
            : 'A concise summary of cookie types, why they are used, and how to control them.'
        }
        meta={isId ? 'Cookie' : 'Cookie Policy'}
      >
        <div className="grid w-full gap-2 sm:grid-cols-3">
          {points.map(item => {
            const Icon = item.icon;
            return (
              <div
                key={item.text}
                className="rounded-[16px] bg-[color:var(--app-surface-muted)] px-3 py-3 text-sm text-[color:var(--app-text-soft)]"
              >
                <Icon className="mb-2 h-4 w-4 text-[color:var(--app-accent)]" />
                {item.text}
              </div>
            );
          })}
        </div>

        <InfoChips
          items={[
            isId ? 'Login' : 'Login',
            isId ? 'Preferensi' : 'Preferences',
            isId ? 'Keamanan' : 'Security',
            isId ? 'Analitik terbatas' : 'Limited analytics',
          ]}
        />

        <div className="flex flex-wrap gap-2">
          {COOKIE_POLICY_SECTIONS.map(section => (
            <AnchorLink
              key={section.id}
              href={`#${section.id}`}
              label={pickText(locale, section.title)}
            />
          ))}
        </div>

        <Link
          href="/trust"
          className="ui-button-secondary inline-flex items-center px-4 text-sm"
        >
          {isId ? 'Trust Center' : 'Trust Center'}
        </Link>
      </SummaryCard>

      <section className="text-xs text-[color:var(--app-text-soft)]">
        {isId ? 'Terakhir diperbarui' : 'Last updated'}:{' '}
        {pickText(locale, TRUST_LAST_UPDATED)}
      </section>

      <section className="space-y-3">
        {COOKIE_POLICY_SECTIONS.map(section => (
          <div key={section.id} id={section.id} className="scroll-mt-24">
            <LegalSectionView
              section={section}
              locale={locale as 'id' | 'en'}
            />
          </div>
        ))}
      </section>
    </main>
  );
}
