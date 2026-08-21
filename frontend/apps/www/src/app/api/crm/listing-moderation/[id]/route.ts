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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;
  const payload = asObject(body.data);
  const action = asString(payload.action);
  const note = asString(payload.note);

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
  const moderation = asObject(metadata.listing_moderation);
  const history = Array.isArray(moderation.actions)
    ? (moderation.actions as GenericRecord[])
    : [];

  const nextState =
    action === 'ban'
      ? 'banned'
      : action === 'restrict'
        ? 'restricted'
        : action === 'flag'
          ? 'under_review'
          : action === 'unban'
            ? 'clean'
            : 'flagged';

  const nextMetadata = {
    ...metadata,
    listing_moderation: {
      ...moderation,
      state: nextState,
      note: note || moderation.note || null,
      updated_at: new Date().toISOString(),
      actions: [
        {
          id: crypto.randomUUID(),
          actor_id: auth.ctx.userId,
          action,
          note: note || null,
          created_at: new Date().toISOString(),
        },
        ...history,
      ].slice(0, 20),
    },
  };

  const nextStatus =
    action === 'ban' || action === 'restrict'
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
    { ...response, moderation: nextMetadata.listing_moderation },
    { status: res.status },
  );
}
