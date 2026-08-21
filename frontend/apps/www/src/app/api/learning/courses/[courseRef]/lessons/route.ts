import { NextRequest, NextResponse } from 'next/server';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';

function getForwardToken(req: NextRequest): string | null {
  const bearer = req.headers.get('authorization');
  if (bearer?.startsWith('Bearer ')) return bearer.slice('Bearer '.length).trim();
  return req.cookies.get('access_token')?.value?.trim() || null;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ courseRef: string }> },
) {
  const { courseRef } = await context.params;
  const token = getForwardToken(req);
  try {
    const body = await req.text();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(
      `${MARKETPLACE_URL}/v1/learning/courses/${encodeURIComponent(courseRef)}/lessons`,
      { method: 'POST', headers, body, cache: 'no-store' },
    );
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[LEARNING_LESSON_POST_ERROR]', error);
    return NextResponse.json({ error: 'Learning service unavailable' }, { status: 503 });
  }
}
