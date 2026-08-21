import { NextRequest, NextResponse } from 'next/server';
import { parseJsonBody } from '@/lib/serverRequest';
import { requireAuth } from '@/lib/serverAuth';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

type GenericRecord = Record<string, unknown>;

function asObject(value: unknown): GenericRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as GenericRecord;
  }
  return {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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
  const reason = asString(payload.reason) || 'other';
  const details = asString(payload.details);
  const normalizedReason = ALLOWED_REASONS.has(reason) ? reason : 'other';

  const resolved = await params;
  const id = resolved.id;
  const currentRes = await fetch(`${MARKETPLACE_URL}/v1/content/${id}`, {
    headers: { Authorization: `Bearer ${auth.ctx.token}` },
    cache: 'no-store',
  });
  const current = await currentRes.json().catch(() => null);
  if (!currentRes.ok || !current || typeof current !== 'object') {
    return NextResponse.json(
      { error: 'Failed to load listing' },
      { status: currentRes.status || 502 },
    );
  }

  const currentRecord = current as GenericRecord;
  const metadata = asObject(currentRecord.metadata);
  const reports = Array.isArray(metadata.listing_reports)
    ? (metadata.listing_reports as GenericRecord[])
    : [];
  const authPayload = asObject(auth.ctx.payload);
  const reporterName =
    asString(authPayload.name) ||
    asString(authPayload.full_name) ||
    asString(authPayload.username);
  const nextReport = {
    id: crypto.randomUUID(),
    reporter_id: auth.ctx.userId,
    reporter_name: reporterName || null,
    reporter_email: auth.ctx.email || null,
    reason: normalizedReason,
    details: details || null,
    created_at: new Date().toISOString(),
  };

  const nextMetadata = {
    ...metadata,
    listing_reports: [nextReport, ...reports].slice(0, 20),
    listing_moderation: {
      ...(asObject(metadata.listing_moderation) || {}),
      state: reports.length + 1 >= 6 ? 'restricted' : 'flagged',
      last_report_at: nextReport.created_at,
      updated_at: new Date().toISOString(),
    },
  };

  const nextStatus =
    String(currentRecord.content_status || currentRecord.status || 'draft') ===
      'active' && reports.length + 1 >= 6
      ? 'archived'
      : currentRecord.content_status || currentRecord.status || 'draft';

  const res = await fetch(`${MARKETPLACE_URL}/v1/content/${id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${auth.ctx.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...currentRecord,
      content_status: nextStatus,
      metadata: nextMetadata,
    }),
  });

  const response = await res.json().catch(() => ({}));
  return NextResponse.json(
    {
      ...response,
      moderation: nextMetadata.listing_moderation,
      message: 'Report submitted successfully.',
    },
    { status: res.status },
  );
}
const ALLOWED_REASONS = new Set([
  'spam',
  'fake',
  'scam',
  'harassment',
  'illegal',
  'inaccurate',
  'other',
]);
