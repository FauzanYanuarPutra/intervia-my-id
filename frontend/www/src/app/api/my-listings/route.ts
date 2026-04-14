import { NextRequest, NextResponse } from 'next/server';
import { getJwtSubject } from '@/lib/server/jwtPayload';

const MARKETPLACE_URL = process.env.INTERNAL_MARKETPLACE_URL || process.env.MARKETPLACE_URL || 'http://localhost:8081';

function normalizeContentList(payload: unknown): Array<Record<string, unknown>> {
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
  const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
    request.cookies.get('access_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || '';
  const status = searchParams.get('status') || 'active';
  const ownerId = getJwtSubject(token);

  try {
    const params = new URLSearchParams();
    params.set('limit', '200');
    params.set('offset', '0');
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    if (ownerId) params.set('owner_id', ownerId);

    const res = await fetch(`${MARKETPLACE_URL}/v1/content?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return NextResponse.json(
        { error: body || `Marketplace error (${res.status})` },
        { status: res.status },
      );
    }

    const data = await res.json().catch(() => []);
    const list = normalizeContentList(data);
    let results = list;

    // Fallback filtering only if upstream cannot apply it (ownerId/status missing from query).
    if (ownerId && !params.has('owner_id')) {
      results = results.filter((item) => String(item.owner_id ?? '') === ownerId);
    }

    const normalizedStatus = status.trim().toLowerCase();
    if (normalizedStatus && !params.has('status')) {
      results = results.filter((item) => {
        const current = String(item.content_status ?? item.status ?? '').toLowerCase();
        return current === normalizedStatus;
      });
    }

    return NextResponse.json({ results, total: results.length });
  } catch (e) {
    console.error('[my-listings]', e);
    return NextResponse.json(
      { results: [], total: 0, error: 'Service unavailable' },
      { status: 503 }
    );
  }
}

