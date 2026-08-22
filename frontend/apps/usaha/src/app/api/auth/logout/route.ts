import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookies, shouldUseSecureAuthCookies } from '@/lib/auth-session';

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response, shouldUseSecureAuthCookies(req.url));
  return response;
}
