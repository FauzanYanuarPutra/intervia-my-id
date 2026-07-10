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
  const hasProgress = Boolean(currentStep && totalSteps && totalSteps > 1);
  const safeStep =
    hasProgress && totalSteps
      ? Math.min(Math.max(currentStep ?? 1, 1), totalSteps)
      : 0;
  const progressValue =
    hasProgress && totalSteps ? Math.max((safeStep / totalSteps) * 100, 16) : 0;
  const safeTotalSteps = totalSteps ?? 1;
  const mobileHomeLabel = isId ? 'Beranda' : 'Home';
  const desktopHomeLabel = isId ? 'Beranda' : 'Home';

  return (
    <main className="min-h-svh overflow-hidden bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--app-accent-soft)_55%,transparent),transparent_34%),var(--app-surface-muted)] px-3 py-4 text-[color:var(--app-text)] sm:grid sm:place-items-center sm:py-7">
      <section className="mx-auto flex w-full max-w-[430px] flex-col">
        <div className="mb-4 flex items-center justify-between gap-3 px-1">
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

        <div className="rounded-[24px] border border-[color:color-mix(in_srgb,var(--app-accent)_18%,var(--app-border))] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_96%,white_4%)] p-4 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.48)] sm:p-5">
          <div>
            {badge ? (
              <span className="mb-3 inline-flex min-h-7 items-center rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--app-accent-strong)]">
                {badge}
              </span>
            ) : null}
            <h1 className="text-[1.48rem] font-bold leading-tight tracking-[-0.035em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-[1.62rem]">
              {title}
            </h1>

            {description ? (
              <p className="mt-1 text-[12px] font-semibold leading-5 text-[color:var(--app-text-soft)]">
                {description}
              </p>
            ) : null}

            {helperText ? (
              <p className="mt-2 rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2 text-[11px] font-bold leading-5 text-[color:var(--app-text-soft)]">
                {helperText}
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
                <span className="text-[11px] font-bold text-[color:var(--app-text-soft)]">
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

          {highlights.length > 0 ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {highlights.slice(0, 4).map(item => (
                <div
                  key={`${item.title}-${item.description}`}
                  className="rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2"
                >
                  <p className="text-xs font-bold text-[color:var(--app-text)]">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold leading-4 text-[color:var(--app-text-soft)]">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-5">{children}</div>
        </div>
      </section>
    </main>
  );
}
