import { NextRequest, NextResponse } from 'next/server';
import { forwardToWwwAuthRoute } from '@/lib/wwwProxy';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    return await forwardToWwwAuthRoute({
      req,
      path: '/api/auth/send-otp',
      body,
      unavailableMessage: 'OTP service unavailable',
      logKey: '[CRM_SEND_OTP_PROXY_ERROR]',
    });
  } catch (error) {
    console.error('[CRM_SEND_OTP_PROXY_ERROR]', error);
    return NextResponse.json(
      { error: 'OTP service unavailable' },
      { status: 503 },
    );
  }
}
