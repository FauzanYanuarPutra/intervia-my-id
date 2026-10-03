import { NextRequest, NextResponse } from 'next/server';
import { extractContentId } from '@/lib/content/routes';
import { requireAuth } from '@/lib/serverAuth';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';

function noStore(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  return response;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  try {
    const { id } = await params;
    const resolvedId = extractContentId(id) || id;
    const response = await fetch(
      `${MARKETPLACE_URL}/v1/content/${encodeURIComponent(resolvedId)}/matches/feedback`,
      {
        headers: {
          Authorization: `Bearer ${auth.ctx.token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      },
    );
    const data = await response.json().catch(() => ({}));
    return noStore(data, response.status);
  } catch (error) {
    console.error('[CONTENT_MATCH_FEEDBACK_GET_ERROR]', error);
    return noStore({ error: 'Match feedback temporarily unavailable' }, 503);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  try {
    const { id } = await params;
    const resolvedId = extractContentId(id) || id;
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return noStore({ error: 'Payload tidak valid.' }, 400);
    }

    const response = await fetch(
      `${MARKETPLACE_URL}/v1/content/${encodeURIComponent(resolvedId)}/matches/feedback`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.ctx.token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify(body),
      },
    );
    const data = await response.json().catch(() => ({}));
    return noStore(data, response.status);
  } catch (error) {
    console.error('[CONTENT_MATCH_FEEDBACK_POST_ERROR]', error);
    return noStore({ error: 'Match feedback temporarily unavailable' }, 503);
  }
}
