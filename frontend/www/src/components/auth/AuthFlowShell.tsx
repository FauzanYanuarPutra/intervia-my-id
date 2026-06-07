'use client';

import type { ReactNode } from 'react';
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
  void helperText;
  void highlights;
  const mobileHomeLabel = isId ? 'Beranda' : 'Home';
  const desktopHomeLabel = isId ? 'Beranda' : 'Home';

  return (
    <main className="min-h-svh bg-[color:var(--app-surface-muted)] px-3 py-4 text-[color:var(--app-text)] sm:grid sm:place-items-center sm:py-7">
      <section className="mx-auto flex w-full max-w-[400px] flex-col">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link
            href="/home"
            className="inline-flex min-w-0 items-center rounded-full px-1 py-1 transition hover:opacity-85"
            aria-label={mobileHomeLabel}
          >
            <span className="inline-flex w-[108px] sm:w-[124px]">
              <LajuloLogo />
            </span>
          </Link>
          <Link
            href="/home"
            className="inline-flex min-h-10 shrink-0 items-center rounded-full px-3 text-xs font-semibold text-[color:var(--app-text-soft)] transition hover:text-[color:var(--app-accent)] sm:text-sm"
          >
            <span className="sm:hidden">{mobileHomeLabel}</span>
            <span className="hidden sm:inline">{desktopHomeLabel}</span>
          </Link>
        </div>

        <div className="rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[0_22px_54px_-42px_rgba(15,23,42,0.42)] sm:p-5">
          <div className={badge ? 'mt-2' : ''}>
            <h1 className="text-[1.48rem] font-black leading-tight tracking-[-0.035em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-[1.62rem]">
              {title}
            </h1>

            {description ? (
              <p className="mt-1 text-[12px] font-semibold leading-5 text-[color:var(--app-text-soft)]">
                {description}
              </p>
            ) : null}
          </div>

          {hasProgress ? (
            <div className="mt-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5" aria-label={progressLabel}>
                  {Array.from({ length: safeTotalSteps }).map((_, index) => (
                    <span
                      key={index}
                      className={`h-2 rounded-full transition-all ${index + 1 <= safeStep
                          ? 'w-6 bg-[color:var(--app-accent)]'
                          : 'w-2 bg-[color:var(--app-surface-muted)]'
                        }`}
                    />
                  ))}
                </div>
                <span className="text-[11px] font-black text-[color:var(--app-text-soft)]">
                  {safeStep}/{safeTotalSteps}
                </span>
              </div>
              <div className="sr-only h-1.5 overflow-hidden rounded-full bg-[color:var(--app-surface-muted)]">
                <div
                  className="h-full rounded-full bg-[color:var(--app-accent)] transition-[width] duration-300"
                  style={{ width: `${progressValue}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="mt-5">{children}</div>
        </div>
      </section>
    </main>
  );
}
