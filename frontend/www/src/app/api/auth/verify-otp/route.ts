import { NextRequest, NextResponse } from 'next/server';
import {
  clearOTPAttempts,
  issueOTPVerificationToken,
  verifyOTP,
} from '@/lib/redis';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { z } from 'zod';

const VerifyOtpSchema = z.object({
  type: z.enum(['email', 'phone']),
  target: z.string().min(1),
  otp: z.string().regex(/^\d{6}$/),
  purpose: z.enum(['register', 'login', 'reset', 'profile']).default('register'),
});

function normalizeTarget(type: 'email' | 'phone', target: string): string {
  if (type === 'email') {
    return target.trim().toLowerCase();
  }
  return target.replace(/\D/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'verify-otp',
      ipLimit: 180,
      deviceLimit: 120,
      windowSeconds: 900,
    });
    if (!security.ok) return security.response;

    const parsed = await parseJsonBodyWithSchema(req, VerifyOtpSchema);
    if (!parsed.ok) return parsed.response;

    const { type, target, otp, purpose } = parsed.data;
    const normalizedTarget = normalizeTarget(type, target);

    const ip = security.ip;
    const rlByIp = await enforceRateLimit({
      key: `auth:verify-otp:ip:${ip}:${type}:${normalizedTarget}`,
      limit: 10,
      windowSeconds: 600,
    });
    if (!rlByIp.ok) return rlByIp.response;

    const rlByTarget = await enforceRateLimit({
      key: `auth:verify-otp:target:${type}:${normalizedTarget}`,
      limit: 20,
      windowSeconds: 600,
    });
    if (!rlByTarget.ok) return rlByTarget.response;

    // Verify OTP from Redis
    const isValid = await verifyOTP(type, normalizedTarget, otp);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid or expired OTP' },
        { status: 400 }
      );
    }

    // Clear rate limit attempts on success
    await clearOTPAttempts(type, normalizedTarget);

    const verificationToken = await issueOTPVerificationToken(
      type,
      normalizedTarget,
      purpose,
    );

    return NextResponse.json({
      success: true,
      verified: true,
      type,
      target: normalizedTarget,
      purpose,
      token: verificationToken,
      expiresIn: 900,
    });
  } catch (e) {
    console.error('Verify OTP error:', e);
    return NextResponse.json(
      { error: 'Service unavailable' },
      { status: 503 }
    );
  }
}

