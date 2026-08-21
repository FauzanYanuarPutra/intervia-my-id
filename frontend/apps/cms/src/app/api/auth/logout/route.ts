import { NextRequest, NextResponse } from 'next/server';
import { forwardToIdentity } from '@/lib/identityProxy';

export async function POST(req: NextRequest) {
  try {
    return await forwardToIdentity({
      req,
      path: '/auth/logout',
      method: 'POST',
      unavailableMessage: 'Logout service unavailable',
      logKey: '[CMS_AUTH_LOGOUT_PROXY_ERROR]',
    });
  } catch (error) {
    console.error('[CMS_AUTH_LOGOUT_PROXY_ERROR]', error);
    return NextResponse.json(
      { error: 'Logout service unavailable' },
      { status: 503 },
    );
  }
}
