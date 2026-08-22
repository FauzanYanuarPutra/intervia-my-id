import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: 'Login portal lama sudah dinonaktifkan. Gunakan akun Lajukan melalui Google.',
      code: 'LEGACY_USAHA_AUTH_RETIRED',
      loginUrl: '/api/auth/google?callbackUrl=/',
    },
    { status: 410 },
  );
}
