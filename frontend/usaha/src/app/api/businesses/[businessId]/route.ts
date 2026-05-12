import { NextResponse } from 'next/server';
import { getPortalAccount } from '@/lib/portal-server';
import { updateBusinessInfo } from '@/lib/portal-store';

function readNumber(value: unknown): number | null {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(parsed) ? Number(parsed.toFixed(6)) : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  const account = await getPortalAccount({ clearInvalidSession: true });
  const { businessId } = await context.params;

  if (!account) {
    return NextResponse.json(
      { error: 'Sesi habis atau akun tidak ditemukan. Login lagi dulu.' },
      { status: 401 },
    );
  }

  const body = (await request.json()) as {
    name?: string;
    category?: string;
    city?: string;
    address?: string;
    locationQuery?: string;
    phone?: string;
    description?: string;
    schedule?: string;
    latitude?: number | string | null;
    longitude?: number | string | null;
  };

  try {
    const business = updateBusinessInfo(account.id, businessId, {
      name: body.name?.trim() ?? '',
      category: body.category?.trim() ?? '',
      city: body.city?.trim() ?? '',
      address: body.address?.trim() ?? '',
      locationQuery: body.locationQuery?.trim() ?? '',
      phone: body.phone?.trim() ?? '',
      description: body.description?.trim() ?? '',
      schedule: body.schedule?.trim() ?? '',
      latitude: readNumber(body.latitude),
      longitude: readNumber(body.longitude),
    });

    return NextResponse.json({ ok: true, business });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal simpan perubahan.' },
      { status: 400 },
    );
  }
}
