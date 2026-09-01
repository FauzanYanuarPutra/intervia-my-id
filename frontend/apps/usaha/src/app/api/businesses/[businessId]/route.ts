import { NextResponse } from 'next/server';
import { updateBusiness } from '@/lib/business-server';
import { normalizeBusinessApiError } from '@/lib/business-api-error';

function readNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Number(parsed) : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await context.params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const business = await updateBusiness(businessId, {
      name: typeof body.name === 'string' ? body.name.trim() : undefined,
      category: typeof body.category === 'string' ? body.category.trim() : undefined,
      city: typeof body.city === 'string' ? body.city.trim() : undefined,
      address: typeof body.address === 'string' ? body.address.trim() : undefined,
      locationQuery: typeof body.locationQuery === 'string' ? body.locationQuery.trim() : undefined,
      phone: typeof body.phone === 'string' ? body.phone.trim() : undefined,
      description: typeof body.description === 'string' ? body.description.trim() : undefined,
      schedule: typeof body.schedule === 'string' ? body.schedule.trim() : undefined,
      latitude: body.latitude === undefined ? undefined : readNumber(body.latitude),
      longitude: body.longitude === undefined ? undefined : readNumber(body.longitude),
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
