import { NextRequest, NextResponse } from 'next/server';
import { parseJsonBody } from '@/lib/serverRequest';
import { requireAuth } from '@/lib/serverAuth';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

type GenericRecord = Record<string, unknown>;

function asObject(value: unknown): GenericRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as GenericRecord)
    : {};
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;

  const payload = asObject(body.data);
  const resolved = await params;
  const id = resolved.id;

  try {
    const upstream = await fetch(
      `${MARKETPLACE_URL}/v1/content/${encodeURIComponent(id)}/report`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.ctx.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: String(payload.reason || 'other'),
          details:
            typeof payload.details === 'string'
              ? payload.details
              : undefined,
        }),
        cache: 'no-store',
      },
    );

    const response = await upstream.json().catch(() => ({}));
    return NextResponse.json(response, { status: upstream.status });
  } catch {
    return NextResponse.json(
      { error: 'Moderation service unavailable' },
      { status: 503 },
    );
  }
}
