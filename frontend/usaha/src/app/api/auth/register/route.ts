import { NextResponse } from 'next/server';
import { createOrUpdateAccount } from '@/lib/portal-store';
import { writePortalSession } from '@/lib/portal-session';

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    phone?: string;
    email?: string;
  };

  const name = body.name?.trim() ?? '';
  const phone = body.phone?.trim() ?? '';
  const email = body.email?.trim() ?? '';

  if (name.length < 2) {
    return NextResponse.json({ error: 'Masukkan nama lengkap.' }, { status: 400 });
  }

  if (phone.length < 9) {
    return NextResponse.json(
      { error: 'Masukkan nomor HP yang aktif.' },
      { status: 400 },
    );
  }

  const account = createOrUpdateAccount({
    name,
    phone,
    email: email || undefined,
  });

  await writePortalSession(account.id);

  const params = new URLSearchParams();
  params.set('ownerName', account.name);
  params.set('ownerPhone', body.phone?.trim() ?? '');
  if (email) {
    params.set('ownerEmail', email);
  }

  return NextResponse.json({
    ok: true,
    redirectTo: `/businesses/new?${params.toString()}`,
  });
}
