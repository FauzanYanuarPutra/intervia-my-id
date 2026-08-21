'use client';

import { useAuth } from '@/context/AuthContext';
import { Link } from '@/i18n/navigation';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';
import { cn } from '@/lib/utils';
import { ArrowUpRight, Loader2, Plus, ReceiptText, Wallet } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

type WalletAccount = {
  id: string;
  environment: 'development' | 'live';
  currency: string;
  available_balance_cents: number;
  held_balance_cents: number;
  total_balance_cents: number;
  total_topup_cents: number;
  total_spend_cents: number;
  status: string;
  updated_at: string;
};

type WalletBalancesResponse = {
  accounts: WalletAccount[];
  default_environment: 'development' | 'live';
  live_enabled: boolean;
};

type WalletTopupLite = {
  id: string;
  amount_cents: number;
  currency: string;
  payment_method?: string | null;
  status: string;
  created_at: string;
};

type WalletTopupListResponse = {
  items?: WalletTopupLite[];
};

type HomeWalletQuickPanelProps = {
  locale: string;
  className?: string;
};

function formatMoney(
  cents: number | undefined,
  currency?: string | null,
): string {
  const curr = (currency || 'IDR').toUpperCase();
  const amount = Number(cents || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: curr === 'IDR' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${curr} ${amount.toLocaleString()}`;
  }
}

function normalizeEnvironment(value: unknown): 'development' | 'live' {
  return String(value || '')
    .trim()
    .toLowerCase() === 'live'
    ? 'live'
    : 'development';
}

function pickDefaultAccount(
  payload: WalletBalancesResponse | null,
): WalletAccount | null {
  if (!payload?.accounts?.length) return null;
  const defaultEnvironment = normalizeEnvironment(payload.default_environment);
  return (
    payload.accounts.find(
      account =>
        normalizeEnvironment(account.environment) === defaultEnvironment,
    ) ||
    payload.accounts.find(
      account => normalizeEnvironment(account.environment) === 'development',
    ) ||
    payload.accounts[0] ||
    null
  );
}

function formatTopupStatus(status: string, isId: boolean): string {
  const normalized = String(status || '')
    .trim()
    .toLowerCase();
  if (normalized === 'paid') return isId ? 'Berhasil' : 'Paid';
  if (normalized === 'pending') return isId ? 'Menunggu' : 'Pending';
  if (normalized === 'failed') return isId ? 'Gagal' : 'Failed';
  if (normalized === 'cancelled') return isId ? 'Batal' : 'Cancelled';
  if (normalized === 'expired') return isId ? 'Kedaluwarsa' : 'Expired';
  return normalized || (isId ? 'Belum ada' : 'No data');
}

function topupStatusTone(status: string): string {
  const normalized = String(status || '')
    .trim()
    .toLowerCase();

  if (normalized === 'paid') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200';
  }

  if (normalized === 'pending') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200';
  }

  if (
    normalized === 'failed' ||
    normalized === 'cancelled' ||
    normalized === 'expired'
  ) {
    return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200';
}

function WalletMiniAction({
  href,
  label,
  icon,
  primary = false,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'ui-pressable ui-pressable-card flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] px-2 py-1.5 text-center text-[10px] font-semibold transition sm:min-h-[60px] sm:min-w-[68px]',
        primary
          ? 'border border-[color:var(--app-accent-border)] bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] text-white shadow-[0_18px_34px_-24px_color-mix(in_srgb,var(--app-accent)_46%,transparent)] hover:brightness-105'
          : 'bg-white text-slate-700 shadow-[0_12px_22px_-24px_rgba(15,23,42,0.14)] hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_24%,white)] hover:text-[color:var(--app-accent)] dark:bg-slate-950/88 dark:text-slate-100 dark:hover:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_20%,rgba(15,23,42,0.98))]',
      )}
    >
      <span
        className={cn(
          'inline-flex h-[30px] w-[30px] items-center justify-center rounded-full sm:h-[34px] sm:w-[34px]',
          primary
            ? 'bg-white/16 text-white'
            : 'bg-[color:color-mix(in_srgb,var(--app-accent-soft)_34%,white)] text-[color:var(--app-accent)] shadow-[0_12px_20px_-18px_rgba(15,23,42,0.3)] dark:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_24%,rgba(15,23,42,0.98))]',
        )}
      >
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}

export function HomeWalletQuickPanel({
  locale,
  className,
}: HomeWalletQuickPanelProps) {
  const isId = locale === 'id';
  const { user, loading: authLoading, authFetch } = useAuth();

  const [balances, setBalances] = useState<WalletBalancesResponse | null>(null);
  const [latestTopup, setLatestTopup] = useState<WalletTopupLite | null>(null);
  const [loading, setLoading] = useState(!PROMO_ONLY_MODE);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (PROMO_ONLY_MODE) {
      setBalances(null);
      setLatestTopup(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadWalletSummary() {
      if (authLoading) return;

      if (!user) {
        if (!cancelled) {
          setBalances(null);
          setLatestTopup(null);
          setError(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [balanceRes, topupRes] = await Promise.all([
          authFetch('/api/wallet/balance', { cache: 'no-store' }),
          authFetch('/api/wallet/topups?limit=1&offset=0', {
            cache: 'no-store',
          }),
        ]);

        const balancePayload = (await balanceRes
          .json()
          .catch(() => ({}))) as WalletBalancesResponse & { error?: string };

        const topupPayload = (await topupRes
          .json()
          .catch(() => ({}))) as WalletTopupListResponse & { error?: string };

        if (!cancelled) {
          if (!balanceRes.ok) {
            setError(
              balancePayload.error ||
              (isId ? 'Wallet belum siap.' : 'Wallet is unavailable.'),
            );
            setBalances(null);
          } else {
            setBalances(balancePayload);
          }

          setLatestTopup(
            Array.isArray(topupPayload.items) && topupPayload.items.length > 0
              ? topupPayload.items[0]
              : null,
          );
        }
      } catch {
        if (!cancelled) {
          setError(isId ? 'Wallet belum siap.' : 'Wallet is unavailable.');
          setBalances(null);
          setLatestTopup(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadWalletSummary();

    return () => {
      cancelled = true;
    };
  }, [authFetch, authLoading, isId, user]);

  const account = useMemo(() => pickDefaultAccount(balances), [balances]);

  if (PROMO_ONLY_MODE) return null;

  if (authLoading || loading) {
    return (
      <section
        className={cn(
          'ui-page-section ui-home-section-shell',
          className,
        )}
      >
        <article className="ui-home-section-content overflow-hidden rounded-[22px] bg-white px-3 py-2.5 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.12)] dark:bg-slate-950 sm:rounded-[24px] sm:px-3.5 sm:py-3">
          <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <div className="ui-skeleton ui-skeleton-pulse h-10 w-10 rounded-2xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="ui-skeleton ui-skeleton-pulse h-3 w-16 rounded-full" />
                <div className="ui-skeleton ui-skeleton-pulse h-6 w-32 rounded-full" />
                <div className="ui-skeleton ui-skeleton-pulse h-3 w-24 rounded-full" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5 md:min-w-[214px]">
              <div className="ui-skeleton ui-skeleton-pulse h-[58px] rounded-[18px]" />
              <div className="ui-skeleton ui-skeleton-pulse h-[58px] rounded-[18px]" />
              <div className="ui-skeleton ui-skeleton-pulse h-[58px] rounded-[18px]" />
            </div>
          </div>
        </article>
      </section>
    );
  }

  if (!user) {
    return (
      <section
        className={cn(
          'ui-page-section ui-home-section-shell',
          className,
        )}
      >
        <article className="ui-home-section-content overflow-hidden rounded-[22px] bg-white px-3 py-2.5 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.12)] dark:bg-slate-950 sm:rounded-[24px] sm:px-3.5 sm:py-3">
          <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_40%,white)] text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_24%,rgba(15,23,42,0.98))]">
                <Wallet className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--app-accent)] dark:text-[color:var(--app-accent)]">
                  Wallet
                </p>
                <p className="mt-0.5 truncate text-[15px] font-bold text-[color:var(--app-text)] sm:text-[16px]">
                  {isId ? 'Masuk dulu' : 'Sign in first'}
                </p>
                <p className="text-[11px] text-[color:var(--app-text-soft)]">
                  {isId ? 'Bayar & riwayat.' : 'Pay and history.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 md:min-w-[214px]">
              <WalletMiniAction
                href="/login"
                label={isId ? 'Masuk' : 'Sign in'}
                icon={<ArrowUpRight className="h-4 w-4" />}
                primary
              />
              <WalletMiniAction
                href="/register"
                label={isId ? 'Daftar' : 'Register'}
                icon={<Plus className="h-4 w-4" />}
              />
              <WalletMiniAction
                href="/payments"
                label={isId ? 'Bayar' : 'Pay'}
                icon={<Wallet className="h-4 w-4" />}
              />
            </div>
          </div>
        </article>
      </section>
    );
  }

  const balanceLabel = formatMoney(
    account?.available_balance_cents,
    account?.currency || balances?.accounts?.[0]?.currency || 'IDR',
  );
  const statusLabel = latestTopup
    ? formatTopupStatus(latestTopup.status, isId)
    : account?.environment === 'live'
      ? 'Live'
      : 'Dev';

  return (
    <section
      className={cn('ui-page-section ui-home-section-shell', className)}
    >
      <article className="ui-home-section-content overflow-hidden rounded-[22px] bg-white px-3 py-2.5 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.12)] dark:bg-slate-950 sm:rounded-[24px] sm:px-3.5 sm:py-3">
        <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_40%,white)] text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_24%,rgba(15,23,42,0.98))]">
              <Wallet className="h-5 w-5" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--app-accent)] dark:text-[color:var(--app-accent)]">
                  Wallet
                </p>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold',
                    latestTopup
                      ? topupStatusTone(latestTopup.status)
                      : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200',
                  )}
                >
                  {statusLabel}
                </span>
              </div>

              <p className="mt-0.5 truncate text-[17px] font-bold tracking-tight text-[color:var(--app-text)] sm:text-[19px]">
                {balanceLabel}
              </p>

              <p className="flex items-center gap-1 text-[11px] text-[color:var(--app-text-soft)]">
                {latestTopup?.status === 'pending' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                ) : null}
                <span>
                  {latestTopup
                    ? isId
                      ? 'Top up terakhir'
                      : 'Latest top-up'
                    : isId
                      ? 'Siap dipakai'
                      : 'Ready to use'}
                </span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 md:min-w-[214px]">
            <WalletMiniAction
              href="/payments"
              label={isId ? 'Bayar' : 'Pay'}
              icon={<ArrowUpRight className="h-4 w-4" />}
              primary
            />
            <WalletMiniAction
              href="/transactions"
              label={isId ? 'Riwayat' : 'History'}
              icon={<ReceiptText className="h-4 w-4" />}
            />
            <WalletMiniAction
              href="/payments"
              label={isId ? 'Top up' : 'Top up'}
              icon={<Plus className="h-4 w-4" />}
            />
          </div>
        </div>

        {error ? (
          <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-300">
            {error}
          </p>
        ) : null}
      </article>
    </section>
  );
}
