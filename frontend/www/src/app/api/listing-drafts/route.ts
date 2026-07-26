import { NextRequest, NextResponse } from 'next/server';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

function authHeaders(req: NextRequest) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const bearer = req.headers.get('authorization');
  const cookieToken = req.cookies.get('access_token')?.value?.trim();
  if (bearer) headers.set('Authorization', bearer);
  else if (cookieToken) headers.set('Authorization', `Bearer ${cookieToken}`);
  return headers;
}

async function readJson(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text };
  }
}

export async function GET(req: NextRequest) {
  const upstream = new URL('/v1/listing-drafts', MARKETPLACE_URL);
  req.nextUrl.searchParams.forEach((value, key) => {
    upstream.searchParams.set(key, value);
  });
  const res = await fetch(upstream, {
    headers: authHeaders(req),
    cache: 'no-store',
  });
  return NextResponse.json(await readJson(res), { status: res.status });
}

export async function POST(req: NextRequest) {
  const res = await fetch(new URL('/v1/listing-drafts', MARKETPLACE_URL), {
    method: 'POST',
    headers: authHeaders(req),
    body: await req.text(),
    cache: 'no-store',
  });
  return NextResponse.json(await readJson(res), { status: res.status });
}
