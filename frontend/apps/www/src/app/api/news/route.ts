import { NextRequest, NextResponse } from 'next/server';
import { getPublishedNews } from '@/lib/news';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readLimit(value: string | null): number {
  const parsed = Number(value || 0);
  if (!Number.isSafeInteger(parsed)) return 36;
  return Math.min(Math.max(parsed, 1), 48);
}

function clean(value: string | null, maxLength: number): string | undefined {
  const trimmed = value?.trim().slice(0, maxLength) || '';
  return trimmed || undefined;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const cursor = clean(params.get('cursor'), 160);
  const category = clean(params.get('category'), 80);
  const topic = clean(params.get('topic'), 80);
  const location = clean(params.get('location'), 120);
  const query = clean(params.get('q'), 160);
  const language = params.get('language') === 'en' ? 'en' : 'id';
  const limit = readLimit(params.get('limit'));

  const payload = await getPublishedNews({
    category,
    topic,
    location,
    query,
    language,
    cursor,
    limit,
  });

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  });
}
