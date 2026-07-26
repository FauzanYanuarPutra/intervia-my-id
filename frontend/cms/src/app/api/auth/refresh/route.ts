import { NextRequest, NextResponse } from 'next/server';
import { forwardToIdentity } from '@/lib/identityProxy';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    return await forwardToIdentity({
      req,
      path: '/auth/refresh',
      method: 'POST',
      body,
      unavailableMessage: 'Refresh service unavailable',
      logKey: '[CMS_AUTH_REFRESH_PROXY_ERROR]',
    });
  } catch (error) {
    console.error('[CMS_AUTH_REFRESH_PROXY_ERROR]', error);
    return NextResponse.json(
      { error: 'Refresh service unavailable' },
      { status: 503 },
    );
  }
}
