import { NextRequest, NextResponse } from 'next/server';
import { extractContentId } from '@/lib/content/routes';
import { requireAuth } from '@/lib/serverAuth';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const { id } = await params;
    const resolvedId = extractContentId(id) || id;
    const url = new URL(
      MARKETPLACE_URL + '/v1/content/' + resolvedId + '/matches',
    );
    const sort = req.nextUrl.searchParams.get('sort');
    const limit = req.nextUrl.searchParams.get('limit');

    if (sort) url.searchParams.set('sort', sort);
    if (limit) url.searchParams.set('limit', limit);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${auth.ctx.token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[CONTENT_SMART_MATCH_GET_ERROR]', error);
    return NextResponse.json(
      { error: 'Smart Match temporarily unavailable' },
      { status: 503 },
    );
  }
}