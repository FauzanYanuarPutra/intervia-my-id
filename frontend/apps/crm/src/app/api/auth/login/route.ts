import { NextRequest, NextResponse } from 'next/server';
import { forwardToIdentity } from '@/lib/identityProxy';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    return await forwardToIdentity({
      req,
      path: '/auth/login',
      method: 'POST',
      body,
      unavailableMessage: 'Login service unavailable',
      logKey: '[CRM_AUTH_LOGIN_PROXY_ERROR]',
    });
  } catch (error) {
    console.error('[CRM_AUTH_LOGIN_PROXY_ERROR]', error);
    return NextResponse.json(
      { error: 'Login service unavailable' },
      { status: 503 },
    );
  }
}
