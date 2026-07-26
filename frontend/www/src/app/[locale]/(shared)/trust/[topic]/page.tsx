import { notFound } from 'next/navigation';
import { ArrowLeft, LifeBuoy, ShieldCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  TRUST_LAST_UPDATED,
  getTrustTopic,
  pickText,
} from '@/data/trustCenter';
import {
  AnchorLink,
  InfoChips,
  LegalSectionView,
  TrustBadge,
} from '@/components/trust/TrustUI';

type PageProps = {
  params: Promise<{ locale: string; topic: string }>;
};

export default async function TrustTopicPage({ params }: PageProps) {
  const { locale, topic } = await params;
  const isId = locale === 'id';
  const entry = getTrustTopic(topic);

  if (!entry) notFound();

  const title = pickText(locale, entry.title);
  const summary = pickText(locale, entry.summary);
  const audience = pickText(locale, entry.audience);

  return (
    <main className="page-shell page-rhythm pb-6 pt-4 lg:pb-10">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--app-text-soft)]">
        <Link
          href="/trust"
          className="inline-flex min-h-8 items-center gap-1 rounded-full bg-[color:var(--app-accent-soft)] px-3 font-bold text-[color:var(--app-accent)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {isId ? 'Trust Center' : 'Trust Center'}
        </Link>
        <span>/</span>
        <span>{pickText(locale, entry.shortTitle)}</span>
      </div>

      <section className="ui-panel ui-hero-panel rounded-[28px] p-5 sm:p-7">
        <TrustBadge label={pickText(locale, entry.badge)} />
        <h1 className="mt-4 max-w-4xl text-3xl font-bold tracking-tight text-[color:var(--app-text)] sm:text-4xl">
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

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="ui-panel rounded-[24px] p-5">
          <p className="inline-flex rounded-full bg-[color:var(--app-accent-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
            {isId ? 'Baca cepat' : 'Quick read'}
          </p>
          <h2 className="mt-2 text-xl font-bold text-[color:var(--app-text)]">
            {isId ? 'Isi halaman ini' : 'What is inside'}
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {entry.sections.map(section => (
              <AnchorLink
                key={section.id}
                href={`#${section.id}`}
                label={pickText(locale, section.title)}
              />
            ))}
          </div>
        </div>

        <div className="ui-panel-muted rounded-[24px] p-5">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-[16px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <h2 className="mt-3 text-base font-bold text-[color:var(--app-text)]">
            {isId ? 'Butuh tindakan cepat?' : 'Need quick action?'}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
            {isId
              ? 'Kalau masalahnya soal akun, data, transaksi, atau konten, masuk lewat support agar ada riwayat.'
              : 'For account, data, transaction, or content issues, use support so there is a clear trail.'}
          </p>
          <Link
            href="/support"
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-[color:var(--app-accent)] px-4 text-sm font-bold text-white"
          >
            <LifeBuoy className="h-4 w-4" />
            {isId ? 'Buka support' : 'Open support'}
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        {entry.sections.map((section, index) => (
          <div key={section.id} id={section.id} className="scroll-mt-24">
            <LegalSectionView
              section={section}
              locale={locale as 'id' | 'en'}
              defaultOpen={index === 0}
            />
          </div>
        ))}
      </section>
    </main>
  );
}
