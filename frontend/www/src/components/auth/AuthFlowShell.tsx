'use client';

import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import LajuloLogo from '@/components/logo/LajuloLogo';

type AuthFlowHighlight = {
  title: string;
  description: string;
};

type AuthFlowShellProps = {
  locale: 'id' | 'en';
  title: string;
  description?: string;
  badge?: string;
  currentStep?: number;
  totalSteps?: number;
  progressLabel?: string;
  highlights?: AuthFlowHighlight[];
  helperText?: string;
  children: ReactNode;
};

export default function AuthFlowShell({
  locale,
  title,
  description,
  badge,
  currentStep,
  totalSteps,
  progressLabel,
  highlights = [],
  helperText,
  children,
}: AuthFlowShellProps) {
  const isId = locale === 'id';
  const hasProgress = Boolean(currentStep && totalSteps);
  const safeStep =
    hasProgress && totalSteps
      ? Math.min(Math.max(currentStep ?? 1, 1), totalSteps)
      : 0;
  const progressValue =
    hasProgress && totalSteps ? Math.max((safeStep / totalSteps) * 100, 16) : 0;
  const safeTotalSteps = totalSteps ?? 1;
  const visibleHighlights = highlights.slice(0, 2);
  const helperSummary = helperText || visibleHighlights[0]?.description || '';
  const mobileHomeLabel = isId ? 'Beranda' : 'Home';
  const desktopHomeLabel = isId ? 'Kembali ke beranda' : 'Back to home';

  return (
    <div className="relative min-h-svh overflow-hidden bg-[linear-gradient(180deg,#f7f3ea_0%,#eef5ff_100%)] dark:bg-[linear-gradient(180deg,#020617_0%,#0f172a_100%)]">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute left-[-8rem] top-[-6rem] h-64 w-64 rounded-full bg-[radial-gradient(circle,_rgba(14,165,233,0.18)_0%,_rgba(14,165,233,0)_70%)] blur-2xl" />
        <div className="absolute bottom-[-9rem] right-[-6rem] h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(249,115,22,0.18)_0%,_rgba(249,115,22,0)_72%)] blur-2xl" />
      </div>

      <div className="relative mx-auto max-w-xl px-3 py-3 sm:px-6 sm:py-5 lg:py-8">
        <section className="rounded-[26px] border border-white/70 bg-[color:color-mix(in_srgb,var(--app-surface-strong)_96%,white_4%)] p-3.5 shadow-[0_24px_48px_-36px_rgba(15,23,42,0.18)] backdrop-blur sm:rounded-[32px] sm:p-6 lg:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/home"
              className="inline-flex items-center rounded-full border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_94%,white_6%)] px-3 py-2 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.22)]"
            >
              <span className="inline-flex max-w-[124px] sm:max-w-[148px]">
                <LajuloLogo />
              </span>
            </Link>
            <div className="flex items-center gap-2">
              {hasProgress ? (
                <span className="inline-flex min-h-[34px] items-center rounded-full border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_86%,white_14%)] px-3 text-[10px] font-semibold text-[color:var(--app-text)] sm:hidden">
                  {safeStep}/{safeTotalSteps}
                </span>
              ) : null}
              <Link
                href="/home"
                className="inline-flex min-h-[40px] items-center rounded-full border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_88%,white_12%)] px-3 text-xs font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] sm:min-h-[42px] sm:px-4 sm:text-sm"
              >
                <span className="sm:hidden">{mobileHomeLabel}</span>
                <span className="hidden sm:inline">{desktopHomeLabel}</span>
              </Link>
            </div>
          </div>

          <div className="mt-3 hidden flex-wrap gap-2 sm:mt-5 sm:flex">
            <span className="inline-flex min-h-[30px] items-center rounded-full bg-[color:color-mix(in_srgb,var(--app-accent-soft)_66%,white_34%)] px-3 text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
              {badge || (isId ? 'Masuk cepat' : 'Fast flow')}
            </span>
            {hasProgress ? (
              <span className="hidden min-h-[30px] items-center rounded-full border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_86%,white_14%)] px-3 text-[10px] font-semibold text-[color:var(--app-text)] sm:inline-flex">
                {isId
                  ? `Langkah ${safeStep}/${totalSteps}`
                  : `Step ${safeStep}/${totalSteps}`}
              </span>
            ) : null}
          </div>

          <div className="mt-3 sm:mt-4">
            <h1 className="max-w-2xl text-[1.15rem] font-black tracking-[-0.05em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-[2rem] lg:text-[2.2rem]">
              {title}
            </h1>

            {description ? (
              <p className="mt-2 hidden max-w-2xl text-sm leading-6 text-[color:var(--app-text-soft)] sm:block">
                {description}
              </p>
            ) : null}
          </div>

          {hasProgress ? (
            <div className="mt-4 hidden rounded-[20px] border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-muted)_84%,white_16%)] p-3.5 sm:block">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-[color:var(--app-text)]">
                  {progressLabel ??
                    (isId
                      ? `Tinggal ${Math.max(safeTotalSteps - safeStep, 0)} langkah lagi`
                      : `${Math.max(safeTotalSteps - safeStep, 0)} steps left`)}
                </p>
                <span className="text-xs font-bold text-[color:var(--app-accent)]">
                  {Math.round(progressValue)}%
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color:var(--app-surface)]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,var(--app-accent),var(--app-accent-strong))] transition-[width] duration-300"
                  style={{ width: `${progressValue}%` }}
                />
              </div>
            </div>
          ) : null}

          {helperSummary || visibleHighlights.length > 0 ? (
            <div className="mt-4 hidden rounded-[20px] border border-[color:color-mix(in_srgb,var(--app-accent)_14%,var(--app-border))] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_88%,white_12%)] p-3.5 sm:block">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                {isId ? 'Biar cepat' : 'Keep it fast'}
              </p>
              {helperSummary ? (
                <p className="mt-2 text-sm leading-6 text-[color:var(--app-text)]">
                  {helperSummary}
                </p>
              ) : null}
              {visibleHighlights.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {visibleHighlights.map((item, index) => (
                    <div
                      key={`${item.title}-${index}`}
                      className="flex items-start gap-2 rounded-[16px] bg-[color:color-mix(in_srgb,var(--app-surface-muted)_84%,white_16%)] px-3 py-2.5"
                    >
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--app-accent-soft)_68%,white_32%)] text-[color:var(--app-accent)]">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[color:var(--app-text)]">
                          {item.title}
                        </p>
                        <p className="mt-1 text-sm leading-5 text-[color:var(--app-text-soft)]">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className={hasProgress ? 'mt-4 sm:mt-5' : 'mt-3 sm:mt-4'}>
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}
