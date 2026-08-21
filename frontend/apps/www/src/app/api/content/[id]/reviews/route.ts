import { NextRequest, NextResponse } from 'next/server';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    if (PROMO_ONLY_MODE) {
      return NextResponse.json([], {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const res = await fetch(`${MARKETPLACE_URL}/v1/content/${id}/reviews`);

    const data = await res.json().catch(() => []);
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[REVIEWS_LIST_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

