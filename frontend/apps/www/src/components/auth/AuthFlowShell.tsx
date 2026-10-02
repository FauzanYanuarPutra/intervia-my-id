'use client';

import type { ReactNode } from 'react';
import {
  CheckCircle2,
  Home,
  ShieldCheck,
} from 'lucide-react';

import { Link } from '@/i18n/navigation';
import LajukanLogo from '@/components/logo/LajuloLogo';
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

  const hasProgress = Boolean(
    currentStep &&
      totalSteps &&
      totalSteps > 1,
  );

  const safeStep =
    hasProgress && totalSteps
      ? Math.min(
          Math.max(currentStep ?? 1, 1),
          totalSteps,
        )
      : 0;

  const safeTotalSteps = totalSteps ?? 1;

  const progressValue =
    hasProgress && totalSteps
      ? Math.max(
          (safeStep / totalSteps) * 100,
          16,
        )
      : 0;

  const homeLabel = isId ? 'Kembali ke beranda' : 'Back to home';

  const defaultHighlights: AuthFlowHighlight[] =
    highlights.length > 0
      ? highlights
      : [
          {
            title: isId ? 'Masuk lebih cepat' : 'Sign in faster',
            description: isId
              ? 'Gunakan akun Google untuk mengakses akunmu.'
              : 'Use Google to access your account.',
          },
          {
            title: isId ? 'Aktivitas tetap tersimpan' : 'Activity stays saved',
            description: isId
              ? 'Profil, chat, dan aktivitas usaha tetap terhubung.'
              : 'Your profile, chats, and business activity stay connected.',
          },
          {
            title: isId ? 'Satu akun Lajukan' : 'One Lajukan account',
            description: isId
              ? 'Gunakan satu akun untuk fitur Lajukan yang kamu pakai.'
              : 'Use one account across the Lajukan features you use.',
          },
        ];

  const stepText = isId
    ? `Langkah ${safeStep} dari ${safeTotalSteps}`
    : `Step ${safeStep} of ${safeTotalSteps}`;

  return (
    <main
      className={cn(
        'min-h-svh overflow-x-hidden',
        'bg-[color:var(--app-surface-muted)]',
        'text-[color:var(--app-text)]',
        styles.authFlow,
      )}
    >
      <section
        className={cn(
          'mx-auto flex min-h-svh w-full max-w-[560px] flex-col',
          'px-4 py-4 sm:px-6 sm:py-6',
        )}
      >
        <header className="flex min-h-11 items-center justify-between gap-3">
          <Link
            href="/home"
            aria-label={homeLabel}
            className={cn(
              'inline-flex min-w-0 items-center rounded-lg py-1',
              'transition hover:opacity-85',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4',
              'focus-visible:outline-[color:var(--app-accent)]',
            )}
          >
            <LajukanLogo />
          </Link>

          <Link
            href="/home"
            aria-label={homeLabel}
            title={homeLabel}
            className={cn(
              'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl',
              'border border-[color:var(--app-border)] bg-[color:var(--app-surface)]',
              'px-3 text-[color:var(--app-text-soft)] shadow-sm transition',
              'hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)]',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
              'focus-visible:outline-[color:var(--app-accent)]',
            )}
          >
            <Home className="h-[17px] w-[17px]" />
            <span className="hidden text-xs font-bold sm:inline">
              {isId ? 'Beranda' : 'Home'}
            </span>
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center py-6 sm:py-10">
          <div className="w-full">
            <div
              className={cn(
                'rounded-3xl border border-[color:var(--app-border)]',
                'bg-[color:var(--app-surface-strong)]',
                'p-5 shadow-[0_26px_70px_-44px_rgba(15,23,42,0.34)]',
                'sm:p-7',
                styles.formPanel,
              )}
            >
              <div>
                {badge ? (
                  <span
                    className={cn(
                      'mb-3 inline-flex w-fit items-center gap-2 rounded-full',
                      'bg-[color:var(--app-accent-soft)] px-3 py-1.5',
                      'text-xs font-bold text-[color:var(--app-accent)]',
                    )}
                  >
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    {badge}
                  </span>
                ) : null}

                <h1
                  className={cn(
                    'text-[1.7rem] font-bold leading-[1.18] tracking-[-0.02em]',
                    'text-[color:var(--app-text)] sm:text-[1.95rem]',
                    styles.formTitle,
                  )}
                >
                  {title}
                </h1>

                {description ? (
                  <p
                    className={cn(
                      'mt-2 max-w-md text-[13px] font-medium leading-5',
                      'text-[color:var(--app-text-soft)] sm:text-sm sm:leading-6',
                    )}
                  >
                    {description}
                  </p>
                ) : null}
              </div>

              {hasProgress ? (
                <div
                  className={cn(
                    'mt-5 rounded-xl bg-[color:var(--app-surface-muted)] p-3',
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-bold text-[color:var(--app-text-soft)]">
                      {progressLabel || stepText}
                    </span>
                    <span className="shrink-0 text-[11px] font-black text-[color:var(--app-accent)]">
                      {Math.round(progressValue)}%
                    </span>
                  </div>
                  <div
                    className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--app-border)]"
                    role="progressbar"
                    aria-valuemin={1}
                    aria-valuemax={safeTotalSteps}
                    aria-valuenow={safeStep}
                    aria-label={progressLabel || stepText}
                  >
                    <div
                      className="h-full rounded-full bg-[color:var(--app-accent)] transition-[width] duration-300 ease-out"
                      style={{ width: `${progressValue}%` }}
                    />
                  </div>
                </div>
              ) : null}

              <div className="mt-5">{children}</div>

              {defaultHighlights.length > 0 ? (
                <div className="mt-5 grid gap-2">
                  {defaultHighlights.slice(0, 3).map(item => (
                    <div
                      key={`${item.title}-${item.description}`}
                      className="flex items-start gap-2.5 rounded-2xl bg-[color:var(--app-surface-muted)] px-3 py-2.5"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[color:var(--app-text)]">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-[11px] font-medium leading-4 text-[color:var(--app-text-soft)]">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {helperText ? (
                <div
                  className={cn(
                    'mt-5 flex items-start gap-2.5 border-t border-[color:var(--app-border)]',
                    'pt-4 text-xs font-medium leading-5 text-[color:var(--app-text-soft)]',
                  )}
                >
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                  <p className="min-w-0 flex-1">{helperText}</p>
                </div>
              ) : null}
            </div>

            <p className="mx-auto mt-4 max-w-[500px] px-2 text-center text-[10px] font-medium leading-4 text-[color:var(--app-text-soft)] sm:text-[11px]">
              {isId
                ? 'Gunakan hanya akun Google milikmu sendiri saat masuk ke Lajukan.'
                : 'Use only your own Google account when signing in to Lajukan.'}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
