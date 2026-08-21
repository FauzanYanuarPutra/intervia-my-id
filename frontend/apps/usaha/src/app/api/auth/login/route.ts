import { NextResponse } from 'next/server';
import { findAccountByPhone, listBusinessesForAccount } from '@/lib/portal-store';
import { writePortalSession } from '@/lib/portal-session';

export async function POST(request: Request) {
  const body = (await request.json()) as { phone?: string };
  const phone = body.phone?.trim() ?? '';

  if (!phone) {
    return NextResponse.json(
      { error: 'Masukkan nomor HP yang aktif.' },
      { status: 400 },
    );
  }

  const account = findAccountByPhone(phone);

  if (!account) {
    return NextResponse.json(
      { error: 'Akun belum ada. Daftar dulu atau langsung buat usaha.' },
      { status: 404 },
    );
  }

  await writePortalSession(account.id);
  const businesses = listBusinessesForAccount(account.id);
  const redirectTo = businesses[0] ? `/?business=${businesses[0].id}` : '/businesses/new';

  return NextResponse.json({
    ok: true,
    redirectTo,
  });
}
