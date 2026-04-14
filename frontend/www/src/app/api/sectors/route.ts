import { NextRequest, NextResponse } from 'next/server';

const marketplaceBase =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';

export async function GET(req: NextRequest) {
  if (!marketplaceBase) {
    return NextResponse.json(
      { error: 'Marketplace service URL not configured' },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  const query = url.searchParams.toString();

  try {
    const backendRes = await fetch(
      `${marketplaceBase}/v1/sectors${query ? `?${query}` : ''}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
      },
    );

    const data = await backendRes.json().catch(() => null);
    if (!backendRes.ok) {
      console.error('[api/sectors] backend error:', backendRes.status, data);
      return NextResponse.json(
        {
          error: 'Marketplace service returned an error',
          status: backendRes.status,
          data: Array.isArray(data) ? data : data ?? null,
        },
        { status: backendRes.status },
      );
    }

    return NextResponse.json(data ?? [], { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error('[api/sectors] marketplace unreachable:', message);
    return NextResponse.json(
      { error: 'Marketplace service unavailable' },
      { status: 503 },
    );
  }
}
