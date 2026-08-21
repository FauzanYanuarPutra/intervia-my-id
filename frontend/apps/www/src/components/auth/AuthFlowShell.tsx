'use client';

import type { ReactNode } from 'react';
import {
  CheckCircle2,
  Home,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { Link } from '@/i18n/navigation';
import LajukanLogo, {
  LajukanLogoMark,
} from '@/components/logo/LajuloLogo';
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

  const homeLabel = isId
    ? 'Kembali ke beranda'
    : 'Back to home';

  const defaultHighlights: AuthFlowHighlight[] =
    highlights.length > 0
      ? highlights
      : [
          {
            title: isId
              ? 'Masuk lebih cepat'
              : 'Sign in faster',
            description: isId
              ? 'Gunakan Google, email, atau nomor HP untuk mengakses akunmu.'
              : 'Use Google, email, or your phone number to access your account.',
          },
          {
            title: isId
              ? 'Aktivitas tetap tersimpan'
              : 'Your activity stays saved',
            description: isId
              ? 'Profil, chat, kebutuhan usaha, dan aktivitasmu tetap terhubung.'
              : 'Your profile, chats, business needs, and activity stay connected.',
          },
          {
            title: isId
              ? 'Satu akun untuk semuanya'
              : 'One account for everything',
            description: isId
              ? 'Cari produk, supplier, jasa, peluang usaha, dan gunakan fitur Lajukan dari satu akun.'
              : 'Find products, suppliers, services, opportunities, and use Lajukan features from one account.',
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
          'mx-auto grid min-h-svh w-full',
          'max-w-[1180px]',
          'grid-rows-[auto_1fr]',
          'px-4 py-4',
          'sm:px-6',
          'lg:px-8 lg:py-6',
        )}
      >
        {/* =========================================================
            HEADER
        ========================================================== */}
        <header className="flex min-h-11 items-center justify-between gap-3">
          <Link
            href="/home"
            aria-label={homeLabel}
            className={cn(
              'inline-flex min-w-0 items-center',
              'rounded-lg py-1',
              'transition hover:opacity-85',
              'focus-visible:outline',
              'focus-visible:outline-2',
              'focus-visible:outline-offset-4',
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
              'group inline-flex h-10 shrink-0 items-center justify-center',
              'gap-2 rounded-xl',
              'border border-[color:var(--app-border)]',
              'bg-[color:var(--app-surface)]',
              'px-2.5',
              'text-[color:var(--app-text-soft)]',
              'shadow-sm transition',
              'hover:border-[color:var(--app-accent-border)]',
              'hover:text-[color:var(--app-accent)]',
              'focus-visible:outline',
              'focus-visible:outline-2',
              'focus-visible:outline-offset-2',
              'focus-visible:outline-[color:var(--app-accent)]',
              'sm:px-3',
            )}
          >
            <Home className="h-[17px] w-[17px]" />

            <span className="hidden text-xs font-bold sm:inline">
              {isId ? 'Beranda' : 'Home'}
            </span>
          </Link>
        </header>

        {/* =========================================================
            CONTENT
        ========================================================== */}
        <div
          className={cn(
            'grid min-h-0 content-start gap-5',
            'py-5 sm:py-7',
            'lg:grid-cols-[minmax(0,1fr)_440px]',
            'lg:content-center lg:gap-10',
            styles.contentGrid,
          )}
        >
          {/* =======================================================
              LEFT INFORMATION PANEL
              Desktop only.
          ======================================================== */}
          <aside
            className={cn(
              'relative hidden min-h-[560px] overflow-hidden',
              'rounded-2xl',
              'bg-[#102018]',
              'p-8 text-white',
              'shadow-[0_30px_80px_-44px_rgba(15,32,24,0.62)]',
              'lg:flex lg:flex-col lg:justify-between',
              styles.heroPanel,
            )}
          >
            {/* Decorative logo */}
            <LajukanLogoMark
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute',
                '-right-16 -top-16',
                'h-64 w-64',
                'text-[#183b28]',
                'opacity-60',
              )}
            />

            {/* Main copy */}
            <div className="relative max-w-xl">
              <div
                className={cn(
                  'inline-flex items-center gap-2',
                  'rounded-full',
                  'bg-white/[0.06]',
                  'px-3 py-1.5',
                  'text-xs font-bold text-[#80e3a5]',
                )}
              >
                <Sparkles className="h-4 w-4" />

                {isId
                  ? 'Satu akun Lajukan'
                  : 'One Lajukan account'}
              </div>

              <h2
                className={cn(
                  'mt-6 max-w-[520px]',
                  'text-[2.5rem] font-bold',
                  'leading-[1.08]',
                  'tracking-[-0.025em]',
                  'text-white',
                  styles.heroTitle,
                )}
              >
                {isId
                  ? 'Semua kebutuhan usahamu dalam satu akun.'
                  : 'Everything your business needs in one account.'}
              </h2>

              <p
                className={cn(
                  'mt-4 max-w-[520px]',
                  'text-[15px] font-medium',
                  'leading-7 text-white/70',
                )}
              >
                {isId
                  ? 'Masuk sekali untuk mengakses profil, chat, supplier, jasa, peluang usaha, dan fitur Lajukan lainnya.'
                  : 'Sign in once to access your profile, chats, suppliers, services, opportunities, and other Lajukan features.'}
              </p>
            </div>

            {/* Benefits */}
            <div className="relative mt-8 border-t border-white/15">
              {defaultHighlights
                .slice(0, 3)
                .map((item, index) => (
                  <div
                    key={`${item.title}-${item.description}`}
                    className={cn(
                      'flex items-start gap-3.5 py-4',
                      index > 0 &&
                        'border-t border-white/10',
                      styles.highlightRow,
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0',
                        'items-center justify-center',
                        'rounded-xl',
                        'bg-[#1d4a30]',
                        'text-[#80e3a5]',
                      )}
                    >
                      <CheckCircle2 className="h-[18px] w-[18px]" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-white">
                        {item.title}
                      </span>

                      <span
                        className={cn(
                          'mt-1 block max-w-lg',
                          'text-xs font-medium',
                          'leading-5 text-white/65',
                        )}
                      >
                        {item.description}
                      </span>
                    </span>
                  </div>
                ))}
            </div>
          </aside>

          {/* =======================================================
              AUTH FORM
          ======================================================== */}
          <div
            className={cn(
              'mx-auto flex w-full',
              'max-w-[440px]',
              'flex-col justify-center',
            )}
          >
            {/* Mobile introduction */}
            <div className="mb-5 lg:hidden">
              <p
                className={cn(
                  'text-[11px] font-bold',
                  'uppercase tracking-[0.08em]',
                  'text-[color:var(--app-accent)]',
                )}
              >
                {isId
                  ? 'Akun Lajukan'
                  : 'Lajukan account'}
              </p>

              <p
                className={cn(
                  'mt-1 max-w-md',
                  'text-xs font-medium leading-5',
                  'text-[color:var(--app-text-soft)]',
                )}
              >
                {isId
                  ? 'Masuk untuk melanjutkan aktivitasmu di Lajukan.'
                  : 'Sign in to continue your activity on Lajukan.'}
              </p>
            </div>

            <div
              className={cn(
                'rounded-2xl',
                'border border-[color:var(--app-border)]',
                'bg-[color:var(--app-surface-strong)]',
                'p-5',
                'shadow-[0_26px_70px_-44px_rgba(15,23,42,0.34)]',
                'sm:p-7',
                styles.formPanel,
              )}
            >
              {/* Heading */}
              <div>
                {badge ? (
                  <span
                    className={cn(
                      'mb-3 inline-flex w-fit',
                      'items-center gap-2',
                      'rounded-full',
                      'bg-[color:var(--app-accent-soft)]',
                      'px-3 py-1.5',
                      'text-xs font-bold',
                      'text-[color:var(--app-accent)]',
                    )}
                  >
                    <ShieldCheck className="h-4 w-4 shrink-0" />

                    {badge}
                  </span>
                ) : null}

                <h1
                  className={cn(
                    'text-[1.65rem] font-bold',
                    'leading-[1.2]',
                    'tracking-[-0.02em]',
                    'text-[color:var(--app-text)]',
                    'sm:text-[1.9rem]',
                    styles.formTitle,
                  )}
                >
                  {title}
                </h1>

                {description ? (
                  <p
                    className={cn(
                      'mt-2 max-w-md',
                      'text-[13px] font-medium',
                      'leading-5',
                      'text-[color:var(--app-text-soft)]',
                      'sm:text-sm sm:leading-6',
                    )}
                  >
                    {description}
                  </p>
                ) : null}
              </div>

              {/* ===================================================
                  PROGRESS
              ==================================================== */}
              {hasProgress ? (
                <div
                  className={cn(
                    'mt-5 rounded-xl',
                    'bg-[color:var(--app-surface-muted)]',
                    'p-3',
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={cn(
                        'text-[11px] font-bold',
                        'text-[color:var(--app-text-soft)]',
                      )}
                    >
                      {progressLabel || stepText}
                    </span>

                    <span
                      className={cn(
                        'shrink-0 text-[11px] font-black',
                        'text-[color:var(--app-accent)]',
                      )}
                    >
                      {Math.round(progressValue)}%
                    </span>
                  </div>

                  <div
                    className={cn(
                      'mt-2 h-1.5 w-full',
                      'overflow-hidden rounded-full',
                      'bg-[color:var(--app-border)]',
                    )}
                    role="progressbar"
                    aria-valuemin={1}
                    aria-valuemax={safeTotalSteps}
                    aria-valuenow={safeStep}
                    aria-label={
                      progressLabel || stepText
                    }
                  >
                    <div
                      className={cn(
                        'h-full rounded-full',
                        'bg-[color:var(--app-accent)]',
                        'transition-[width]',
                        'duration-300 ease-out',
                      )}
                      style={{
                        width: `${progressValue}%`,
                      }}
                    />
                  </div>
                </div>
              ) : null}

              {/* ===================================================
                  FORM CONTENT
              ==================================================== */}
              <div className="mt-5">
                {children}
              </div>

              {/* ===================================================
                  HELPER
              ==================================================== */}
              {helperText ? (
                <div
                  className={cn(
                    'mt-5 flex items-start gap-2.5',
                    'border-t border-[color:var(--app-border)]',
                    'pt-4',
                    'text-xs font-medium',
                    'leading-5',
                    'text-[color:var(--app-text-soft)]',
                  )}
                >
                  <CheckCircle2
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0',
                      'text-[color:var(--app-accent)]',
                    )}
                  />

                  <p className="min-w-0 flex-1">
                    {helperText}
                  </p>
                </div>
              ) : null}
            </div>

            {/* Mobile trust note */}
            <div
              className={cn(
                'mt-4 flex items-center justify-center gap-1.5',
                'text-center text-[10px] font-medium',
                'leading-4',
                'text-[color:var(--app-text-soft)]',
                'sm:text-[11px]',
              )}
            >
              <ShieldCheck
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0"
              />

              <span>
                {isId
                  ? 'Akunmu digunakan untuk menjaga aktivitas Lajukan tetap terhubung.'
                  : 'Your account keeps your Lajukan activity connected.'}
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}