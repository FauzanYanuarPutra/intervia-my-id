import { NextRequest, NextResponse } from 'next/server';

import { getPublishedNews } from '@/lib/news';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const language = params.get('language') === 'en' ? 'en' : 'id';
  const limitRaw = Number(params.get('limit') || '36');
  const limit = Number.isFinite(limitRaw)
    ? Math.min(100, Math.max(1, Math.trunc(limitRaw)))
    : 36;

  const result = await getPublishedNews({
    category: params.get('category')?.trim() || undefined,
    topic: params.get('topic')?.trim() || undefined,
    location: params.get('location')?.trim() || undefined,
    query: params.get('q')?.trim() || undefined,
    cursor: params.get('cursor')?.trim() || undefined,
    language,
    limit,
  });

  return NextResponse.json(
    result,
    {
      headers: {
        'Cache-Control':
          'public, max-age=15, stale-while-revalidate=60',
      },
    },
  );
}
