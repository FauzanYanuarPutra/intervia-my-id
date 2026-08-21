'use client';

import { useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import {
  BadgeDollarSign,
  Brain,
  BriefcaseBusiness,
  Building2,
  CircleGauge,
  Gavel,
  Globe2,
  HeartHandshake,
  Landmark,
  Layers3,
  MapPinned,
  Scale,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { SUPER_APP_ATLAS, SUPER_APP_ATLAS_STATS, SUPER_APP_SNAPSHOT } from '@/data/superAppAtlas';

const ICONS: Record<string, LucideIcon> = {
  psychology: Brain,
  business: BriefcaseBusiness,
  philosophy: Scale,
  ux: Sparkles,
  engineering: Layers3,
  'data-ai': CircleGauge,
  economics: Landmark,
  growth: BadgeDollarSign,
  society: Users,
  law: Gavel,
  security: ShieldCheck,
  operations: Workflow,
  finance: HeartHandshake,
  organization: Building2,
  infrastructure: MapPinned,
};

export function SuperAppSnapshot() {
  const locale = useLocale();
  const isId = locale === 'id';
  const items = isId ? SUPER_APP_SNAPSHOT.id : SUPER_APP_SNAPSHOT.en;

  return (
    <section className="ui-panel rounded-[28px] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
            {isId ? 'Operating system produk' : 'Product operating system'}
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-[color:var(--app-text)]">
            {isId ? 'Platform ini tidak boleh hanya kaya fitur' : 'This platform cannot be feature-rich only'}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--app-text-soft)]">
            {isId
              ? 'Super app yang benar perlu ditopang ilmu perilaku, ekonomi, etika, operasi, dan rekayasa sistem secara bersamaan.'
              : 'A real super app needs behavioral science, economics, ethics, operations, and systems engineering working together.'}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <MetricCard value={SUPER_APP_ATLAS_STATS.domains} label={isId ? 'Domain' : 'Domains'} />
          <MetricCard value={SUPER_APP_ATLAS_STATS.disciplines} label={isId ? 'Ilmu' : 'Disciplines'} />
          <MetricCard value={SUPER_APP_ATLAS_STATS.subtopics} label={isId ? 'Subtopik' : 'Subtopics'} />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <article key={item.title} className="ui-panel-muted rounded-[22px] p-4">
            <h3 className="text-sm font-bold text-[color:var(--app-text)]">{item.title}</h3>
            <p className="mt-2 text-xs leading-5 text-[color:var(--app-text-soft)]">{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function MetricCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="ui-panel-muted rounded-[18px] px-3 py-3">
      <p className="text-lg font-bold text-[color:var(--app-text)]">{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--app-text-soft)]">
        {label}
      </p>
    </div>
  );
}

export function SuperAppOperatingSystem() {
  const locale = useLocale();
  const isId = locale === 'id';
  const [activeSlug, setActiveSlug] = useState(SUPER_APP_ATLAS[0]?.slug ?? 'psychology');

  const activeDomain = useMemo(
    () => SUPER_APP_ATLAS.find((domain) => domain.slug === activeSlug) ?? SUPER_APP_ATLAS[0],
    [activeSlug],
  );

  return (
    <section className="space-y-6">
      <div className="ui-panel ui-hero-panel rounded-[32px] p-6 sm:p-8 lg:p-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
          {isId ? 'Peta ilmu super app' : 'Super app knowledge map'}
        </p>
        <h2 className="mt-3 max-w-4xl text-3xl font-bold tracking-tight text-[color:var(--app-text)] sm:text-4xl">
          {isId
            ? '150 disiplin yang mempengaruhi bagaimana produk ini harus dibangun'
            : '150 disciplines shaping how this product should be built'}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--app-text-soft)]">
          {isId
            ? 'Daftar ini lebih luas dari psikologi, bisnis, dan filsafat. Ia mencakup juga UX, ekonomi platform, hukum, keamanan, operasi, keuangan, geografi, organisasi, dan data.'
            : 'This goes beyond psychology, business, and philosophy. It also includes UX, platform economics, law, security, operations, finance, geography, organization, and data.'}
        </p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard value={SUPER_APP_ATLAS_STATS.domains} label={isId ? 'Domain inti' : 'Core domains'} />
          <MetricCard value={SUPER_APP_ATLAS_STATS.disciplines} label={isId ? 'Disiplin' : 'Disciplines'} />
          <MetricCard value={SUPER_APP_ATLAS_STATS.subtopics} label={isId ? 'Subtopik rinci' : 'Detailed subtopics'} />
        </div>
      </div>

      <div className="ui-panel rounded-[28px] p-5">
        <div className="flex flex-wrap gap-2">
          {SUPER_APP_ATLAS.map((domain) => {
            const Icon = ICONS[domain.slug] || Globe2;
            const active = domain.slug === activeDomain.slug;
            return (
              <button
                key={domain.slug}
                type="button"
                onClick={() => setActiveSlug(domain.slug)}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${active
                    ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] shadow-[0_16px_28px_-18px_rgba(5,150,105,0.65)]'
                    : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] hover:text-[color:var(--app-text)]'
                  }`}
              >
                <Icon className="h-4 w-4" />
                <span>{isId ? domain.titleId : domain.titleEn}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="ui-panel rounded-[28px] p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
            {isId ? activeDomain.eyebrowId : activeDomain.eyebrowEn}
          </p>
          <h3 className="mt-2 text-2xl font-bold tracking-tight text-[color:var(--app-text)]">
            {isId ? activeDomain.titleId : activeDomain.titleEn}
          </h3>

          <div className="mt-5 space-y-3">
            <div className="ui-panel-muted rounded-[22px] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                {isId ? 'Kenapa penting' : 'Why it matters'}
              </p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
                {isId ? activeDomain.whyId : activeDomain.whyEn}
              </p>
            </div>

            <div className="ui-panel-muted rounded-[22px] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                {isId ? 'Kalau diabaikan' : 'If ignored'}
              </p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
                {isId ? activeDomain.riskId : activeDomain.riskEn}
              </p>
            </div>

            <div className="ui-panel-muted rounded-[22px] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                {isId ? 'Terjemahan ke produk' : 'Translation into product'}
              </p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
                {isId ? activeDomain.uiId : activeDomain.uiEn}
              </p>
            </div>
          </div>
        </article>

        <article className="ui-panel rounded-[28px] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                {isId ? 'Disiplin & subtopik' : 'Disciplines & subtopics'}
              </p>
              <h3 className="mt-2 text-xl font-bold tracking-tight text-[color:var(--app-text)]">
                {isId ? 'Daftar rinci untuk domain terpilih' : 'Detailed list for the selected domain'}
              </h3>
            </div>
            <div className="ui-inline-meta bg-[color:var(--app-surface-muted)]">
              {activeDomain.disciplines.length} {isId ? 'ilmu' : 'disciplines'}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3">
            {activeDomain.disciplines.map((discipline) => (
              <div key={discipline.name} className="ui-panel-muted rounded-[22px] p-4">
                <h4 className="text-sm font-bold text-[color:var(--app-text)]">{discipline.name}</h4>
                <div className="mt-3 flex flex-wrap gap-2">
                  {discipline.subtopics.map((subtopic) => (
                    <span
                      key={subtopic}
                      className="inline-flex min-h-[32px] items-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-xs font-medium text-[color:var(--app-text-soft)]"
                    >
                      {subtopic}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
