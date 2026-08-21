import { NextRequest, NextResponse } from 'next/server';
import {
  buildForwardAuthHeaders,
  withProtectedRoute,
} from '@/lib/api/withProtectedRoute';
import { buildRewardBalanceFallback } from '@/lib/rewards/dailyLoginRewardFallback';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';

function resolveRuntimeEnv(): string {
  return (
    process.env.APP_ENV ||
    process.env.ENV ||
    process.env.NEXT_PUBLIC_APP_ENV ||
    process.env.NODE_ENV ||
    'development'
  ).toLowerCase();
}

const RUNTIME_ENV = resolveRuntimeEnv();
const ENABLE_MEMORY_FALLBACK =
  process.env.REWARD_MEMORY_FALLBACK === 'true' ||
  (process.env.REWARD_MEMORY_FALLBACK !== 'false' &&
    RUNTIME_ENV !== 'production' &&
    RUNTIME_ENV !== 'staging');

function shouldForwardStatus(status: number): boolean {
  return status >= 400 && status < 500 && status !== 404;
}

export async function GET(req: NextRequest) {
  try {
    return await withProtectedRoute(
      req,
      {
        routeKey: 'reward-balance',
        ipLimit: 300,
        deviceLimit: 180,
        windowSeconds: 900,
      },
      async ctx => {
        try {
          const upstream = await fetch(
            `${MARKETPLACE_URL}/v1/rewards/balance`,
            {
              method: 'GET',
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

          console.warn('[REWARD_BALANCE_UPSTREAM_UNAVAILABLE]', {
            status: upstream.status,
            payload,
          });
        } catch (error) {
          console.warn('[REWARD_BALANCE_UPSTREAM_FETCH_ERROR]', error);
        }

        if (ENABLE_MEMORY_FALLBACK) {
          return NextResponse.json(buildRewardBalanceFallback(ctx.userId), {
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
    console.error('[REWARD_BALANCE_GET_ERROR]', error);
    return NextResponse.json(
      { error: 'Reward service unavailable' },
      { status: 503 },
    );
  }
}
