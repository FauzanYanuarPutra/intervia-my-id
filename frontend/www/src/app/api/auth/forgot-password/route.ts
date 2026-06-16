import { NextRequest, NextResponse } from 'next/server';
import { getRedis, getOTPAttempts, incrementOTPAttempts, storeOTP } from '@/lib/redis';
import { sendOTPEmail, sendPasswordResetEmail } from '@/lib/email';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { z } from 'zod';
import crypto from 'crypto';

const RESET_TOKEN_EXPIRY = 3600; // 1 hour

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
  mode: z.enum(['link', 'otp']).default('link'),
});

export async function POST(req: NextRequest) {
  try {
    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'forgot-password',
      ipLimit: 90,
      deviceLimit: 60,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const parsed = await parseJsonBodyWithSchema(req, ForgotPasswordSchema);
    if (!parsed.ok) return parsed.response;

    const email = parsed.data.email.trim().toLowerCase();
    const mode = parsed.data.mode;

    const ip = security.ip;
    const rl = await enforceRateLimit({
      key: `auth:forgot-password:${ip}:${email}`,
      limit: 5,
      windowSeconds: 3600,
    });
    if (!rl.ok) return rl.response;

    let sent = false;
    let responseMessage =
      'If an account exists with this email, a reset link has been sent.';

    if (mode === 'otp') {
      const otpAttempts = await getOTPAttempts('email', email);
      if (otpAttempts >= 5) {
        return NextResponse.json(
          { error: 'Too many OTP attempts. Please try again later.' },
          { status: 429 },
        );
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      await storeOTP('email', email, otp);
      sent = await sendOTPEmail(email, otp);
      if (sent) {
        await incrementOTPAttempts('email', email);
      }
      responseMessage =
        'If an account exists with this email, a reset OTP has been sent.';
    } else {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const redis = getRedis();
      await redis.setex(`reset:${resetToken}`, RESET_TOKEN_EXPIRY, email);

      const baseUrl =
        (
          process.env.NEXT_PUBLIC_APP_URL ||
          process.env.NEXT_PUBLIC_WWW_URL ||
          req.nextUrl.origin ||
          'https://www.lajukan.com'
        ).replace(/\/$/, '');
      const locale = req.cookies.get('NEXT_LOCALE')?.value || 'id';
      const resetLink = `${baseUrl}/${locale}/reset-password?token=${resetToken}`;

      sent = await sendPasswordResetEmail(email, resetLink);
    }

    return NextResponse.json({
      success: true,
      message: responseMessage,
      mode,
      ...(process.env.NODE_ENV !== 'production' ? { delivery: sent ? 'ok' : 'failed' } : {}),
    });
  } catch (e) {
    console.error('Forgot password error:', e);
    return NextResponse.json(
      { error: 'Service unavailable' },
      { status: 503 }
    );
  }
}

