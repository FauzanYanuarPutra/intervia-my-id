import { NextRequest, NextResponse } from 'next/server';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

export const CREATION_DRAFT_ID = /^drf_[a-f0-9]{32}$/;

function authHeaders(req: NextRequest) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const bearer = req.headers.get('authorization');
  const cookieToken = req.cookies.get('access_token')?.value?.trim();
  if (bearer) headers.set('Authorization', bearer);
  else if (cookieToken) headers.set('Authorization', `Bearer ${cookieToken}`);
  return headers;
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: response.ok ? 'Invalid upstream response' : 'Request failed' };
  }
}

export async function proxyCreationDraftRequest(
  req: NextRequest,
  path: string,
  options: { method?: string; body?: string } = {},
) {
  try {
    const response = await fetch(new URL(path, MARKETPLACE_URL), {
      method: options.method || req.method,
      headers: authHeaders(req),
      body: options.body,
      cache: 'no-store',
    });
    if (response.status === 204) return new NextResponse(null, { status: 204 });
    return NextResponse.json(await readJson(response), { status: response.status });
  } catch (error) {
    console.error('[CREATION_DRAFT_PROXY_ERROR]', {
      path,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Creation draft service is unavailable.' },
      { status: 503 },
    );
  }
}

export function invalidCreationDraftId() {
  return NextResponse.json({ error: 'Creation draft not found.' }, { status: 404 });
}

