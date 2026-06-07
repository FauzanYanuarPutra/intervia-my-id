import { NextRequest, NextResponse } from 'next/server';
import { forwardToIdentity } from '@/lib/identityProxy';

export async function GET(req: NextRequest) {
  try {
    return await forwardToIdentity({
      req,
      path: '/auth/me',
      method: 'GET',
      unavailableMessage: 'Session service unavailable',
      logKey: '[CRM_AUTH_ME_PROXY_ERROR]',
    });
  } catch (error) {
    console.error('[CRM_AUTH_ME_PROXY_ERROR]', error);
    return NextResponse.json(
      { error: 'Session service unavailable' },
      { status: 503 },
    );
  }
}
