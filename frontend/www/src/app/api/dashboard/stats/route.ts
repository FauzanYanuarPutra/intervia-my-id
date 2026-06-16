import { NextRequest, NextResponse } from 'next/server';
import { getJwtSubject } from '@/lib/server/jwtPayload';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';
const CHAT_URL = process.env.INTERNAL_CHAT_URL || 'http://localhost:4000';

type ContentLike = {
  owner_id?: string;
  rating?: number | null;
  review_count?: number | null;
  seller_stats?: {
    rating?: number | null;
    review_count?: number | null;
  } | null;
};

type WalletAccountLike = {
  environment?: string | null;
  currency?: string | null;
  available_balance_cents?: number | string | null;
  held_balance_cents?: number | string | null;
};

function readList(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload as Array<Record<string, unknown>>;
  if (payload && typeof payload === 'object') {
    const objectPayload = payload as Record<string, unknown>;
    if (Array.isArray(objectPayload.items)) return objectPayload.items as Array<Record<string, unknown>>;
    if (Array.isArray(objectPayload.data)) return objectPayload.data as Array<Record<string, unknown>>;
    if (Array.isArray(objectPayload.results)) return objectPayload.results as Array<Record<string, unknown>>;
  }
  return [];
}

function normalizeRating(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, n));
}

function normalizeReviewCount(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function normalizeMoneyCents(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function normalizeWalletEnvironment(value: unknown): 'development' | 'live' {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  if (raw === 'live' || raw === 'production' || raw === 'prod') return 'live';
  return 'development';
}

function pickWalletAccount(payload: unknown): WalletAccountLike | null {
  if (!payload || typeof payload !== 'object') return null;
  const objectPayload = payload as Record<string, unknown>;
  const accounts = Array.isArray(objectPayload.accounts)
    ? (objectPayload.accounts as WalletAccountLike[])
    : [];
  if (accounts.length === 0) return null;

  const defaultEnvironment = normalizeWalletEnvironment(
    objectPayload.default_environment,
  );
  return (
    accounts.find(
      (account) =>
        normalizeWalletEnvironment(account.environment) === defaultEnvironment,
    ) ||
    accounts.find(
      (account) =>
        normalizeWalletEnvironment(account.environment) === 'development',
    ) ||
    accounts[0] ||
    null
  );
}

export async function GET(req: NextRequest) {
  try {
    const token =
      req.headers.get('authorization')?.replace('Bearer ', '') ||
      req.cookies.get('access_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ownerId = getJwtSubject(token);

    const stats = {
      total_content: 0,
      active_transactions: 0,
      unread_messages: 0,
      user_rating: 0.0,
      wallet_balance_cents: 0,
      pending_payout_cents: 0,
      wallet_environment: 'development' as 'development' | 'live',
      wallet_currency: 'IDR',
    };

    const [contentResult, transactionsResult, inboxResult, walletResult] =
      await Promise.allSettled([
      fetch(`${MARKETPLACE_URL}/v1/content?limit=200&offset=0`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }),
      fetch(`${MARKETPLACE_URL}/v1/transactions?limit=200&offset=0`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }),
      fetch(`${CHAT_URL}/api/v1/inbox`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }),
      PROMO_ONLY_MODE
        ? Promise.resolve(
            new Response(JSON.stringify({ accounts: [] }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          )
        : fetch(`${MARKETPLACE_URL}/v1/wallet/balance`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          }),
    ]);

    if (contentResult.status === 'fulfilled' && contentResult.value.ok) {
      const contentPayload = await contentResult.value.json().catch(() => []);
      const contentItems = readList(contentPayload) as ContentLike[];
      const owned = ownerId
        ? contentItems.filter((item) => String(item.owner_id ?? '') === ownerId)
        : contentItems;
      stats.total_content = owned.length;

      const sellerStat = owned.find((item) => {
        const count = normalizeReviewCount(item.seller_stats?.review_count);
        return count > 0;
      });
      if (sellerStat) {
        stats.user_rating = Number(
          normalizeRating(sellerStat.seller_stats?.rating).toFixed(2),
        );
      } else {
        let weightedTotal = 0;
        let totalReviews = 0;
        for (const item of owned) {
          const rating = normalizeRating(item.rating);
          const reviewCount = normalizeReviewCount(item.review_count);
          if (reviewCount > 0) {
            weightedTotal += rating * reviewCount;
            totalReviews += reviewCount;
          }
        }
        if (totalReviews > 0) {
          stats.user_rating = Number((weightedTotal / totalReviews).toFixed(2));
        }
      }
    } else if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to aggregate content stats');
    }

    if (transactionsResult.status === 'fulfilled' && transactionsResult.value.ok) {
      const txnPayload = await transactionsResult.value.json().catch(() => []);
      const txns = readList(txnPayload);
      stats.active_transactions = txns.filter((t) => {
        const status = String((t as { status?: unknown }).status ?? '').toLowerCase();
        return status === 'pending' || status === 'accepted' || status === 'in_progress';
      }).length;
    } else if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to aggregate transaction stats');
    }

    if (inboxResult.status === 'fulfilled' && inboxResult.value.ok) {
      const inboxPayload = await inboxResult.value.json().catch(() => ({}));
      const rooms = readList(inboxPayload);
      stats.unread_messages = rooms.reduce((sum, room) => {
        const unread = Number((room as { unread_count?: unknown }).unread_count ?? 0);
        return sum + (Number.isFinite(unread) ? Math.max(0, unread) : 0);
      }, 0);
    } else if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to aggregate inbox stats');
    }

    if (walletResult.status === 'fulfilled' && walletResult.value.ok) {
      const walletPayload = await walletResult.value.json().catch(() => ({}));
      const account = pickWalletAccount(walletPayload);
      if (account) {
        stats.wallet_balance_cents = normalizeMoneyCents(
          account.available_balance_cents,
        );
        stats.pending_payout_cents = normalizeMoneyCents(
          account.held_balance_cents,
        );
        stats.wallet_environment = normalizeWalletEnvironment(account.environment);
        stats.wallet_currency =
          String(account.currency || 'IDR').trim().toUpperCase() || 'IDR';
      }
    } else if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to aggregate wallet stats');
    }

    return NextResponse.json(stats);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[STATS_ERROR]', error);
    }
    return NextResponse.json(
      {
        total_content: 0,
        active_transactions: 0,
        unread_messages: 0,
        user_rating: 0.0,
        wallet_balance_cents: 0,
        pending_payout_cents: 0,
        wallet_environment: 'development',
        wallet_currency: 'IDR',
      },
      { status: 200 }
    );
  }
}

