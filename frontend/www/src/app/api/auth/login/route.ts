import { NextRequest, NextResponse } from 'next/server';
import {
  forwardSetCookieHeaders,
  readSetCookiesFromFetchResponse,
  shouldUseSecureCookies,
} from '@/lib/server/forwardCookies';
import { authSecurityHeaders, enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { consumeOTPVerificationToken } from '@/lib/redis';
import { enforceRateLimit } from '@/lib/rateLimit';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { z } from 'zod';

const API_URL = process.env.INTERNAL_API_URL || 'http://identity_service:8080';
const LOGIN_OTP_REQUIRED = process.env.LOGIN_OTP_REQUIRED === 'true';
const LOGIN_RATE_LIMIT_PER_15_MIN = Number.parseInt(
  process.env.LOGIN_RATE_LIMIT_PER_15_MIN || '20',
  10,
);
const LOGIN_EMAIL_RATE_LIMIT_PER_15_MIN = Number.parseInt(
  process.env.LOGIN_EMAIL_RATE_LIMIT_PER_15_MIN || '10',
  10,
);

const optionalTrimmedString = z.preprocess((value) => {
  if (value == null) return undefined;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}, z.string().min(1).optional());

const LoginProxySchema = z.object({
  email: z.preprocess(
    (value) => String(value ?? '').trim().toLowerCase(),
    z.string().email(),
  ),
  password: z.string().min(1),
  email_otp_token: optionalTrimmedString,
  emailOtpToken: optionalTrimmedString,
}).passthrough();

export async function POST(req: NextRequest) {
  try {
    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'login',
      ipLimit: 180,
      deviceLimit: 120,
      windowSeconds: 900,
    });
    if (!security.ok) return security.response;

    const parsed = await parseJsonBodyWithSchema(req, LoginProxySchema);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: 'Invalid login payload' },
        { status: 400 },
      );
    }

    const body = parsed.data;
    const email = body.email;
    const emailOtpToken = body.email_otp_token || body.emailOtpToken;
    const ip = security.ip;

    const loginRateByIp = await enforceRateLimit({
      key: `auth:login:ip:${ip}`,
      limit: LOGIN_RATE_LIMIT_PER_15_MIN,
      windowSeconds: 900,
    });
    if (!loginRateByIp.ok) return loginRateByIp.response;

    const loginRateByEmail = await enforceRateLimit({
      key: `auth:login:email:${email}`,
      limit: LOGIN_EMAIL_RATE_LIMIT_PER_15_MIN,
      windowSeconds: 900,
    });
    if (!loginRateByEmail.ok) return loginRateByEmail.response;

    if (LOGIN_OTP_REQUIRED) {
      if (!emailOtpToken) {
        return NextResponse.json(
          { error: 'Email OTP verification is required for login' },
          { status: 401 },
        );
      }

      const validOtpToken = await consumeOTPVerificationToken(
        emailOtpToken,
        {
          type: 'email',
          target: email,
          purpose: 'login',
        },
      );
      if (!validOtpToken) {
        return NextResponse.json(
          { error: 'Invalid or expired login OTP verification token' },
          { status: 401 },
        );
      }
    }

    const backendRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authSecurityHeaders(security),
      },
      body: JSON.stringify({ email, password: body.password }),
    });

    const text = await backendRes.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: 'Invalid response from auth service' };
    }

    if (!backendRes.ok) {
      return NextResponse.json(data, { status: backendRes.status });
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
    console.error('[AUTH_LOGIN_PROXY_ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}


