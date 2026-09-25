import { NextRequest, NextResponse } from 'next/server';
import {
  buildForwardAuthHeaders,
  withProtectedRoute,
} from '@/lib/api/withProtectedRoute';
import { claimDailyLoginRewardFallback } from '@/lib/rewards/dailyLoginRewardFallback';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';

const ENABLE_MEMORY_FALLBACK =
  process.env.REWARD_MEMORY_FALLBACK === 'true';

function shouldForwardStatus(status: number): boolean {
  return status >= 400 && status < 500 && status !== 404;
}

export async function POST(req: NextRequest) {
  try {
    return await withProtectedRoute(
      req,
      {
        routeKey: 'daily-login-reward-claim',
        ipLimit: 120,
        deviceLimit: 80,
        windowSeconds: 900,
      },
      async ctx => {
        try {
          const upstream = await fetch(
            `${MARKETPLACE_URL}/v1/rewards/daily-login/claim`,
            {
              method: 'POST',
              headers: buildForwardAuthHeaders(ctx, {
                Accept: 'application/json',
              }),
              cache: 'no-store',
            },
          );
          const payload = await upstream.json().catch(() => ({}));

          if (upstream.ok || shouldForwardStatus(upstream.status)) {
            return NextResponse.json(payload, {
              status: upstream.status,
              headers: { 'x-lajukan-reward-source': 'marketplace' },
            });
          }

          console.warn('[DAILY_LOGIN_REWARD_UPSTREAM_UNAVAILABLE]', {
            status: upstream.status,
            payload,
          });
        } catch (error) {
          console.warn('[DAILY_LOGIN_REWARD_UPSTREAM_FETCH_ERROR]', error);
        }

        if (ENABLE_MEMORY_FALLBACK) {
          return NextResponse.json(claimDailyLoginRewardFallback(ctx.userId), {
            status: 200,
            headers: { 'x-lajukan-reward-source': 'fallback-memory' },
          });
        }

        return NextResponse.json(
          { error: 'Reward service unavailable' },
          { status: 503 },
        );
      },
    );
  } catch (error) {
    console.error('[DAILY_LOGIN_REWARD_POST_ERROR]', error);
    return NextResponse.json(
      { error: 'Reward service unavailable' },
      { status: 503 },
    );
  }
}
