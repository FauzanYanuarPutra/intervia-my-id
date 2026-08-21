import { NextRequest, NextResponse } from 'next/server';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { resolveUmkmQrToken } from '@/lib/super-app/umkm-commerce';

export async function GET(req: NextRequest) {
  try {
    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'super-app-umkm-scan',
      ipLimit: 450,
      deviceLimit: 340,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const rl = await enforceRateLimit({
      key: `superapp:umkm:scan:${security.ip}`,
      limit: 600,
      windowSeconds: 3600,
      message: 'Too many QR scan requests. Please retry shortly.',
    });
    if (!rl.ok) return rl.response;

    const token = (new URL(req.url).searchParams.get('token') || '').trim();
    if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 });

    const resolved = await resolveUmkmQrToken(token);
    if (!resolved) return NextResponse.json({ error: 'QR token not found or expired' }, { status: 404 });

    return NextResponse.json(
      {
        data: {
          token: resolved.token,
          store: resolved.store,
          table: resolved.table,
          redirect_path: resolved.redirect_path,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[UMKM_SCAN_ERROR]', error);
    return NextResponse.json({ error: 'Failed to resolve scan token' }, { status: 500 });
  }
}
