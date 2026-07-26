import { NextRequest, NextResponse } from 'next/server';
import {
  deleteOTP,
  getOTPAttempts,
  incrementOTPAttempts,
  storeOTP,
} from '@/lib/redis';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { sendOTPEmail } from '@/lib/email';
import { sendPhoneOTP } from '@/lib/sms';
import { enforceRateLimit } from '@/lib/rateLimit';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { createHash, randomInt } from 'node:crypto';
import { maskEmail, maskPhone, safeErrorCode } from '@/lib/server/safeLog';
import { z } from 'zod';

const APP_ENV = process.env.ENV || process.env.APP_ENV || process.env.NODE_ENV;
const IS_DEV = APP_ENV === 'development';
const OTP_LIMIT_PER_TARGET_PER_HOUR = Number.parseInt(
  process.env.OTP_LIMIT_PER_TARGET_PER_HOUR || '5',
  10,
);
const OTP_LIMIT_PER_IP_PER_HOUR = Number.parseInt(
  process.env.OTP_LIMIT_PER_IP_PER_HOUR || '30',
  10,
);
const OTP_AUTH_ENABLED = process.env.ENABLE_OTP_AUTH !== 'false';

const SendOtpSchema = z.object({
  type: z.enum(['email', 'phone']),
  target: z.string().trim().min(1).max(320),
  purpose: z.enum(['register', 'login', 'reset', 'profile']).default('register'),
});

function generateOTP(): string {
  return randomInt(100000, 1_000_000).toString();
}

function normalizeTarget(type: 'email' | 'phone', target: string): string {
  if (type === 'email') return target.trim().toLowerCase();
  return target.replace(/\D/g, '');
}

function maskTarget(type: 'email' | 'phone', target: string): string {
  return type === 'email' ? maskEmail(target) : maskPhone(target);
}

function validateTarget(type: 'email' | 'phone', target: string): boolean {
  if (type === 'email') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target);
  }
  return target.length >= 10;
}

export async function POST(req: NextRequest) {
  try {
    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'send-otp',
      ipLimit: 240,
      deviceLimit: 180,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const parsed = await parseJsonBodyWithSchema(req, SendOtpSchema);
    if (!parsed.ok) return parsed.response;

    const { type, target, purpose } = parsed.data;
    const normalizedTarget = normalizeTarget(type, target);

    if (!OTP_AUTH_ENABLED && (purpose === 'register' || purpose === 'login')) {
      return NextResponse.json(
        { error: 'OTP login/register is disabled. Use username and password.' },
        { status: 410 },
      );
    }

    if (!validateTarget(type, normalizedTarget)) {
      return NextResponse.json(
        { error: type === 'email' ? 'Invalid email address' : 'Invalid phone number' },
        { status: 400 },
      );
    }

    const ip = security.ip;
    const rlByIp = await enforceRateLimit({
      key: `auth:send-otp:ip:${ip}:${purpose}`,
      limit: OTP_LIMIT_PER_IP_PER_HOUR,
      windowSeconds: 3600,
    });
    if (!rlByIp.ok) return rlByIp.response;

    const rlByTarget = await enforceRateLimit({
      key: `auth:send-otp:target:${type}:${createHash('sha256').update(normalizedTarget).digest('hex').slice(0, 24)}:${purpose}`,
      limit: OTP_LIMIT_PER_TARGET_PER_HOUR,
      windowSeconds: 3600,
    });
    if (!rlByTarget.ok) return rlByTarget.response;

    const attempts = await getOTPAttempts(type, normalizedTarget);
    if (attempts >= OTP_LIMIT_PER_TARGET_PER_HOUR) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429 },
      );
    }

    const otp = generateOTP();
    await storeOTP(type, normalizedTarget, otp);

    const phoneDelivery =
      type === 'phone' ? await sendPhoneOTP(normalizedTarget, otp) : null;
    const sent =
      type === 'email'
        ? await sendOTPEmail(normalizedTarget, otp)
        : Boolean(phoneDelivery?.ok);

    if (!sent) {
      await deleteOTP(type, normalizedTarget);
      console.error('OTP delivery failed', {
        type,
        target: maskTarget(type, normalizedTarget),
        purpose,
      });
      return NextResponse.json(
        { error: 'Failed to send OTP. Please try again.' },
        { status: 503 },
      );
    }

    await incrementOTPAttempts(type, normalizedTarget);

    const emailTransport =
      process.env.EMAIL_TRANSPORT ||
      (process.env.SMTP_HOST
        ? 'smtp'
        : IS_DEV && process.env.DEV_EMAIL_FALLBACK_TO_CONSOLE === 'true'
          ? 'console'
          : 'unavailable');
    const delivery =
      type === 'email' ? emailTransport : phoneDelivery?.delivery || 'phone';

    return NextResponse.json({
      success: true,
      message: `OTP sent to ${type === 'email' ? 'email' : 'whatsapp'}`,
      purpose,
      delivery,
    });
  } catch (e) {
    console.error('Send OTP error:', { error: safeErrorCode(e) });
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}

