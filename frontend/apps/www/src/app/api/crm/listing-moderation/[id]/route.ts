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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;
  const payload = asObject(body.data);

  const action = String(payload.action || '').trim().toLowerCase();
  const reasonCode = String(
    payload.reason_code || payload.reason || 'other',
  ).trim().toLowerCase();
  const note =
    typeof payload.reason_note === 'string'
      ? payload.reason_note
      : typeof payload.note === 'string'
        ? payload.note
        : undefined;
  const severity =
    typeof payload.severity === 'string' ? payload.severity : 'medium';

  const resolved = await params;
  const id = resolved.id;

  try {
    const upstream = await fetch(
      `${MARKETPLACE_URL}/v1/content/${encodeURIComponent(id)}/moderate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.ctx.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          reason_code: reasonCode,
          reason_note: note,
          severity,
          legal_hold: payload.legal_hold === true,
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
