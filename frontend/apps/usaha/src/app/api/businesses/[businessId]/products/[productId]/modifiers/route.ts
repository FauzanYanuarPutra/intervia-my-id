import { NextResponse } from 'next/server';
import { readAccessToken } from '@/lib/auth-session';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL || 'http://marketplace_service:8081';

async function proxy(
  request: Request,
  context: { params: Promise<{ businessId: string; productId: string }> },
  method: 'GET' | 'PUT',
) {
  const token = await readAccessToken();
  if (!token) return NextResponse.json({ error: 'Sesi berakhir.' }, { status: 401 });
  const { businessId, productId } = await context.params;
  const body = method === 'PUT' ? await request.text() : undefined;
  const response = await fetch(
    `${MARKETPLACE_URL}/v1/businesses/${encodeURIComponent(businessId)}/products/${encodeURIComponent(productId)}/modifiers`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(method === 'PUT' ? { 'Content-Type': 'application/json' } : {}),
      },
      cache: 'no-store',
      body,
    },
  );
  const text = await response.text();
  return new NextResponse(text || '{}', {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ businessId: string; productId: string }> },
) {
  return proxy(request, context, 'GET');
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ businessId: string; productId: string }> },
) {
  return proxy(request, context, 'PUT');
}
