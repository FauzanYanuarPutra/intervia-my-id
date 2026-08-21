'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Coins,
  Flame,
  Gift,
  LogIn,
  Sparkles,
  TicketPercent,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';
import { cn } from '@/lib/utils';

type RewardBalance = {
  coin_balance: number;
  xp_balance: number;
  voucher_count: number;
};

type DailyReward = {
  streak_day: number;
  coin_amount: number;
  xp_amount: number;
  voucher_code?: string | null;
};

type WeeklyRewardDay = {
  day: number;
  coin_amount: number;
  xp_amount: number;
  voucher: boolean;
  claimed: boolean;
};

type WeeklyRewardProgress = {
  today?: string;
  week_start?: string;
  week_end?: string;
  next_reset_at?: string;
  claimed_dates?: string[];
  claimed_days?: number[];
  days_claimed: number;
  days_remaining: number;
  next_streak_day: number;
  voucher_unlocked: boolean;
  weekly_coin_total: number;
  weekly_xp_total: number;
  schedule: WeeklyRewardDay[];
};

type DailyRewardResponse = {
  claimed?: boolean;
  claimed_today?: boolean;
  can_claim_today?: boolean;
  reward?: DailyReward;
  balance: RewardBalance;
  weekly?: WeeklyRewardProgress;
  payment?: {
    coin_value_cents?: number;
    max_discount_bps?: number;
    max_discount_ratio?: number;
    min_cash_payment_cents?: number;
    currency?: string;
  };
};

type Props = {
  locale: string;
  compact?: boolean;
};

function buildFallbackSchedule(streak: number): WeeklyRewardDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const day = index + 1;
    return {
      day,
      coin_amount: 10 + day * 5,
      xp_amount: 20 + day * 10,
      voucher: day === 7,
      claimed: day <= streak,
    };
  });
}

function formatResetLabel(value: string | undefined, locale: string): string {
  if (!value) return locale === 'id' ? 'mingguan' : 'weekly';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return locale === 'id' ? 'mingguan' : 'weekly';
  }

  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function DailyLoginRewardCard({ locale, compact = false }: Props) {
  const isId = locale === 'id';
  const { user, loading, authFetch } = useAuth();
  const [reward, setReward] = useState<DailyRewardResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'ready' | 'claiming' | 'error'
  >('idle');

  const loadRewardBalance = useCallback(() => {
    if (PROMO_ONLY_MODE) return;
    if (!user) return;
    setStatus('loading');
    setErrorMessage(null);
    authFetch('/api/rewards/balance', { cache: 'no-store' })
      .then(async res => {
        if (!res.ok) throw new Error('balance_failed');
        return (await res.json()) as DailyRewardResponse;
      })
      .then(payload => {
        setReward(payload);
        setErrorMessage(null);
        setStatus('ready');
      })
      .catch(() => {
        setErrorMessage(
          isId
            ? 'Reward belum bisa dicek. Klik claim untuk coba lagi.'
            : 'Reward is unavailable. Claim to retry.',
        );
        setStatus('error');
      });
  }, [authFetch, isId, user]);

  useEffect(() => {
    if (PROMO_ONLY_MODE) return;
    if (loading) return;
    if (!user) return;
    loadRewardBalance();
  }, [loadRewardBalance, loading, user]);

  const handleClaim = async () => {
    if (PROMO_ONLY_MODE) return;
    if (!user || status === 'claiming') return;
    setStatus('claiming');
    setErrorMessage(null);
    try {
      const res = await authFetch('/api/rewards/daily-login/claim', {
        method: 'POST',
        cache: 'no-store',
      });
      const payload = (await res.json().catch(() => ({}))) as
        | DailyRewardResponse
        | { error?: string };
      if (!res.ok) throw new Error('claim_failed');
      setReward(payload as DailyRewardResponse);
      setErrorMessage(null);
      setStatus('ready');
    } catch {
      setErrorMessage(
        isId
          ? 'Claim belum masuk. Coba tekan sekali lagi.'
          : 'Claim did not go through. Try once more.',
      );
      setStatus(reward ? 'ready' : 'error');
    }
  };

  const rewardCardShellClass =
    'lajukan-daily-reward-card relative overflow-hidden rounded-[22px] border border-amber-200/90 bg-amber-50 text-[color:var(--app-text)] shadow-[0_18px_34px_-30px_rgba(15,23,42,0.18)] dark:border-amber-800/70 dark:bg-amber-950/20';

  if (PROMO_ONLY_MODE) return null;

  if (loading) {
    return (
      <section className={cn(rewardCardShellClass, compact ? 'p-3' : 'p-4')}>
        <div className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-amber-200/50 blur-3xl" />
        <div className="flex items-center gap-3">
          <span className="h-11 w-11 shrink-0 animate-pulse rounded-2xl bg-white/80 ring-1 ring-amber-100" />
          <div className="min-w-0 flex-1 space-y-2">
            <span className="block h-4 w-40 animate-pulse rounded-full bg-white/80 ring-1 ring-amber-100" />
            <span className="block h-3 w-56 max-w-full animate-pulse rounded-full bg-white/70 ring-1 ring-amber-100" />
          </div>
        </div>
      </section>
    );
  }

  if (!loading && !user) {
    return (
      <section className={cn(
        rewardCardShellClass,
        "relative overflow-hidden rounded-2xl border border-zinc-200/60 bg-white/80 shadow-sm  dark:border-zinc-800/50 dark:bg-zinc-900/60 transition-all duration-300 hover:shadow-md",
        compact ? 'p-3.5' : 'p-4 sm:p-5'
      )}>
        {/* Ambient Glow - Dibikin lebih smooth */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-amber-300/40 to-yellow-400/10 blur-2xl dark:from-amber-500/20" />

        <div
          className={cn(
            'relative flex items-center gap-3.5',
            compact
              ? 'flex-row flex-wrap sm:flex-nowrap'
              : 'flex-col sm:flex-row text-center sm:text-left'
          )}
        >
          {/* Icon Container - Lebih berdimensi dengan soft shadow */}
          <span
            className={cn(
              'inline-flex shrink-0 items-center justify-center bg-gradient-to-br from-amber-50 to-amber-100/80 text-amber-600 shadow-sm shadow-amber-200/50 dark:from-amber-950/40 dark:to-amber-900/20 dark:text-amber-400 dark:shadow-none ring-1 ring-amber-200/60 dark:ring-amber-500/10 transition-transform duration-300 group-hover:scale-105',
              compact ? 'h-10 w-10 rounded-xl' : 'h-12 w-12 rounded-2xl'
            )}
          >
            <Gift className={compact ? "h-5 w-5" : "h-6 w-6"} />
          </span>

          {/* Text Content */}
          <div className={cn(
            "min-w-0 flex-1",
            !compact && "w-full sm:w-auto"
          )}>
            <p className="text-[14px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
              {isId ? 'Bonus Harian' : 'Daily Bonus'}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400 font-medium">
              {isId
                ? 'Login tiap hari untuk ambil koin, XP, dan voucher mingguan.'
                : 'Log in daily for coins, XP, and a weekly voucher.'}
            </p>
          </div>

          {/* Action Button - Tombol jadi modern, adaptive, dan konsisten */}
          <Link
            href={`/${locale}/login`}
            className={cn(
              'ui-button-primary inline-flex items-center justify-center gap-1.5 font-semibold transition-all duration-200 rounded-xl shadow-sm hover:opacity-90 active:scale-95',
              compact
                ? 'h-9 px-4 text-xs w-full sm:w-auto mt-2 sm:mt-0'
                : 'h-10 px-5 text-xs w-full sm:w-auto mt-4 sm:mt-0'
            )}
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>{isId ? 'Login' : 'Log in'}</span>
          </Link>
        </div>
      </section>
    );
  }

  const weekly = reward?.weekly;
  const streak = weekly?.days_claimed ?? reward?.reward?.streak_day ?? 0;
  const nextStreakDay = weekly?.next_streak_day ?? Math.min(streak + 1, 7);
  const coins = reward?.balance.coin_balance ?? 0;
  const xp = reward?.balance.xp_balance ?? 0;
  const voucherCount = reward?.balance.voucher_count ?? 0;
  const effectiveStatus = user && status === 'idle' ? 'loading' : status;
  const schedule = weekly?.schedule?.length
    ? weekly.schedule
    : buildFallbackSchedule(streak);
  const resetLabel = formatResetLabel(weekly?.next_reset_at, locale);
  const claimedToday =
    reward?.claimed_today ??
    Boolean(
      weekly?.today &&
      weekly.claimed_dates?.some(date => String(date) === weekly.today),
    );
  const canClaimToday = reward?.can_claim_today ?? !claimedToday;
  const claimDay = claimedToday
    ? Math.max(streak, 1)
    : Math.max(nextStreakDay, 1);
  const claimRewardPreview = schedule[Math.min(claimDay, 7) - 1];
  const todayCoin =
    reward?.reward?.coin_amount ?? claimRewardPreview?.coin_amount ?? 0;
  const todayXp =
    reward?.reward?.xp_amount ?? claimRewardPreview?.xp_amount ?? 0;
  const voucherCode = reward?.reward?.voucher_code;
  const coinValueRupiah = Math.round(
    (reward?.payment?.coin_value_cents ?? 10000) / 100,
  );

  return (
    <section
      className={cn(
        rewardCardShellClass,
        compact ? 'lajukan-daily-reward-card-compact' : '',
        compact ? 'p-3' : 'p-4',
      )}
      data-testid="daily-login-reward-card"
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-amber-200/58 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-14 -left-12 h-28 w-28 rounded-full bg-orange-200/42 blur-3xl" />
      <div
        className={cn(
          'relative',
          compact
            ? 'grid gap-2.5'
            : 'flex flex-wrap items-start justify-between gap-3',
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_14px_24px_-18px_rgba(217,119,6,0.78)]',
              claimedToday ? 'bg-amber-600' : 'bg-orange-500',
              compact ? 'h-10 w-10 rounded-[15px]' : '',
            )}
          >
            {claimedToday ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <CalendarCheck className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-bold leading-5 tracking-[-0.02em] text-[color:var(--app-text)]">
              {effectiveStatus === 'loading'
                ? isId
                  ? 'Mengecek reward...'
                  : 'Checking reward...'
                : effectiveStatus === 'claiming'
                  ? isId
                    ? 'Mengambil koin...'
                    : 'Claiming coins...'
                  : claimedToday
                    ? isId
                      ? `Hari ${streak}/7 masuk`
                      : `Day ${streak}/7 claimed`
                    : isId
                      ? `Claim hari ${nextStreakDay}: +${todayCoin} koin`
                      : `Claim day ${nextStreakDay}: +${todayCoin} coins`}
            </p>
            <p
              className={cn(
                'mt-1 flex min-w-0 items-start gap-1.5 text-xs leading-4 text-[color:var(--app-text-soft)]',
                compact ? 'text-[11px]' : '',
              )}
            >
              <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {isId
                ? `1 koin = Rp${coinValueRupiah.toLocaleString('id-ID')}. Reset ${resetLabel}`
                : `1 coin = IDR ${coinValueRupiah.toLocaleString('id-ID')}. Reset ${resetLabel}`}
            </p>
          </div>
        </div>
        <div
          className={cn(
            'grid grid-cols-3',
            compact ? 'gap-1.5' : 'flex-1 gap-2 sm:flex sm:flex-none',
          )}
        >
          <div
            className={cn(
              'rounded-2xl border border-orange-100 bg-white/84 px-3 py-2 text-center text-orange-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]',
              compact ? 'rounded-[14px] px-1.5 py-1.5' : '',
            )}
          >
            <p className="inline-flex items-center justify-center gap-1 text-sm font-bold text-[color:var(--app-text)]">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              {streak}/7
            </p>
            <p className="text-[10px] font-bold uppercase text-orange-700/75">
              streak
            </p>
          </div>
          <div
            className={cn(
              'rounded-2xl border border-amber-100 bg-amber-50/86 px-3 py-2 text-center text-amber-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]',
              compact ? 'rounded-[14px] px-1.5 py-1.5' : '',
            )}
          >
            <p className="inline-flex items-center justify-center gap-1 text-sm font-bold text-[color:var(--app-text)]">
              <Coins className="h-3.5 w-3.5 text-amber-600" />
              {coins}
            </p>
            <p className="text-[10px] font-bold uppercase text-amber-700/75">
              coin
            </p>
          </div>
          <div
            className={cn(
              'rounded-2xl border border-sky-100 bg-white/84 px-3 py-2 text-center text-sky-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]',
              compact ? 'rounded-[14px] px-1.5 py-1.5' : '',
            )}
          >
            <p className="inline-flex items-center justify-center gap-1 text-sm font-bold text-[color:var(--app-text)]">
              {voucherCount > 0 ? (
                <TicketPercent className="h-3.5 w-3.5 text-orange-600" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              )}
              {voucherCount > 0 ? voucherCount : xp}
            </p>
            <p className="text-[10px] font-bold uppercase text-sky-700/75">
              {voucherCount > 0 ? 'voucher' : 'XP'}
            </p>
          </div>
        </div>
      </div>

      <div
        className={cn(
          'relative mt-3 grid grid-cols-7',
          compact ? 'gap-1' : 'gap-1.5',
        )}
      >
        {schedule.map(day => {
          const isNext = !day.claimed && day.day === nextStreakDay;
          return (
            <div
              key={day.day}
              className={cn(
                'min-h-[58px] rounded-[14px] border px-1.5 py-2 text-center transition',
                compact ? 'min-h-[50px] rounded-[12px] px-1 py-1.5' : '',
                day.claimed
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : day.voucher
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-slate-200/80 bg-white/82 text-[color:var(--app-text-soft)]',
                isNext ? 'ring-2 ring-amber-400/45' : '',
              )}
              title={
                day.voucher
                  ? isId
                    ? 'Hari voucher'
                    : 'Voucher day'
                  : `${day.coin_amount} coin`
              }
            >
              <p
                className={cn(
                  'text-[10px] font-bold uppercase leading-3',
                  compact ? 'text-[9px]' : '',
                )}
              >
                {isId ? 'H' : 'D'}
                {day.day}
              </p>
              <div className="mt-1 flex justify-center">
                {day.claimed ? (
                  <CheckCircle2 className="h-4 w-4 text-amber-600" />
                ) : day.voucher ? (
                  <TicketPercent className="h-4 w-4 text-amber-600" />
                ) : (
                  <Coins className="h-4 w-4 text-amber-500" />
                )}
              </div>
              <p className="mt-1 truncate text-[9px] font-bold leading-3">
                {day.voucher ? 'voucher' : `+${day.coin_amount}`}
              </p>
            </div>
          );
        })}
      </div>

      <div
        className={cn(
          'mt-3 grid gap-2',
          compact ? '' : 'sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center',
        )}
      >
        <div
          className={cn(
            'rounded-[16px] border px-3 py-2',
            claimedToday
              ? 'border-amber-200 bg-white/78'
              : 'border-amber-100 bg-amber-50/92',
            compact ? 'rounded-[14px] px-2.5' : '',
          )}
        >
          <p className="flex min-w-0 items-start gap-1.5 text-xs font-bold leading-4 text-[color:var(--app-text)]">
            <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            {claimedToday
              ? isId
                ? `Hari ini aman: +${todayCoin} koin dan +${todayXp} XP`
                : `Secured today: +${todayCoin} coins and +${todayXp} XP`
              : isId
                ? `Belum di-claim. Ambil +${todayCoin} koin sebelum reset.`
                : `Not claimed yet. Get +${todayCoin} coins before reset.`}
          </p>
          {voucherCode ? (
            <p className="mt-1 truncate text-[11px] font-bold text-orange-700">
              {isId ? 'Voucher terbuka: ' : 'Voucher unlocked: '}
              {voucherCode}
            </p>
          ) : null}
        </div>
        <div className={cn('flex gap-2', compact ? 'grid grid-cols-2' : '')}>
          <button
            type="button"
            onClick={() => void handleClaim()}
            disabled={!canClaimToday || effectiveStatus === 'claiming'}
            className={cn(
              'inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[14px] px-3 text-xs font-bold transition',
              compact ? '' : 'sm:flex-none',
              canClaimToday
                ? 'bg-amber-500 text-white shadow-[0_12px_22px_-17px_rgba(217,119,6,0.76)] hover:bg-amber-600'
                : 'border border-amber-200 bg-white text-amber-700',
              effectiveStatus === 'claiming'
                ? 'cursor-wait opacity-80'
                : 'disabled:cursor-not-allowed disabled:opacity-80',
            )}
          >
            {effectiveStatus === 'claiming' ? (
              <Clock3 className="h-3.5 w-3.5 animate-spin" />
            ) : canClaimToday ? (
              <Coins className="h-3.5 w-3.5" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            {canClaimToday
              ? isId
                ? 'Claim'
                : 'Claim'
              : isId
                ? 'Sudah'
                : 'Done'}
          </button>
          <Link
            href={`/${locale}/transactions`}
            className={cn(
              'inline-flex h-10 flex-1 items-center justify-center rounded-[14px] border border-sky-200 bg-sky-50 px-3 text-xs font-bold text-sky-700 transition hover:bg-sky-100',
              compact ? '' : 'sm:flex-none',
            )}
          >
            {isId ? 'Pakai' : 'Use'}
          </Link>
        </div>
      </div>

      {status === 'error' || errorMessage ? (
        <p className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {errorMessage ??
            (isId
              ? 'Reward belum bisa dicek. Coba lagi nanti.'
              : 'Reward is unavailable. Try again later.')}
        </p>
      ) : null}
    </section>
  );
}
