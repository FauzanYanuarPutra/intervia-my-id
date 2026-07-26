'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, Home, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import LajukanLogo, { LajukanLogoMark } from '@/components/logo/LajuloLogo';
import { cn } from '@/lib/utils';
import styles from './AuthFlowShell.module.css';

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
  const homeLabel = isId ? 'Kembali ke beranda' : 'Back to home';
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
    <main
      className={cn(
        'min-h-svh overflow-x-hidden bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]',
        styles.authFlow,
      )}
    >
      <section className="mx-auto grid min-h-svh w-full max-w-[1180px] grid-rows-[auto_1fr] px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <header className="flex items-center justify-between gap-3">
          <Link
            href="/home"
            className="inline-flex min-w-0 items-center rounded-lg py-1 transition hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--app-accent)]"
            aria-label={homeLabel}
          >
            <span className="inline-flex">
              <LajukanLogo />
            </span>
          </Link>
          <Link
            href="/home"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface)] text-[color:var(--app-text-soft)] shadow-sm transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--app-accent)]"
            aria-label={homeLabel}
            title={homeLabel}
          >
            <Home className="h-[18px] w-[18px]" />
          </Link>
        </header>

        <div
          className={cn(
            'grid min-h-0 content-start gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:content-center lg:gap-10',
            styles.contentGrid,
          )}
        >
          <aside
            className={cn(
              'relative hidden min-h-[560px] overflow-hidden rounded-lg bg-[#102018] p-8 text-white shadow-[0_30px_80px_-44px_rgba(15,32,24,0.62)] lg:flex lg:flex-col lg:justify-between',
              styles.heroPanel,
            )}
          >
            <LajukanLogoMark className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 text-[#183b28] opacity-70" />

            <div className="relative max-w-xl">
              <span className="inline-flex items-center gap-2 text-xs font-bold text-[#80e3a5]">
                <Sparkles className="h-4 w-4" />
                {isId ? 'Ruang kerja Lajukan' : 'Lajukan workspace'}
              </span>
              <h2
                className={cn(
                  'mt-7 max-w-xl text-[2.65rem] font-bold leading-[1.08] text-white',
                  styles.heroTitle,
                )}
              >
                {isId
                  ? 'Semua aktivitas bisnismu, tersimpan rapi.'
                  : 'Keep your business activity organized.'}
              </h2>
              <p className="mt-5 max-w-lg text-base font-medium leading-7 text-white/70">
                {isId
                  ? 'Profil, chat, kebutuhan usaha, dan AI Studio tetap terhubung lewat satu akun Lajukan.'
                  : 'Your profile, chats, business needs, and AI Studio stay connected through one Lajukan account.'}
              </p>
            </div>

            <div className="relative border-t border-white/15">
              {defaultHighlights.slice(0, 3).map((item, index) => (
                <div
                  key={`${item.title}-${item.description}`}
                  className={cn(
                    'flex items-start gap-3.5 py-4',
                    index > 0 && 'border-t border-white/10',
                    styles.highlightRow,
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1d4a30] text-[#80e3a5]">
                    <CheckCircle2 className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-white">
                      {item.title}
                    </span>
                    <span className="mt-1 block max-w-lg text-xs font-medium leading-5 text-white/65">
                      {item.description}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </aside>

          <div className="mx-auto flex w-full max-w-[440px] flex-col justify-center">
            <div
              className={cn(
                'rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 shadow-[0_26px_70px_-44px_rgba(15,23,42,0.34)] sm:p-7',
                styles.formPanel,
              )}
            >
              <div>
                {badge ? (
                  <span className="mb-3 flex w-fit items-center gap-2 rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1.5 text-xs font-bold text-[color:var(--app-accent)]">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    {badge}
                  </span>
                ) : null}
                <h1
                  className={cn(
                    'text-[1.7rem] font-bold leading-tight text-[color:var(--app-text)] sm:text-[1.9rem]',
                    styles.formTitle,
                  )}
                >
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
                    <div
                      className="flex items-center gap-1.5"
                      aria-label={progressLabel}
                    >
                      {Array.from({ length: safeTotalSteps }).map(
                        (_, index) => (
                          <span
                            key={index}
                            className={`h-2 rounded-full transition-all ${
                              index + 1 <= safeStep
                                ? 'w-6 bg-[color:var(--app-accent)]'
                                : 'w-2 bg-[color:var(--app-surface-muted)]'
                            }`}
                          />
                        ),
                      )}
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
                <div className="mt-5 flex items-start gap-2.5 border-t border-[color:var(--app-border)] pt-4 text-xs font-semibold leading-5 text-[color:var(--app-text-soft)]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                  <p className="min-w-0 flex-1">{helperText}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
