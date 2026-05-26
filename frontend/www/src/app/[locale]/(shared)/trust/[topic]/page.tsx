import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  TRUST_LAST_UPDATED,
  getTrustTopic,
  pickText,
} from '@/data/trustCenter';
import {
  InfoChips,
  LegalSectionView,
  SummaryCard,
  TrustBadge,
} from '@/components/trust/TrustUI';

type PageProps = {
  params: Promise<{ locale: string; topic: string }>;
};

export default async function TrustTopicPage({ params }: PageProps) {
  const { locale, topic } = await params;
  const isId = locale === 'id';
  const entry = getTrustTopic(topic);

  if (!entry) {
    notFound();
  }

  const title = pickText(locale, entry.title);
  const summary = pickText(locale, entry.summary);
  const audience = pickText(locale, entry.audience);

  return (
    <main className="page-shell page-rhythm pb-6 pt-6 lg:pb-10">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--app-text-soft)]">
        <Link href="/trust" className="inline-flex items-center gap-1 bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
          <ArrowLeft className="h-3.5 w-3.5" />
          {isId ? 'Trust Center' : 'Trust Center'}
        </Link>
        <span>/</span>
        <span>{pickText(locale, entry.shortTitle)}</span>
      </div>

      <section className="ui-panel ui-hero-panel rounded-[28px] p-6 sm:p-8">
        <TrustBadge label={pickText(locale, entry.badge)} />
        <h1 className="mt-4 text-3xl font-black tracking-tight text-[color:var(--app-text)] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--app-text-soft)]">
          {summary}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <InfoChips
            items={[
              audience,
              `${isId ? 'Update' : 'Updated'}: ${pickText(locale, TRUST_LAST_UPDATED)}`,
            ]}
          />
        </div>
      </section>

      <SummaryCard
        title={isId ? 'Siapa yang perlu membaca ini' : 'Who should read this'}
        description={audience}
        meta={isId ? 'Ringkasan' : 'Summary'}
      >
        <Link href="/support" className="ui-button-secondary inline-flex items-center px-4 text-sm">
          {isId ? 'Butuh bantuan' : 'Get support'}
        </Link>
        <Link href="/privacy" className="ui-button-secondary inline-flex items-center px-4 text-sm">
          {isId ? 'Kebijakan Privasi' : 'Privacy Policy'}
        </Link>
      </SummaryCard>

      <section className="space-y-3">
        {entry.sections.map((section, index) => (
          <LegalSectionView
            key={section.id}
            section={section}
            locale={locale as 'id' | 'en'}
            defaultOpen={index === 0}
          />
        ))}
      </section>
    </main>
  );
}
