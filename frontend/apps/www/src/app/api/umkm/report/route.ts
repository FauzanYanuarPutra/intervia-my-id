import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

const REASONS = new Set([
  'inaccurate_information',
  'not_found',
  'duplicate_business',
  'fraud_misleading',
  'policy_violation',
  'privacy_personal_data',
  'copyright',
  'other',
]);

function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!text) return undefined;
  return text.slice(0, maxLength);
}

function validStoreRef(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,160}$/.test(value);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.res;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const storeRef = cleanText(body.store_ref, 160) || '';
    const reasonCode = cleanText(body.reason_code, 80) || '';
    const details = cleanText(body.details, 4000);

    if (!validStoreRef(storeRef)) {
      return NextResponse.json({ error: 'Toko tidak valid.' }, { status: 400 });
    }
    if (!REASONS.has(reasonCode)) {
      return NextResponse.json({ error: 'Alasan laporan tidak valid.' }, { status: 400 });
    }

    const response = await fetch(
      `${MARKETPLACE_URL}/v1/umkm/stores/${encodeURIComponent(storeRef)}/report`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.ctx.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason_code: reasonCode,
          details,
        }),
        cache: 'no-store',
      },
    );

    const payload = await response.json().catch(() => ({
      error: 'Respons server tidak bisa dibaca.',
    }));

    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error('[umkm/report]', error);
    return NextResponse.json(
      { error: 'Layanan laporan sedang tidak tersedia.' },
      { status: 503 },
    );
  }
}
