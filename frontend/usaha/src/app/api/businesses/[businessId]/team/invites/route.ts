import { NextResponse } from 'next/server';
import { getPortalAccount } from '@/lib/portal-server';
import { inviteBusinessMember } from '@/lib/portal-store';
import type { PortalRole } from '@/lib/portal-types';

export async function POST(
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
    phone?: string;
    role?: PortalRole;
  };

  try {
    const business = inviteBusinessMember(account.id, businessId, {
      name: body.name?.trim() ?? '',
      phone: body.phone?.trim() ?? '',
      role: body.role ?? 'cashier',
    });

    return NextResponse.json({ ok: true, business });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal kirim undangan.' },
      { status: 400 },
    );
  }
}
