import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

export type CreatorBudgetAction =
  | 'create_listing'
  | 'edit_listing'
  | 'create_reel'
  | 'create_community';

type CreatorBudgetOptions = {
  userId: string;
  action: CreatorBudgetAction;
  cost?: number;
  dailyLimit?: number;
};

type CreatorBudgetOk = {
  ok: true;
  balance: number;
  usedToday: number;
  dailyLimit: number;
};

type CreatorBudgetBlocked = {
  ok: false;
  response: NextResponse;
  code: 'daily_limit' | 'insufficient_coins' | 'budget_unavailable';
};

const DEFAULT_INITIAL_COINS = Number.parseInt(
  process.env.CREATOR_INITIAL_COINS || '1000',
  10,
);
const DEFAULT_DAILY_COINS = Number.parseInt(
  process.env.CREATOR_DAILY_COINS || '50',
  10,
);
const DEFAULT_ACTION_COST = Number.parseInt(
  process.env.CREATOR_ACTION_COST_COINS || '10',
  10,
);
const DEFAULT_DAILY_LIMIT = Number.parseInt(
  process.env.CREATOR_DAILY_ACTION_LIMIT || '10',
  10,
);

function safePositiveInt(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function jakartaDateKey(now = new Date()): string {
  const jakartaOffsetMs = 7 * 60 * 60 * 1000;
  return new Date(now.getTime() + jakartaOffsetMs).toISOString().slice(0, 10);
}

function secondsUntilNextJakartaDay(now = new Date()): number {
  const jakartaOffsetMs = 7 * 60 * 60 * 1000;
  const jakartaNow = new Date(now.getTime() + jakartaOffsetMs);
  const next = Date.UTC(
    jakartaNow.getUTCFullYear(),
    jakartaNow.getUTCMonth(),
    jakartaNow.getUTCDate() + 1,
    0,
    0,
    0,
  );
  return Math.max(60, Math.ceil((next - jakartaNow.getTime()) / 1000));
}

function actionLabel(action: CreatorBudgetAction): string {
  switch (action) {
    case 'create_listing':
      return 'posting listing';
    case 'edit_listing':
      return 'edit listing';
    case 'create_reel':
      return 'posting reels';
    case 'create_community':
      return 'posting komunitas';
  }
}

function buildBlockedResponse(input: {
  status: number;
  code: CreatorBudgetBlocked['code'];
  error: string;
  balance?: number;
  usedToday?: number;
  dailyLimit?: number;
}) {
  return NextResponse.json(
    {
      error: input.error,
      code: input.code,
      ...(typeof input.balance === 'number' ? { coin_balance: input.balance } : {}),
      ...(typeof input.usedToday === 'number'
        ? { used_today: input.usedToday }
        : {}),
      ...(typeof input.dailyLimit === 'number'
        ? { daily_limit: input.dailyLimit }
        : {}),
    },
    { status: input.status },
  );
}

export async function enforceCreatorBudget(
  options: CreatorBudgetOptions,
): Promise<CreatorBudgetOk | CreatorBudgetBlocked> {
  const userId = options.userId.trim();
  const action = options.action;
  const cost = safePositiveInt(options.cost ?? DEFAULT_ACTION_COST, 10);
  const dailyLimit = safePositiveInt(options.dailyLimit ?? DEFAULT_DAILY_LIMIT, 10);
  const initialCoins = safePositiveInt(DEFAULT_INITIAL_COINS, 1000);
  const dailyCoins = safePositiveInt(DEFAULT_DAILY_COINS, 50);
  const dateKey = jakartaDateKey();
  const ttl = secondsUntilNextJakartaDay();

  if (!userId) {
    return {
      ok: false,
      code: 'budget_unavailable',
      response: buildBlockedResponse({
        status: 401,
        code: 'budget_unavailable',
        error: 'Unauthorized',
      }),
    };
  }

  try {
    const redis = getRedis();
    const script = `
      local balanceKey = KEYS[1]
      local initKey = KEYS[2]
      local dailyGrantKey = KEYS[3]
      local quotaKey = KEYS[4]
      local ledgerKey = KEYS[5]

      local initialCoins = tonumber(ARGV[1])
      local dailyCoins = tonumber(ARGV[2])
      local cost = tonumber(ARGV[3])
      local dailyLimit = tonumber(ARGV[4])
      local ttl = tonumber(ARGV[5])
      local action = ARGV[6]
      local dateKey = ARGV[7]

      if redis.call("SETNX", initKey, "1") == 1 then
        redis.call("EXPIRE", initKey, 315360000)
        redis.call("SETNX", balanceKey, initialCoins)
        redis.call("LPUSH", ledgerKey, "grant:init:" .. tostring(initialCoins))
      end

      if redis.call("EXISTS", balanceKey) == 0 then
        redis.call("SET", balanceKey, initialCoins)
      end

      if redis.call("SETNX", dailyGrantKey, "1") == 1 then
        redis.call("EXPIRE", dailyGrantKey, ttl)
        redis.call("INCRBY", balanceKey, dailyCoins)
        redis.call("LPUSH", ledgerKey, "grant:daily:" .. dateKey .. ":" .. tostring(dailyCoins))
      end

      local used = redis.call("INCR", quotaKey)
      if used == 1 then
        redis.call("EXPIRE", quotaKey, ttl)
      end

      local balance = tonumber(redis.call("GET", balanceKey) or "0")
      if used > dailyLimit then
        redis.call("DECR", quotaKey)
        return {0, "daily_limit", balance, used - 1, dailyLimit}
      end

      if balance < cost then
        redis.call("DECR", quotaKey)
        return {0, "insufficient_coins", balance, used - 1, dailyLimit}
      end

      local nextBalance = redis.call("DECRBY", balanceKey, cost)
      redis.call("LPUSH", ledgerKey, "spend:" .. action .. ":" .. dateKey .. ":" .. tostring(cost))
      redis.call("LTRIM", ledgerKey, 0, 99)
      redis.call("EXPIRE", ledgerKey, 315360000)
      return {1, "ok", nextBalance, used, dailyLimit}
    `;

    const result = (await redis.eval(
      script,
      5,
      `creator:coins:${userId}`,
      `creator:coins:init:${userId}`,
      `creator:coins:daily:${userId}:${dateKey}`,
      `creator:quota:${action}:${userId}:${dateKey}`,
      `creator:ledger:${userId}`,
      String(initialCoins),
      String(dailyCoins),
      String(cost),
      String(dailyLimit),
      String(ttl),
      action,
      dateKey,
    )) as [number, string, number, number, number];

    const allowed = Number(result?.[0]) === 1;
    const code = String(result?.[1] || 'budget_unavailable') as
      | 'ok'
      | CreatorBudgetBlocked['code'];
    const balance = Number(result?.[2] ?? 0);
    const usedToday = Number(result?.[3] ?? 0);
    const limit = Number(result?.[4] ?? dailyLimit);

    if (allowed) {
      return {
        ok: true,
        balance,
        usedToday,
        dailyLimit: limit,
      };
    }

    if (code === 'daily_limit') {
      return {
        ok: false,
        code,
        response: buildBlockedResponse({
          status: 429,
          code,
          error: `Batas ${actionLabel(action)} hari ini sudah habis.`,
          balance,
          usedToday,
          dailyLimit: limit,
        }),
      };
    }

    return {
      ok: false,
      code: 'insufficient_coins',
      response: buildBlockedResponse({
        status: 402,
        code: 'insufficient_coins',
        error: `Coin belum cukup untuk ${actionLabel(action)}.`,
        balance,
        usedToday,
        dailyLimit: limit,
      }),
    };
  } catch (error) {
    console.error('[CREATOR_BUDGET_ERROR]', error);
    return {
      ok: false,
      code: 'budget_unavailable',
      response: buildBlockedResponse({
        status: 503,
        code: 'budget_unavailable',
        error: 'Creator budget service unavailable. Please retry shortly.',
      }),
    };
  }
}

export async function refundCreatorBudget(options: {
  userId: string;
  action: CreatorBudgetAction;
  cost?: number;
}) {
  const userId = options.userId.trim();
  if (!userId) return;

  const cost = safePositiveInt(options.cost ?? DEFAULT_ACTION_COST, 10);
  const dateKey = jakartaDateKey();

  try {
    const redis = getRedis();
    const ledger = `creator:ledger:${userId}`;
    await redis.incrby(`creator:coins:${userId}`, cost);
    await redis.lpush(ledger, `refund:${options.action}:${dateKey}:${cost}`);
    await redis.ltrim(ledger, 0, 99);
    await redis.expire(ledger, 315360000);
  } catch (error) {
    console.error('[CREATOR_BUDGET_REFUND_ERROR]', error);
  }
}

export async function readCreatorBudget(userIdRaw: string): Promise<{
  ok: true;
  balance: number;
  dailyCoins: number;
  initialCoins: number;
  dateKey: string;
} | {
  ok: false;
  response: NextResponse;
}> {
  const userId = userIdRaw.trim();
  const initialCoins = safePositiveInt(DEFAULT_INITIAL_COINS, 1000);
  const dailyCoins = safePositiveInt(DEFAULT_DAILY_COINS, 50);
  const dateKey = jakartaDateKey();
  const ttl = secondsUntilNextJakartaDay();

  if (!userId) {
    return {
      ok: false,
      response: buildBlockedResponse({
        status: 401,
        code: 'budget_unavailable',
        error: 'Unauthorized',
      }),
    };
  }

  try {
    const redis = getRedis();
    const script = `
      local balanceKey = KEYS[1]
      local initKey = KEYS[2]
      local dailyGrantKey = KEYS[3]
      local ledgerKey = KEYS[4]
      local initialCoins = tonumber(ARGV[1])
      local dailyCoins = tonumber(ARGV[2])
      local ttl = tonumber(ARGV[3])
      local dateKey = ARGV[4]

      if redis.call("SETNX", initKey, "1") == 1 then
        redis.call("EXPIRE", initKey, 315360000)
        redis.call("SETNX", balanceKey, initialCoins)
        redis.call("LPUSH", ledgerKey, "grant:init:" .. tostring(initialCoins))
      end

      if redis.call("EXISTS", balanceKey) == 0 then
        redis.call("SET", balanceKey, initialCoins)
      end

      if redis.call("SETNX", dailyGrantKey, "1") == 1 then
        redis.call("EXPIRE", dailyGrantKey, ttl)
        redis.call("INCRBY", balanceKey, dailyCoins)
        redis.call("LPUSH", ledgerKey, "grant:daily:" .. dateKey .. ":" .. tostring(dailyCoins))
      end

      redis.call("LTRIM", ledgerKey, 0, 99)
      redis.call("EXPIRE", ledgerKey, 315360000)
      return tonumber(redis.call("GET", balanceKey) or "0")
    `;

    const balance = Number(
      await redis.eval(
        script,
        4,
        `creator:coins:${userId}`,
        `creator:coins:init:${userId}`,
        `creator:coins:daily:${userId}:${dateKey}`,
        `creator:ledger:${userId}`,
        String(initialCoins),
        String(dailyCoins),
        String(ttl),
        dateKey,
      ),
    );

    return {
      ok: true,
      balance: Number.isFinite(balance) ? balance : 0,
      dailyCoins,
      initialCoins,
      dateKey,
    };
  } catch (error) {
    console.error('[CREATOR_BUDGET_READ_ERROR]', error);
    return {
      ok: false,
      response: buildBlockedResponse({
        status: 503,
        code: 'budget_unavailable',
        error: 'Creator budget service unavailable. Please retry shortly.',
      }),
    };
  }
}
