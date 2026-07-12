'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
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
  const defaultHighlights =
    highlights.length > 0
      ? highlights
      : [
          {
            title: isId ? 'Akun usaha' : 'Business account',
            description: isId
              ? 'Profil, chat, AI Studio, dan aktivitas tersimpan dalam satu akun.'
              : 'Profile, chat, AI Studio, and activity stay in one account.',
          },
          {
            title: isId ? 'Login cepat' : 'Fast sign-in',
            description: isId
              ? 'Gunakan Google untuk masuk tanpa form panjang.'
              : 'Use Google without a long form.',
          },
        ];

  return (
    <main className="min-h-svh overflow-x-hidden bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]">
      <section className="mx-auto grid min-h-svh w-full max-w-6xl grid-rows-[auto_1fr] px-4 py-4 sm:px-6 lg:px-8 lg:py-7">
        <header className="flex items-center justify-between gap-3">
          <Link
            href="/home"
            className="inline-flex min-w-0 items-center rounded-full py-1 transition hover:opacity-85"
            aria-label={mobileHomeLabel}
          >
            <span className="inline-flex w-[112px] sm:w-[132px]">
              <LajuloLogo />
            </span>
          </Link>
          <Link
            href="/home"
            className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-4 text-xs font-bold text-[color:var(--app-text-soft)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)]"
          >
            <span className="sm:hidden">{mobileHomeLabel}</span>
            <span className="hidden sm:inline">{desktopHomeLabel}</span>
          </Link>
        </header>

        <div className="grid min-h-0 content-center gap-5 py-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-8">
          <aside className="hidden min-h-[520px] flex-col justify-between rounded-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-7 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.4)] lg:flex">
            <div>
              <span className="inline-flex min-h-8 items-center gap-2 rounded-full bg-[color:var(--app-accent-soft)] px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--app-accent)]">
                <Sparkles className="h-3.5 w-3.5" />
                Lajukan
              </span>
              <h2 className="mt-5 max-w-xl text-4xl font-bold leading-[1.06] tracking-[-0.04em] text-[color:var(--app-text)]">
                {isId
                  ? 'Masuk ke ruang kerja bisnis yang rapi.'
                  : 'Enter a cleaner business workspace.'}
              </h2>
              <p className="mt-4 max-w-lg text-sm font-semibold leading-6 text-[color:var(--app-text-soft)]">
                {isId
                  ? 'Simpan profil, chat, kebutuhan usaha, AI Studio, dan aktivitas penting dalam satu akun Lajukan.'
                  : 'Keep your profile, chats, business needs, AI Studio, and key activity in one Lajukan account.'}
              </p>
            </div>

            <div className="grid gap-3">
              {defaultHighlights.slice(0, 3).map(item => (
                <div
                  key={`${item.title}-${item.description}`}
                  className="flex gap-3 rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                    <CheckCircle2 className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-[color:var(--app-text)]">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-xs font-semibold leading-5 text-[color:var(--app-text-soft)]">
                      {item.description}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </aside>

          <div className="mx-auto flex w-full max-w-[440px] flex-col justify-center">
            <div className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.45)] sm:p-5">
              <div>
                {badge ? (
                  <span className="mb-3 inline-flex min-h-7 items-center gap-2 rounded-full bg-[color:var(--app-surface-muted)] px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--app-text-soft)]">
                    <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--app-accent)]" />
                    {badge}
                  </span>
                ) : null}
                <h1 className="text-[1.55rem] font-bold leading-tight tracking-[-0.035em] text-[color:var(--app-text)] sm:text-[1.72rem]">
                  {title}
                </h1>

                {description ? (
                  <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--app-text-soft)]">
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
                          className={`h-2 rounded-full transition-all ${
                            index + 1 <= safeStep
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

              <div className="mt-5">{children}</div>

              {helperText ? (
                <p className="mt-4 rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2 text-[11px] font-bold leading-5 text-[color:var(--app-text-soft)]">
                  {helperText}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
