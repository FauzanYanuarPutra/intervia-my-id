import { NextRequest, NextResponse } from 'next/server';
import { forwardToWwwAuthRoute } from '@/lib/wwwProxy';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    return await forwardToWwwAuthRoute({
      req,
      path: '/api/auth/verify-otp',
      body,
      unavailableMessage: 'OTP verification unavailable',
      logKey: '[CRM_VERIFY_OTP_PROXY_ERROR]',
    });
  } catch (error) {
    console.error('[CRM_VERIFY_OTP_PROXY_ERROR]', error);
    return NextResponse.json(
      { error: 'OTP verification unavailable' },
      { status: 503 },
    );
  }
}
