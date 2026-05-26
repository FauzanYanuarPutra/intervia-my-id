'use client';

import { useState } from 'react';
import clsx from 'clsx';
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Coins,
  GraduationCap,
  Rocket,
  ShieldCheck,
  Sparkles,
  Store,
  Target,
  Users,
  Wallet,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  ZERO_CAPITAL_DAILY_LOOP,
  ZERO_CAPITAL_EDUCATION_MODULES,
  ZERO_CAPITAL_GUARDRAILS,
  ZERO_CAPITAL_LADDER,
  ZERO_CAPITAL_OPPORTUNITIES,
  ZERO_CAPITAL_STAGES,
  pickJourneyText,
  type JourneyAction,
  type JourneyIconKey,
} from '@/data/zeroCapitalJourney';

type ZeroCapitalJourneyProps = {
  variant?: 'compact' | 'full';
  className?: string;
};

const ICONS: Record<JourneyIconKey, LucideIcon> = {
  sparkles: Sparkles,
  wallet: Wallet,
  coins: Coins,
  briefcase: BriefcaseBusiness,
  store: Store,
  rocket: Rocket,
  book: BookOpen,
  target: Target,
  shield: ShieldCheck,
  users: Users,
  graduation: GraduationCap,
  workflow: Workflow,
};

const ACTION_TONES: Record<JourneyAction['tone'], string> = {
  emerald:
    'bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]',
  sky: 'bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]',
  amber:
    'bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]',
  rose: 'bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]',
  violet:
    'bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]',
};

export function ZeroCapitalJourney({
  variant = 'compact',
  className = '',
}: ZeroCapitalJourneyProps) {
  const locale = useLocale();
  const isId = locale === 'id';
  const [activeSlug, setActiveSlug] = useState(ZERO_CAPITAL_STAGES[0]?.slug ?? 'level-0');

  const activeStage =
    ZERO_CAPITAL_STAGES.find((stage) => stage.slug === activeSlug) ?? ZERO_CAPITAL_STAGES[0];
  const ActiveIcon = ICONS[activeStage.icon];

  const title =
    variant === 'full'
      ? isId
        ? 'Peta lengkap dari nol modal sampai punya usaha yang bisa jalan sendiri'
        : 'A full map from zero capital to a business that can run on its own'
      : isId
        ? 'Mulai dari nol modal, cari cashflow pertama, lalu naik kelas ke usaha sendiri'
        : 'Start from zero capital, find first cashflow, then level up into your own business';
  const description =
    variant === 'full'
      ? isId
        ? 'Urutannya dibuat sehat seperti progression ladder: jangan loncat ke stok, tim, atau toko sebelum ada bukti kerja, cashflow, buffer, dan sistem.'
        : 'The order is intentionally healthy like a progression ladder: do not jump into stock, teams, or stores before proof of work, cashflow, buffer, and systems exist.'
      : isId
        ? 'Urutan sehat: belajar, cari uang pertama, bangun modal, buka usaha.'
        : 'This flow enforces a healthy sequence: learn what gets used immediately, find the first money, build small capital, then open the business at the right moment.';

  return (
    <section className={clsx('ui-panel rounded-[32px] p-5 sm:p-6', className)}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-4xl">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
            {isId ? 'Zero To Business Engine' : 'Zero To Business Engine'}
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-[color:var(--app-text)] sm:text-3xl">
            {title}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--app-text-soft)]">
            {description}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            {
              value: ZERO_CAPITAL_STAGES.length,
              label: isId ? 'Level' : 'Levels',
            },
            {
              value: ZERO_CAPITAL_OPPORTUNITIES.length,
              label: isId ? 'Jalur Rp0' : '$0 paths',
            },
            {
              value: ZERO_CAPITAL_EDUCATION_MODULES.length,
              label: isId ? 'Track belajar' : 'Learning tracks',
            },
          ].map((item) => (
            <div key={item.label} className="ui-panel-muted rounded-[20px] px-3 py-3">
              <p className="text-lg font-black text-[color:var(--app-text)]">{item.value}</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--app-text-soft)]">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
        {ZERO_CAPITAL_STAGES.map((stage) => {
          const StageIcon = ICONS[stage.icon];
          const active = stage.slug === activeStage.slug;
          return (
            <button
              key={stage.slug}
              type="button"
              onClick={() => setActiveSlug(stage.slug)}
              className={clsx(
                'inline-flex min-h-[52px] shrink-0 items-center gap-3 rounded-full border px-4 text-left transition',
                active
                  ? 'bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] shadow-[0_18px_28px_-18px_rgba(5,150,105,0.7)]'
                  : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] hover:text-[color:var(--app-text)]',
              )}
            >
              <span className={clsx('inline-flex h-9 w-9 items-center justify-center rounded-full', active ? 'text-[color:var(--app-accent)]' : 'bg-[color:var(--app-surface-strong)]')}>
                <StageIcon className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-[10px] font-black uppercase tracking-[0.16em]">
                  {stage.level}
                </span>
                <span className="block text-sm font-semibold">{pickJourneyText(stage.title, locale)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className={clsx('mt-6 grid gap-4', variant === 'full' ? 'xl:grid-cols-[1.08fr_0.92fr]' : 'lg:grid-cols-[1.08fr_0.92fr]')}>
        <article className="overflow-hidden rounded-[28px] border text-[color:var(--app-accent)] bg-[linear-gradient(135deg,rgba(236,253,245,0.95),rgba(224,242,254,0.88))] p-5 shadow-[0_18px_50px_-40px_rgba(5,150,105,0.45)] text-[color:var(--app-accent)] dark:bg-[linear-gradient(135deg,rgba(6,78,59,0.25),rgba(12,74,110,0.18))]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full text-[color:var(--app-accent)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
              {activeStage.level}
            </span>
            <span className="rounded-full text-[color:var(--app-accent)] px-3 py-1 text-[11px] font-semibold bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
              {pickJourneyText(activeStage.capital, locale)}
            </span>
          </div>

          <div className="mt-4 flex items-start gap-4">
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] shadow-[0_16px_30px_-22px_rgba(5,150,105,0.9)]">
              <ActiveIcon className="h-6 w-6" />
            </span>
            <div>
              <h3 className="text-2xl font-black tracking-tight bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                {pickJourneyText(activeStage.title, locale)}
              </h3>
              <p className="mt-2 text-sm leading-6 bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                {pickJourneyText(activeStage.summary, locale)}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-4 border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
              {isId ? 'Syarat naik level' : 'Level-up target'}
            </p>
            <p className="mt-2 text-sm leading-6 bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
              {pickJourneyText(activeStage.target, locale)}
            </p>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <div className="rounded-[24px] border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-4 border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                {isId ? 'Misi inti' : 'Core missions'}
              </p>
              <div className="mt-3 space-y-2">
                {activeStage.missions.map((mission) => (
                  <div key={mission.id} className="flex items-start gap-2 rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-3 py-3 text-sm bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]" />
                    <span>{pickJourneyText(mission, locale)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-4 border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                {isId ? 'Yang jangan dibalik' : 'Do not reverse this'}
              </p>
              <div className="mt-3 space-y-2">
                {activeStage.warnings.map((warning) => (
                  <div key={warning.id} className="rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-3 py-3 text-sm bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
                    {pickJourneyText(warning, locale)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>

        <div className="space-y-3">
          {activeStage.actions.map((action) => {
            const ActionIcon = ICONS[action.icon];
            return (
              <Link
                key={`${activeStage.slug}-${action.href}-${action.title.id}`}
                href={action.href}
                className={clsx('block rounded-[24px] border p-4 transition hover:-translate-y-0.5 hover:shadow-sm', ACTION_TONES[action.tone])}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
                    <ActionIcon className="h-5 w-5" />
                  </span>
                  <span className="rounded-full text-[color:var(--app-accent)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]">
                    {pickJourneyText(action.tag, locale)}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-black tracking-tight">
                  {pickJourneyText(action.title, locale)}
                </h3>
                <p className="mt-2 text-sm leading-6 opacity-90">
                  {pickJourneyText(action.description, locale)}
                </p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold">
                  {isId ? 'Jalankan sekarang' : 'Run this now'}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            );
          })}

          <div className="rounded-[24px] border text-[color:var(--app-accent)] bg-[color:var(--app-surface-muted)] p-4 text-[color:var(--app-accent)]">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
              {isId ? 'Boleh ditunda dulu' : 'Safe to postpone'}
            </p>
            <div className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
              {ZERO_CAPITAL_GUARDRAILS.map((item) => (
                <div key={item.id} className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-3">
                  {pickJourneyText(item, locale)}
                </div>
              ))}
            </div>

            <Link
              href={activeStage.ctaHref}
              className="ui-button-primary mt-4 inline-flex w-full items-center justify-center gap-2 px-4 text-sm"
            >
              {pickJourneyText(activeStage.cta, locale)}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {ZERO_CAPITAL_OPPORTUNITIES.map((lane) => {
          const LaneIcon = ICONS[lane.icon];
          return (
            <Link
              key={lane.slug}
              href={lane.href}
              className="ui-panel-muted ui-card-hover rounded-[24px] p-4"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_var(--app-accent),_var(--app-accent-strong))] text-[color:var(--app-accent)]">
                <LaneIcon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-black tracking-tight text-[color:var(--app-text)]">
                {pickJourneyText(lane.title, locale)}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
                {pickJourneyText(lane.description, locale)}
              </p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                {pickJourneyText(lane.cta, locale)}
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          );
        })}
      </div>

      {variant === 'full' ? (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 xl:grid-cols-[1.04fr_0.96fr]">
            <article className="ui-panel-muted rounded-[28px] p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                {isId ? 'Track edukasi' : 'Education tracks'}
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {ZERO_CAPITAL_EDUCATION_MODULES.map((module) => {
                  const ModuleIcon = ICONS[module.icon];
                  return (
                    <Link
                      key={module.slug}
                      href={module.href}
                      className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 transition text-[color:var(--app-accent)]"
                    >
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
                        <ModuleIcon className="h-4 w-4" />
                      </span>
                      <h3 className="mt-4 text-base font-black text-[color:var(--app-text)]">
                        {pickJourneyText(module.title, locale)}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
                        {pickJourneyText(module.description, locale)}
                      </p>
                      <p className="mt-3 text-xs font-semibold bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                        {pickJourneyText(module.outcome, locale)}
                      </p>
                      <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                        {pickJourneyText(module.cta, locale)}
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </article>

            <article className="ui-panel-muted rounded-[28px] p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                {isId ? 'Tangga modal' : 'Capital ladder'}
              </p>
              <div className="mt-4 space-y-3">
                {ZERO_CAPITAL_LADDER.map((item, index) => {
                  const LadderIcon = ICONS[item.icon];
                  return (
                    <Link
                      key={item.slug}
                      href={item.href}
                      className="block rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 transition text-[color:var(--app-accent)]"
                    >
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
                          <LadderIcon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                            {isId ? `Tahap ${index + 1}` : `Step ${index + 1}`}
                          </p>
                          <h3 className="mt-1 text-base font-black text-[color:var(--app-text)]">
                            {pickJourneyText(item.title, locale)}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
                            {pickJourneyText(item.description, locale)}
                          </p>
                          <p className="mt-3 rounded-2xl text-[color:var(--app-accent)] px-3 py-2 text-xs font-semibold bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
                            {pickJourneyText(item.rule, locale)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </article>
          </div>

          <article className="ui-panel-muted rounded-[28px] p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                  {isId ? 'Loop harian' : 'Daily loop'}
                </p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-[color:var(--app-text)]">
                  {isId ? 'Kalau belum punya apa-apa, ini ritme yang sehat' : 'If you have nothing yet, this is the healthy rhythm'}
                </h3>
              </div>
              <Link href="/education?track=zero-capital" className="ui-button-secondary inline-flex items-center justify-center px-4 text-sm">
                {isId ? 'Buka checklist harian' : 'Open daily checklist'}
              </Link>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {ZERO_CAPITAL_DAILY_LOOP.map((item) => (
                <div key={item.slug} className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                    {pickJourneyText(item.time, locale)}
                  </p>
                  <h4 className="mt-3 text-lg font-black text-[color:var(--app-text)]">
                    {pickJourneyText(item.title, locale)}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
                    {pickJourneyText(item.description, locale)}
                  </p>
                </div>
              ))}
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
