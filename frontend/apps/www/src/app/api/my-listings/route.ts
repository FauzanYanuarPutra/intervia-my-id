import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readLimit(value: string | null): number {
  if (!value || !/^\d+$/.test(value.trim())) return DEFAULT_LIMIT;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}

function readStatus(value: string | null): string {
  return value?.trim().toLowerCase() || 'active';
}

function isValidOwnerId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function normalizeContentList(
  payload: unknown,
): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload as Array<Record<string, unknown>>;
  if (payload && typeof payload === 'object') {
    const objectPayload = payload as Record<string, unknown>;
    if (Array.isArray(objectPayload.items)) {
      return objectPayload.items as Array<Record<string, unknown>>;
    }
    if (Array.isArray(objectPayload.data)) {
      return objectPayload.data as Array<Record<string, unknown>>;
    }
    if (Array.isArray(objectPayload.results)) {
      return objectPayload.results as Array<Record<string, unknown>>;
    }
  }
  return [];
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type')?.trim() || '';
  const status = readStatus(searchParams.get('status'));
  const limit = readLimit(searchParams.get('limit'));
  const ownerId = auth.ctx.payload.sub?.trim() || '';

  // Never call the public content endpoint without a concrete owner filter.
  // Its unfiltered response is the global marketplace catalogue.
  if (!isValidOwnerId(ownerId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', '0');
    if (type) params.set('type', type);
    params.set('status', status);
    params.set('owner_id', ownerId);

    const res = await fetch(
      `${MARKETPLACE_URL}/v1/content?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${auth.ctx.token}` },
        cache: 'no-store',
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return NextResponse.json(
        { error: body || `Marketplace error (${res.status})` },
        { status: res.status },
      );
    }

    const data = await res.json().catch(() => []);
    const list = normalizeContentList(data);
    // Keep the BFF fail-closed even if an upstream implementation ignores the
    // owner filter. This also protects compatibility with older service builds.
    const results = list.filter(
      item => String(item.owner_id ?? '') === ownerId,
    );

    return NextResponse.json({ results, total: results.length });
  } catch (e) {
    console.error('[my-listings]', e);
    return NextResponse.json(
      { results: [], total: 0, error: 'Service unavailable' },
      { status: 503 },
    );
  }
}
