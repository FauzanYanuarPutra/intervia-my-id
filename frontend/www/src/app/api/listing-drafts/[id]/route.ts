import { NextRequest, NextResponse } from 'next/server';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

type RouteContext = { params: Promise<{ id: string }> };

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

export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const res = await fetch(
    new URL(`/v1/listing-drafts/${encodeURIComponent(id)}`, MARKETPLACE_URL),
    { headers: authHeaders(req), cache: 'no-store' },
  );
  return NextResponse.json(await readJson(res), { status: res.status });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const res = await fetch(
    new URL(`/v1/listing-drafts/${encodeURIComponent(id)}`, MARKETPLACE_URL),
    {
      method: 'PATCH',
      headers: authHeaders(req),
      body: await req.text(),
      cache: 'no-store',
    },
  );
  return NextResponse.json(await readJson(res), { status: res.status });
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const res = await fetch(
    new URL(`/v1/listing-drafts/${encodeURIComponent(id)}`, MARKETPLACE_URL),
    { method: 'DELETE', headers: authHeaders(req), cache: 'no-store' },
  );
  if (res.status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(await readJson(res), { status: res.status });
}
