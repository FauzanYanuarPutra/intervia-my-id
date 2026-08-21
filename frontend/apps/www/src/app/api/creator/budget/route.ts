import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { readCreatorBudget } from '@/lib/server/creatorBudget';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const budget = await readCreatorBudget(auth.ctx.userId);
  if (!budget.ok) return budget.response;

  return NextResponse.json(
    {
      coin_balance: budget.balance,
      daily_coin_grant: budget.dailyCoins,
      initial_coin_grant: budget.initialCoins,
      date_key: budget.dateKey,
      costs: {
        create_listing: 10,
        edit_listing: 10,
        create_reel: 10,
        create_community: 10,
      },
      daily_limits: {
        create_listing: 10,
        edit_listing: 40,
        create_reel: 10,
        create_community: 10,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
