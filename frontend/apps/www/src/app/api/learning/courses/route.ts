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

function forwardHeaders(req: NextRequest, hasBody = false): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (hasBody) headers['Content-Type'] = 'application/json';
  const token = getForwardToken(req);
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.toString();
    const upstream = query
      ? `${MARKETPLACE_URL}/v1/learning/courses?${query}`
      : `${MARKETPLACE_URL}/v1/learning/courses`;
    const res = await fetch(upstream, {
      headers: forwardHeaders(req),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[LEARNING_COURSES_GET_ERROR]', error);
    return NextResponse.json({ error: 'Learning service unavailable' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const res = await fetch(`${MARKETPLACE_URL}/v1/learning/courses`, {
      method: 'POST',
      headers: forwardHeaders(req, true),
      body,
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[LEARNING_COURSES_POST_ERROR]', error);
    return NextResponse.json({ error: 'Learning service unavailable' }, { status: 503 });
  }
}
