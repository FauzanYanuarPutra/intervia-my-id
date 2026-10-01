import { NextResponse } from 'next/server';
import { updateBusiness } from '@/lib/business-server';
import { normalizeBusinessApiError } from '@/lib/business-api-error';

function readNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Number(parsed) : null;
}

function readOptionalVersion(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export async function PATCH(request: Request, context: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await context.params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    const city = typeof body.city === 'string' ? body.city.trim() : '';
    const address = typeof body.address === 'string' ? body.address.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const schedule = typeof body.schedule === 'string' ? body.schedule.trim() : '';
    const latitude = body.latitude === undefined ? null : readNumber(body.latitude);
    const longitude = body.longitude === undefined ? null : readNumber(body.longitude);
    const expectedVersion = readOptionalVersion(body.expectedVersion);

    if (name.length < 2 || name.length > 160) {
      return NextResponse.json({ error: 'Nama usaha harus 2–160 karakter.', code: 'invalid_business_name' }, { status: 400 });
    }
    if (category.length < 2 || category.length > 120) {
      return NextResponse.json({ error: 'Kategori usaha harus 2–120 karakter.', code: 'invalid_business_category' }, { status: 400 });
    }
    if (city.length < 2 || city.length > 120) {
      return NextResponse.json({ error: 'Kota usaha harus 2–120 karakter.', code: 'invalid_business_city' }, { status: 400 });
    }
    if (address.length < 3 || address.length > 500) {
      return NextResponse.json({ error: 'Alamat usaha harus 3–500 karakter.', code: 'invalid_business_address' }, { status: 400 });
    }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      return NextResponse.json({ error: 'Nomor usaha belum valid.', code: 'invalid_business_phone' }, { status: 400 });
    }
    if (description.length > 4000) {
      return NextResponse.json({ error: 'Deskripsi usaha terlalu panjang.', code: 'invalid_business_description' }, { status: 400 });
    }
    if (schedule.length > 300) {
      return NextResponse.json({ error: 'Jam operasional terlalu panjang.', code: 'invalid_business_schedule' }, { status: 400 });
    }
    if ((body.latitude !== undefined || body.longitude !== undefined) && (latitude === null) !== (longitude === null)) {
      return NextResponse.json({ error: 'Koordinat latitude dan longitude harus diisi berpasangan.', code: 'invalid_business_coordinates' }, { status: 400 });
    }
    if (latitude !== null && (latitude < -90 || latitude > 90)) {
      return NextResponse.json({ error: 'Latitude tidak valid.', code: 'invalid_business_coordinates' }, { status: 400 });
    }
    if (longitude !== null && (longitude < -180 || longitude > 180)) {
      return NextResponse.json({ error: 'Longitude tidak valid.', code: 'invalid_business_coordinates' }, { status: 400 });
    }

    if (reason.length < 3) {
      return NextResponse.json(
        { error: 'Alasan perubahan info usaha wajib diisi minimal 3 karakter.', code: 'business_profile_change_reason_required' },
        { status: 400 },
      );
    }
    const business = await updateBusiness(businessId, {
      name,
      category,
      city,
      address,
      locationQuery: typeof body.locationQuery === 'string' ? body.locationQuery.trim() : undefined,
      phone,
      description,
      schedule,
      latitude: body.latitude === undefined ? undefined : latitude,
      longitude: body.longitude === undefined ? undefined : longitude,
      reason,
      expectedVersion,
    });
    return NextResponse.json({ ok: true, business });
  } catch (error) {
    const normalized = normalizeBusinessApiError(error, 'Gagal simpan perubahan.');
    return NextResponse.json(
      { error: normalized.message, code: normalized.code },
      { status: normalized.status },
    );
  }
}
