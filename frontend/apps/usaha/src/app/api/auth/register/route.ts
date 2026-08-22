import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: 'Registrasi portal lokal sudah dinonaktifkan. Akun Usaha memakai Identity Lajukan.',
      code: 'LEGACY_USAHA_AUTH_RETIRED',
      loginUrl: '/api/auth/google?callbackUrl=/businesses/new',
    },
    { status: 410 },
  );
}
