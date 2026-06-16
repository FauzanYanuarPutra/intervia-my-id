import { NextRequest, NextResponse } from 'next/server';
import {
  forwardSetCookieHeaders,
  readSetCookiesFromFetchResponse,
  shouldUseSecureCookies,
} from '@/lib/server/forwardCookies';
import { authSecurityHeaders, enforceAuthRouteSecurity } from '@/lib/authSecurity';
import {
  consumeOTPVerificationTokenForPurposes,
  hasOTPVerificationTokenForPurposes,
} from '@/lib/redis';
import { enforceRateLimit } from '@/lib/rateLimit';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { z } from 'zod';

const API_URL = process.env.INTERNAL_API_URL || 'http://identity_service:8080';
const LOGIN_PHONE_OTP_REQUIRED = process.env.LOGIN_PHONE_OTP_REQUIRED !== 'false';
const LOGIN_RATE_LIMIT_PER_15_MIN = Number.parseInt(
  process.env.LOGIN_RATE_LIMIT_PER_15_MIN || '20',
  10,
);
const LOGIN_PHONE_RATE_LIMIT_PER_15_MIN = Number.parseInt(
  process.env.LOGIN_PHONE_RATE_LIMIT_PER_15_MIN || '10',
  10,
);
const PHONE_AUTH_ENABLED = process.env.ENABLE_PHONE_AUTH !== 'false';

const optionalTrimmedString = z.preprocess((value) => {
  if (value == null) return undefined;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}, z.string().min(1).optional());

const PhoneLoginProxySchema = z
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
    if (!PHONE_AUTH_ENABLED) {
      return NextResponse.json(
        { error: 'Phone login is disabled. Use username and password.' },
        { status: 410 },
      );
    }

    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'login-phone',
      ipLimit: 180,
      deviceLimit: 120,
      windowSeconds: 900,
    });
    if (!security.ok) return security.response;

    const parsed = await parseJsonBodyWithSchema(req, PhoneLoginProxySchema);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: 'Invalid phone login payload' },
        { status: 400 },
      );
    }

    const body = parsed.data;
    const phoneRaw = body.phone || body.phone_number || body.phoneNumber || '';
    const phone = phoneRaw.replace(/\D/g, '');
    const phoneOtpToken = body.phone_otp_token || body.phoneOtpToken;
    const ip = security.ip;

    if (phone.length < 8) {
      return NextResponse.json(
        { error: 'Invalid phone number' },
        { status: 400 },
      );
    }

    const loginRateByIp = await enforceRateLimit({
      key: `auth:login-phone:ip:${ip}`,
      limit: LOGIN_RATE_LIMIT_PER_15_MIN,
      windowSeconds: 900,
    });
    if (!loginRateByIp.ok) return loginRateByIp.response;

    const loginRateByPhone = await enforceRateLimit({
      key: `auth:login-phone:phone:${phone}`,
      limit: LOGIN_PHONE_RATE_LIMIT_PER_15_MIN,
      windowSeconds: 900,
    });
    if (!loginRateByPhone.ok) return loginRateByPhone.response;

    if (LOGIN_PHONE_OTP_REQUIRED) {
      if (!phoneOtpToken) {
        return NextResponse.json(
          { error: 'Phone OTP verification is required for login' },
          { status: 401 },
        );
      }

      const validOtpToken = await hasOTPVerificationTokenForPurposes(
        phoneOtpToken,
        {
          type: 'phone',
          target: phone,
        },
        ['login', 'register'],
      );
      if (!validOtpToken) {
        return NextResponse.json(
          { error: 'Invalid or expired phone login OTP verification token' },
          { status: 401 },
        );
      }
    }

    const backendRes = await fetch(`${API_URL}/auth/login-phone`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authSecurityHeaders(security),
      },
      body: JSON.stringify({ phone }),
    });

    const text = await backendRes.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      data = { error: 'Invalid response from auth service' };
    }

    const normalizedError =
      typeof data.error === 'string' ? data.error.toLowerCase() : '';

    if (!backendRes.ok) {
      if (
        normalizedError.includes('phone login is not available') ||
        backendRes.status === 404
      ) {
        return NextResponse.json(
          {
            ...data,
            next_step: 'register',
          },
          { status: 404 },
        );
      }

      return NextResponse.json(data, { status: backendRes.status });
    }

    if (LOGIN_PHONE_OTP_REQUIRED && phoneOtpToken) {
      const consumed = await consumeOTPVerificationTokenForPurposes(
        phoneOtpToken,
        {
          type: 'phone',
          target: phone,
        },
        ['login', 'register'],
      );
      if (!consumed) {
        console.warn('[AUTH_LOGIN_PHONE_OTP_ALREADY_CONSUMED]', { phone });
      }
    }

    const response = NextResponse.json(data);
    const secure = shouldUseSecureCookies(req);
    forwardSetCookieHeaders(response, readSetCookiesFromFetchResponse(backendRes), {
      secure,
    });
    response.cookies.set({
      name: 'auth_present',
      value: '1',
      path: '/',
      httpOnly: false,
      secure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    console.error('[AUTH_LOGIN_PHONE_PROXY_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
