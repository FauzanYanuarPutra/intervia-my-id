import { Link } from '@/i18n/navigation';
import { pickText } from '@/data/trustCenter';
import { LEARN_PATHS, LEARN_TRACKS } from '@/data/educationHub';
import { InfoChips, SummaryCard, TrustBadge } from '@/components/trust/TrustUI';
import { BookOpen, Sparkles, Trophy } from 'lucide-react';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function LearnPage({ params }: PageProps) {
  const { locale } = await params;
  const isId = locale === 'id';

  return (
    <div className="min-h-screen bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)]">
      <div className="page-shell space-y-6 py-6">
        <SummaryCard
          title={isId ? 'Belajar singkat' : 'Learn business operations on Lajukan'}
          description={
            isId
              ? 'Checklist pendek buat sourcing, eksekusi, repeat order.'
              : 'Short lessons, checklists, and community inspiration to help you source better, execute faster, and stabilize repeat orders.'
          }
          meta={isId ? 'Belajar' : 'Learn'}
        >
          <InfoChips
            items={[
              isId ? 'Sourcing' : 'Sourcing',
              isId ? 'Operasional' : 'Operations',
              isId ? 'Storefront' : 'Storefront',
              isId ? 'Repeat order' : 'Repeat orders',
            ]}
          />
          <Link href="/education" className="ui-button-secondary inline-flex items-center px-4 text-sm">
            {isId ? 'Pusat edukasi' : 'Go to education'}
          </Link>
        </SummaryCard>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <TrustBadge label={isId ? 'MULAI' : 'LEARNING PATHS'} />
            <h2 className="text-lg font-bold text-[color:var(--app-text)]">
              {isId ? 'Mulai sini' : 'Start here'}
            </h2>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {LEARN_PATHS.map((path) => (
              <article key={path.id} className="ui-panel rounded-[20px] p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-[color:var(--app-text)]">
                      {pickText(locale, path.title)}
                    </h3>
                    <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                      {pickText(locale, path.summary)}
                    </p>
                  </div>
                  <BookOpen className="h-5 w-5 text-[color:var(--app-accent)]" />
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                  <span className="rounded-full border border-[color:var(--app-border)] px-3 py-1">
                    {pickText(locale, path.level)}
                  </span>
                  <span className="rounded-full border border-[color:var(--app-border)] px-3 py-1">
                    {pickText(locale, path.duration)}
                  </span>
                </div>
                <ul className="space-y-1 text-sm text-[color:var(--app-text-soft)]">
                  {path.modules.map((module) => (
                    <li key={pickText(locale, module)} className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[color:var(--app-accent)]" />
                      <span>{pickText(locale, module)}</span>
                    </li>
                  ))}
                </ul>
                <button className="ui-button-primary w-full text-sm">
                  {isId ? 'Mulai modul' : 'Start module'}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <TrustBadge label={isId ? 'RINGAN' : 'LIGHT ENTERTAINMENT'} />
            <h2 className="text-lg font-bold text-[color:var(--app-text)]">
              {isId ? 'Format ringan' : 'Learn through lighter formats'}
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {LEARN_TRACKS.map((track) => (
              <article key={track.id} className="ui-panel rounded-[20px] p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-[color:var(--app-text)]">
                      {pickText(locale, track.title)}
                    </h3>
                    <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                      {pickText(locale, track.summary)}
                    </p>
                  </div>
                  {track.id === 'quiz' ? (
                    <Trophy className="h-5 w-5 text-[color:var(--app-warning)]" />
                  ) : (
                    <Sparkles className="h-5 w-5 text-[color:var(--app-info)]" />
                  )}
                </div>
                <button className="ui-button-secondary w-full text-sm">
                  {pickText(locale, track.cta)}
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
