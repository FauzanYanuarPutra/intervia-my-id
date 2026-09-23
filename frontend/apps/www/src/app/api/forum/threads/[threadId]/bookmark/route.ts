import { NextRequest, NextResponse } from 'next/server';

const COMMUNITY_URL =
  process.env.INTERNAL_COMMUNITY_URL ||
  process.env.COMMUNITY_SERVICE_URL ||
  'http://localhost:8082';

function readForwardToken(req: NextRequest): string | null {
  const bearer = req.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '')
    .trim();
  if (bearer) return bearer;
  return req.cookies.get('access_token')?.value?.trim() || null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;
  const token = readForwardToken(req);
  const headers: HeadersInit = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(
    `${COMMUNITY_URL}/v1/forum/threads/${encodeURIComponent(threadId)}/bookmark`,
    { headers, cache: 'no-store' },
  );
  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, { status: response.status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;
  const token = readForwardToken(req);
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(
    `${COMMUNITY_URL}/v1/forum/threads/${encodeURIComponent(threadId)}/bookmark`,
    {
      method: 'POST',
      headers,
      body: await req.text(),
      cache: 'no-store',
    },
  );
  const payload = await response.json().catch(() => ({}));
  return NextResponse.json(payload, { status: response.status });
}
