import { NextResponse } from 'next/server';
import { getBusinessForCurrentActor, replaceBusinessLocations } from '@/lib/business-server';
import type { BusinessLocation } from '@/lib/portal-types';

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
    const body = (await request.json()) as { locations?: BusinessLocation[] };
    if (!Array.isArray(body.locations) || body.locations.length > 50) return NextResponse.json({ error: 'Daftar lokasi tidak valid.' }, { status: 400 });
    const locations = body.locations.map((item, index) => ({ ...item, isPrimary: item.isPrimary || (index === 0 && !body.locations!.some(location => location.isPrimary)) }));
    const business = await replaceBusinessLocations(businessId, locations);
    return NextResponse.json({ ok: true, items: business.locations ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Lokasi belum berhasil disimpan.' }, { status: 400 });
  }
}
