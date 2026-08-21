import { NextResponse } from 'next/server';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

type RouteContext = {
  params: Promise<{ categorySlug: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  const { categorySlug } = await context.params;
  const upstream = new URL(
    `/v1/filters/${encodeURIComponent(categorySlug)}`,
    MARKETPLACE_URL,
  );

  const response = await fetch(upstream, { cache: 'no-store' });
  const payload = await response.json().catch(() => null);
  return NextResponse.json(payload ?? { error: 'Invalid response' }, {
    status: response.status,
  });
}
