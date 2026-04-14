'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Loader2, ReceiptText, ShieldCheck, Wallet } from 'lucide-react';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { useAuth } from '@/context/AuthContext';

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

function normalizeEnvironment(value: unknown): 'development' | 'live' {
  return String(value || '').trim().toLowerCase() === 'live'
    ? 'live'
    : 'development';
}

function pickDefaultAccount(payload: WalletBalancesResponse | null): WalletAccount | null {
  if (!payload?.accounts?.length) return null;
  const defaultEnvironment = normalizeEnvironment(payload.default_environment);
  return (
    payload.accounts.find(
      (account) => normalizeEnvironment(account.environment) === defaultEnvironment,
    ) ||
    payload.accounts.find(
      (account) => normalizeEnvironment(account.environment) === 'development',
    ) ||
    payload.accounts[0] ||
    null
  );
}

function formatMoney(cents: number | undefined, currency?: string | null): string {
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

type WalletHeaderShortcutProps = {
  locale: 'id' | 'en';
  variant?: 'desktop' | 'drawer';
  onNavigate?: () => void;
};

export function WalletHeaderShortcut({
  locale,
  variant = 'desktop',
  onNavigate,
}: WalletHeaderShortcutProps) {
  const isId = locale === 'id';
  const { user, authFetch } = useAuth();
  const [balances, setBalances] = useState<WalletBalancesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadBalance() {
      if (!user) {
        if (active) {
          setBalances(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const res = await authFetch('/api/wallet/balance', { cache: 'no-store' });
        const payload = (await res.json().catch(() => ({}))) as WalletBalancesResponse;
        if (!active) return;
        if (!res.ok) {
          setBalances(null);
          return;
        }
        setBalances(payload);
      } catch {
        if (active) setBalances(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadBalance();
    return () => {
      active = false;
    };
  }, [authFetch, user]);

  const account = useMemo(() => pickDefaultAccount(balances), [balances]);
  const amountLabel = account
    ? formatMoney(account.available_balance_cents, account.currency)
    : isId
      ? 'Buka pembayaran'
      : 'Open payments';
  const envLabel = account?.environment === 'live'
    ? isId
      ? 'Live'
      : 'Live'
    : isId
      ? 'Dev'
      : 'Dev';

  if (!user) return null;

  if (variant === 'drawer') {
    return (
      <div className="ui-panel ui-hero-panel rounded-[24px] p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
              {isId ? 'Saldo & pembayaran' : 'Balance and payments'}
            </p>
            <p className="mt-2 text-xl font-black text-[color:var(--app-text)]">
              {loading ? (isId ? 'Memuat saldo...' : 'Loading balance...') : amountLabel}
            </p>
            <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
              {isId
                ? 'Top up, saldo tertahan, dan riwayat dana ada di satu tempat.'
                : 'Top-ups, held balance, and fund history stay in one place.'}
            </p>
          </div>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-5 w-5" />}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--app-accent)]">
            <ShieldCheck className="h-3.5 w-3.5" />
            {isId ? `Mode saldo: ${envLabel}` : `Wallet mode: ${envLabel}`}
          </span>
        </div>

        <div className="mt-3 grid gap-2">
          <Link
            href="/payments"
            onClick={onNavigate}
            className="inline-flex min-h-[44px] items-center justify-between rounded-2xl bg-[color:var(--app-accent-strong)] px-3 text-sm font-semibold text-[color:var(--app-text-inverse)]"
          >
            <span className="inline-flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              {isId ? 'Buka saldo & top up' : 'Open balance and top-up'}
            </span>
            <ArrowUpRight className="h-4 w-4" />
          </Link>
          <Link
            href="/transactions"
            onClick={onNavigate}
            className="inline-flex min-h-[44px] items-center justify-between rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm font-semibold text-[color:var(--app-text)]"
          >
            <span className="inline-flex items-center gap-2">
              <ReceiptText className="h-4 w-4" />
              {isId ? 'Buka transaksi' : 'Open transactions'}
            </span>
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <Link
      href="/payments"
      onClick={onNavigate}
      className="inline-flex min-h-[42px] items-center gap-3 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 pr-4 text-sm font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-surface-muted)]"
      aria-label={isId ? 'Buka saldo dan pembayaran' : 'Open balance and payments'}
    >
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
          {isId ? 'Saldo' : 'Balance'}
        </span>
        <span className="mt-1 text-sm font-semibold text-[color:var(--app-text)]">
          {loading ? (isId ? 'Memuat...' : 'Loading...') : amountLabel}
        </span>
      </span>
    </Link>
  );
}
