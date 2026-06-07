type RewardBalance = {
  user_id: string;
  coin_balance: number;
  xp_balance: number;
  voucher_count: number;
  updated_at: string;
};

type DailyReward = {
  id: string;
  user_id: string;
  reward_date: string;
  week_start: string;
  streak_day: number;
  coin_amount: number;
  xp_amount: number;
  voucher_code: string | null;
  claimed_at: string;
  metadata: Record<string, string>;
};

type WeeklyRewardDay = {
  day: number;
  coin_amount: number;
  xp_amount: number;
  voucher: boolean;
  claimed: boolean;
};

type WeeklyRewardProgress = {
  today: string;
  week_start: string;
  week_end: string;
  next_reset_at: string;
  claimed_dates: string[];
  claimed_days: number[];
  days_claimed: number;
  days_remaining: number;
  next_streak_day: number;
  voucher_unlocked: boolean;
  weekly_coin_total: number;
  weekly_xp_total: number;
  schedule: WeeklyRewardDay[];
};

type RewardFallbackPayload = {
  claimed?: boolean;
  reward?: DailyReward;
  balance: RewardBalance;
  weekly: WeeklyRewardProgress;
  claimed_today: boolean;
  can_claim_today: boolean;
  payment: {
    coin_value_cents: number;
    max_discount_bps: number;
    max_discount_ratio: number;
    min_cash_payment_cents: number;
    currency: 'IDR';
  };
};

type RewardFallbackRecord = {
  coinBalance: number;
  xpBalance: number;
  voucherCount: number;
  claims: DailyReward[];
  updatedAt: string;
};

const STORE_KEY = '__lajukanDailyRewardFallbackStore';

const PAYMENT_RULES = {
  coin_value_cents: 10_000,
  max_discount_bps: 2_500,
  max_discount_ratio: 0.25,
  min_cash_payment_cents: 10_000,
  currency: 'IDR' as const,
};

function getFallbackStore(): Map<string, RewardFallbackRecord> {
  const globalStore = globalThis as typeof globalThis & {
    [STORE_KEY]?: Map<string, RewardFallbackRecord>;
  };

  globalStore[STORE_KEY] ??= new Map<string, RewardFallbackRecord>();
  return globalStore[STORE_KEY];
}

function getOrCreateRecord(userId: string): RewardFallbackRecord {
  const store = getFallbackStore();
  const existing = store.get(userId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const record: RewardFallbackRecord = {
    coinBalance: 0,
    xpBalance: 0,
    voucherCount: 0,
    claims: [],
    updatedAt: now,
  };
  store.set(userId, record);
  return record;
}

function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function addUtcDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateKey(value: Date): string {
  return startOfUtcDay(value).toISOString().slice(0, 10);
}

function startOfUtcWeek(value: Date): Date {
  const day = startOfUtcDay(value);
  const weekday = day.getUTCDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addUtcDays(day, offset);
}

function clampStreak(value: number): number {
  return Math.min(Math.max(Math.trunc(value), 1), 7);
}

function coinAmount(streakDay: number): number {
  return 10 + clampStreak(streakDay) * 5;
}

function xpAmount(streakDay: number): number {
  return 20 + clampStreak(streakDay) * 10;
}

function makeRewardId(userId: string, rewardDate: string): string {
  const suffix = userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'user';
  return `fallback-${suffix}-${rewardDate}`;
}

function makeVoucherCode(userId: string, today: string): string {
  const suffix = userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'USER';
  return `MINGGUAN-${suffix.toUpperCase()}-${today.replaceAll('-', '')}`;
}

function buildWeeklyProgress(
  record: RewardFallbackRecord,
  now = new Date(),
): WeeklyRewardProgress {
  const today = startOfUtcDay(now);
  const weekStart = startOfUtcWeek(today);
  const weekEnd = addUtcDays(weekStart, 6);
  const nextResetAt = addUtcDays(weekStart, 7);
  const weekStartKey = dateKey(weekStart);

  const weekClaims = record.claims
    .filter(claim => claim.week_start === weekStartKey)
    .sort((a, b) => a.reward_date.localeCompare(b.reward_date));

  const claimedDates = weekClaims.map(claim => claim.reward_date);
  const claimedDays = Array.from(
    new Set(weekClaims.map(claim => clampStreak(claim.streak_day))),
  ).sort((a, b) => a - b);
  const claimedDaySet = new Set(claimedDays);
  const daysClaimed = Math.min(claimedDays.length, 7);

  return {
    today: dateKey(today),
    week_start: weekStartKey,
    week_end: dateKey(weekEnd),
    next_reset_at: nextResetAt.toISOString(),
    claimed_dates: claimedDates,
    claimed_days: claimedDays,
    days_claimed: daysClaimed,
    days_remaining: Math.max(7 - daysClaimed, 0),
    next_streak_day: clampStreak(daysClaimed + 1),
    voucher_unlocked: weekClaims.some(claim => Boolean(claim.voucher_code)),
    weekly_coin_total: weekClaims.reduce(
      (total, claim) => total + claim.coin_amount,
      0,
    ),
    weekly_xp_total: weekClaims.reduce(
      (total, claim) => total + claim.xp_amount,
      0,
    ),
    schedule: Array.from({ length: 7 }, (_, index) => {
      const day = index + 1;
      return {
        day,
        coin_amount: coinAmount(day),
        xp_amount: xpAmount(day),
        voucher: day === 7,
        claimed: claimedDaySet.has(day),
      };
    }),
  };
}

function buildPayload(
  userId: string,
  record: RewardFallbackRecord,
  options: { claimed?: boolean; reward?: DailyReward; now?: Date } = {},
): RewardFallbackPayload {
  const weekly = buildWeeklyProgress(record, options.now);
  const claimedToday = weekly.claimed_dates.includes(weekly.today);

  return {
    claimed: options.claimed,
    reward: options.reward,
    balance: {
      user_id: userId,
      coin_balance: record.coinBalance,
      xp_balance: record.xpBalance,
      voucher_count: record.voucherCount,
      updated_at: record.updatedAt,
    },
    weekly,
    claimed_today: claimedToday,
    can_claim_today: !claimedToday,
    payment: PAYMENT_RULES,
  };
}

export function buildRewardBalanceFallback(
  userId: string,
): RewardFallbackPayload {
  const record = getOrCreateRecord(userId);
  return buildPayload(userId, record);
}

export function claimDailyLoginRewardFallback(
  userId: string,
): RewardFallbackPayload {
  const record = getOrCreateRecord(userId);
  const now = new Date();
  const weekly = buildWeeklyProgress(record, now);
  const existingReward = record.claims.find(
    claim => claim.reward_date === weekly.today,
  );

  if (existingReward) {
    return buildPayload(userId, record, {
      claimed: false,
      reward: existingReward,
      now,
    });
  }

  const streakDay = clampStreak(weekly.days_claimed + 1);
  const reward: DailyReward = {
    id: makeRewardId(userId, weekly.today),
    user_id: userId,
    reward_date: weekly.today,
    week_start: weekly.week_start,
    streak_day: streakDay,
    coin_amount: coinAmount(streakDay),
    xp_amount: xpAmount(streakDay),
    voucher_code: streakDay >= 7 ? makeVoucherCode(userId, weekly.today) : null,
    claimed_at: now.toISOString(),
    metadata: {
      source: 'daily_login_fallback',
      reset: 'weekly',
      benefit: streakDay >= 7 ? 'weekly_voucher' : 'coin_xp',
    },
  };

  record.claims.push(reward);
  record.coinBalance += reward.coin_amount;
  record.xpBalance += reward.xp_amount;
  record.voucherCount += reward.voucher_code ? 1 : 0;
  record.updatedAt = now.toISOString();

  return buildPayload(userId, record, { claimed: true, reward, now });
}
