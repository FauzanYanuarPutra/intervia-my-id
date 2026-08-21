import { NextRequest, NextResponse } from 'next/server';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  const upstream = new URL(
    `/v1/categories/${encodeURIComponent(slug)}/subcategories`,
    MARKETPLACE_URL,
  );
  req.nextUrl.searchParams.forEach((value, key) => {
    upstream.searchParams.set(key, value);
  });

  const response = await fetch(upstream, { cache: 'no-store' });
  const payload = await response.json().catch(() => null);
  return NextResponse.json(payload ?? { error: 'Invalid response' }, {
    status: response.status,
  });
}
