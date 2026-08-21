import { NextResponse } from 'next/server';
import { getPortalAccount } from '@/lib/portal-server';
import { updateBusinessOperations } from '@/lib/portal-store';

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
    schedule?: string;
    isOpen?: boolean;
  };

  try {
    const business = updateBusinessOperations(account.id, businessId, {
      schedule: body.schedule?.trim() ?? '',
      isOpen: Boolean(body.isOpen),
    });

    return NextResponse.json({ ok: true, business });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal simpan operasional.' },
      { status: 400 },
    );
  }
}
