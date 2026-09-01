import { NextResponse } from 'next/server';
import {
  createBusiness,
  listBusinessesForCurrentActor,
  requireAuthenticatedActor,
} from '@/lib/business-server';
import { normalizeBusinessApiError } from '@/lib/business-api-error';

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Number(parsed) : null;
}

export async function GET() {
  try {
    await requireAuthenticatedActor();
    const items = await listBusinessesForCurrentActor();
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    const normalized = normalizeBusinessApiError(error, 'Data usaha belum bisa dimuat.');
    return NextResponse.json(
      { error: normalized.message, code: normalized.code },
      { status: normalized.status },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAuthenticatedActor();
    const body = (await request.json()) as Record<string, unknown>;
    const name = readText(body.name);
    const category = readText(body.category) || 'Usaha umum';
    const city = readText(body.city);
    const address = readText(body.address);
    const phone = readText(body.phone);
    const locationQuery = readText(body.locationQuery);
    const idempotencyKey =
      readText(body.idempotencyKey) ||
      readText(request.headers.get('Idempotency-Key')) ||
      crypto.randomUUID();
    const latitude = readNumber(body.latitude);
    const longitude = readNumber(body.longitude);

    if (name.length < 2) return NextResponse.json({ error: 'Isi nama usaha dulu.' }, { status: 400 });
    if (city.length < 2) return NextResponse.json({ error: 'Isi kota usaha.' }, { status: 400 });
    if (phone.replace(/\s+/g, '').length < 9) return NextResponse.json({ error: 'Isi nomor usaha yang aktif.' }, { status: 400 });
    if (latitude === null || longitude === null) {
      return NextResponse.json({ error: 'Tentukan titik lokasi utama di peta supaya usaha siap ditemukan.' }, { status: 400 });
    }

    const created = await createBusiness({
      name,
      category,
      city,
      address,
      phone,
      locationQuery,
      latitude,
      longitude,
      idempotencyKey,
    });
    return NextResponse.json({
      ok: true,
      businessId: created.businessId,
      organizationId: created.organizationId,
      redirectTo: `/?business=${encodeURIComponent(created.businessId)}&created=1`,
    });
  } catch (error) {
    const normalized = normalizeBusinessApiError(error, 'Usaha belum berhasil dibuat.');
    return NextResponse.json(
      { error: normalized.message, code: normalized.code },
      { status: normalized.status },
    );
  }
}
