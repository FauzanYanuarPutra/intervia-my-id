import { NextResponse } from 'next/server';
import { getBusinessForCurrentActor, replaceBusinessLocations } from '@/lib/business-server';
import type { BusinessLocation } from '@/lib/portal-types';
import { normalizeBusinessApiError } from '@/lib/business-api-error';

export async function GET(_request: Request, context: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await context.params;
  const business = await getBusinessForCurrentActor(businessId);
  if (!business) return NextResponse.json({ error: 'Usaha tidak ditemukan.' }, { status: 404 });
  const locations = business.locations ?? [];
  return NextResponse.json({ items: locations, count: locations.length });
}

export async function PUT(request: Request, context: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await context.params;
  try {
    const body = (await request.json()) as { locations?: BusinessLocation[]; reason?: string; expectedVersion?: unknown };
    const expectedVersion = body.expectedVersion === undefined || body.expectedVersion === null || body.expectedVersion === ''
      ? undefined
      : Number(body.expectedVersion);
    if (expectedVersion !== undefined && (!Number.isSafeInteger(expectedVersion) || expectedVersion <= 0)) {
      return NextResponse.json({ error: 'Versi data lokasi tidak valid.', code: 'business_version_invalid' }, { status: 400 });
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!Array.isArray(body.locations) || body.locations.length === 0 || body.locations.length > 50) {
      return NextResponse.json({ error: 'Usaha harus memiliki 1–50 lokasi.', code: 'invalid_business_locations' }, { status: 400 });
    }
    if (reason.length < 3 || reason.length > 500) {
      return NextResponse.json({ error: 'Alasan perubahan lokasi harus 3–500 karakter.', code: 'business_location_change_reason_required' }, { status: 400 });
    }

    const rawLocations = body.locations.map(item => ({ ...item }));
    const idSet = new Set<string>();
    for (const [index, item] of rawLocations.entries()) {
      const id = typeof item.id === 'string' ? item.id.trim() : '';
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      const locationType = typeof item.locationType === 'string' ? item.locationType.trim() : '';
      const address = typeof item.address === 'string' ? item.address.trim() : '';
      const city = typeof item.city === 'string' ? item.city.trim() : '';
      const latitude = item.latitude === null || item.latitude === undefined || item.latitude === '' ? null : Number(item.latitude);
      const longitude = item.longitude === null || item.longitude === undefined || item.longitude === '' ? null : Number(item.longitude);
      if (!id || idSet.has(id)) return NextResponse.json({ error: `ID lokasi pada baris ${index + 1} tidak valid atau duplikat.`, code: 'invalid_business_locations' }, { status: 400 });
      idSet.add(id);
      if (name.length < 2 || name.length > 120) return NextResponse.json({ error: `Nama lokasi pada baris ${index + 1} belum valid.`, code: 'invalid_business_locations' }, { status: 400 });
      if (!['physical', 'service_area', 'online'].includes(locationType)) return NextResponse.json({ error: `Jenis lokasi pada baris ${index + 1} belum valid.`, code: 'invalid_business_locations' }, { status: 400 });
      if (address.length > 500 || city.length > 120) return NextResponse.json({ error: `Alamat/kota pada baris ${index + 1} terlalu panjang.`, code: 'invalid_business_locations' }, { status: 400 });
      if (locationType !== 'online' && (!address || !city)) return NextResponse.json({ error: `Alamat dan kota wajib diisi untuk lokasi fisik pada baris ${index + 1}.`, code: 'invalid_business_locations' }, { status: 400 });
      if ((latitude === null) !== (longitude === null)) return NextResponse.json({ error: `Latitude dan longitude harus berpasangan pada baris ${index + 1}.`, code: 'invalid_business_locations' }, { status: 400 });
      if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) return NextResponse.json({ error: `Latitude pada baris ${index + 1} tidak valid.`, code: 'invalid_business_locations' }, { status: 400 });
      if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) return NextResponse.json({ error: `Longitude pada baris ${index + 1} tidak valid.`, code: 'invalid_business_locations' }, { status: 400 });
      if (typeof item.phone === 'string' && item.phone.length > 50) return NextResponse.json({ error: `Nomor telepon pada baris ${index + 1} terlalu panjang.`, code: 'invalid_business_locations' }, { status: 400 });
      if (typeof item.whatsapp === 'string' && item.whatsapp.length > 50) return NextResponse.json({ error: `WhatsApp pada baris ${index + 1} terlalu panjang.`, code: 'invalid_business_locations' }, { status: 400 });
    }

    const firstPrimaryIndex = rawLocations.findIndex(item => item.isPrimary === true);
    const locations = rawLocations.map((item, index) => ({
      ...item,
      name: typeof item.name === 'string' ? item.name.trim() : '',
      address: typeof item.address === 'string' ? item.address.trim() : '',
      city: typeof item.city === 'string' ? item.city.trim() : '',
      locationType: typeof item.locationType === 'string' ? item.locationType.trim() : '',
      isPrimary: firstPrimaryIndex === -1 ? index === 0 : index === firstPrimaryIndex,
    }));
    const business = await replaceBusinessLocations(businessId, locations, reason, expectedVersion);
    return NextResponse.json({ ok: true, items: business.locations ?? [] });
  } catch (error) {
    const normalized = normalizeBusinessApiError(error, 'Lokasi belum berhasil disimpan.');
    return NextResponse.json(
      { error: normalized.message, code: normalized.code },
      { status: normalized.status },
    );
  }
}
