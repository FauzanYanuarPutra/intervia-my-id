import { NextRequest, NextResponse } from 'next/server';
import {
  authSecurityHeaders,
  enforceAuthRouteSecurity,
} from '@/lib/authSecurity';
import { hasOTPVerificationTokenForPurposes } from '@/lib/redis';
import { enforceRateLimit } from '@/lib/rateLimit';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { z } from 'zod';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8080';

const optionalTrimmedString = z.preprocess((value) => {
  if (value == null) return undefined;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}, z.string().min(1).optional());

const VerifyPhoneSchema = z
  .object({
    phone: optionalTrimmedString,
    phone_number: optionalTrimmedString,
    phoneNumber: optionalTrimmedString,
    phone_otp_token: optionalTrimmedString,
    phoneOtpToken: optionalTrimmedString,
  })
  .passthrough();

export async function POST(req: NextRequest) {
  try {
    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'verify-phone',
      ipLimit: 120,
      deviceLimit: 90,
      windowSeconds: 900,
    });
    if (!security.ok) return security.response;

    const token =
      req.headers.get('authorization')?.replace('Bearer ', '') ||
      req.cookies.get('access_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = await parseJsonBodyWithSchema(req, VerifyPhoneSchema);
    if (!parsed.ok) return parsed.response;

    const phoneRaw =
      parsed.data.phone ||
      parsed.data.phone_number ||
      parsed.data.phoneNumber ||
      '';
    const normalizedPhone = phoneRaw.replace(/\D/g, '');
    const phoneOtpToken =
      parsed.data.phone_otp_token || parsed.data.phoneOtpToken || '';

    if (normalizedPhone.length < 8) {
      return NextResponse.json(
        { error: 'Invalid phone number' },
        { status: 400 },
      );
    }

    if (!phoneOtpToken) {
      return NextResponse.json(
        { error: 'Phone OTP verification token is required' },
        { status: 400 },
      );
    }

    const ip = security.ip;
    const rl = await enforceRateLimit({
      key: `auth:verify-phone:${ip}:${normalizedPhone}`,
      limit: 12,
      windowSeconds: 900,
    });
    if (!rl.ok) return rl.response;

    const validVerification = await hasOTPVerificationTokenForPurposes(
      phoneOtpToken,
      {
        type: 'phone',
        target: normalizedPhone,
      },
      ['profile'],
    );

    if (!validVerification) {
      return NextResponse.json(
        { error: 'Invalid or expired phone OTP verification token' },
        { status: 401 },
      );
    }

    const res = await fetch(`${API_URL}/users/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...authSecurityHeaders(security),
      },
      body: JSON.stringify({
        phone: normalizedPhone,
        phone_otp_token: phoneOtpToken,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to verify phone number' },
        { status: res.status },
      );
    }

    return NextResponse.json({
      success: true,
      phone: normalizedPhone,
      verification: {
        ...(typeof data.verification === 'object' && data.verification
          ? (data.verification as Record<string, unknown>)
          : {}),
        phone_verified: true,
      },
      user: data,
    });
  } catch (error) {
    console.error('Verify phone error:', error);
    return NextResponse.json(
      { error: 'Service unavailable' },
      { status: 503 },
    );
  }
}
