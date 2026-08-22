import { NextRequest, NextResponse } from 'next/server';
import {
  forwardSetCookieHeaders,
  readSetCookiesFromFetchResponse,
  shouldUseSecureCookies,
} from '@/lib/server/forwardCookies';
import { authSecurityHeaders, enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { isLoginOtpRequired } from '@/lib/auth/runtimeConfig';
import { verifyCaptchaToken } from '@/lib/captcha';
import { enforceRateLimit } from '@/lib/rateLimit';
import {
  consumeOTPVerificationTokenForPurposes,
  hasOTPVerificationTokenForPurposes,
} from '@/lib/redis';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { z } from 'zod';

const API_URL = process.env.INTERNAL_API_URL || 'http://identity_service:8080';
const LOGIN_RATE_LIMIT_PER_15_MIN = Number.parseInt(
  process.env.LOGIN_RATE_LIMIT_PER_15_MIN || '15',
  10,
);
const LOGIN_USERNAME_RATE_LIMIT_PER_15_MIN = Number.parseInt(
  process.env.LOGIN_USERNAME_RATE_LIMIT_PER_15_MIN || '5',
  10,
);
const LOGIN_OTP_REQUIRED = isLoginOtpRequired();

const optionalTrimmedString = z.preprocess((value) => {
  if (value == null) return undefined;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}, z.string().min(1).optional());

const LoginProxySchema = z.object({
  username: optionalTrimmedString,
  identifier: optionalTrimmedString,
  email: optionalTrimmedString,
  phone: optionalTrimmedString,
  password: z.string().min(1),
  captcha_token: optionalTrimmedString,
  captchaToken: optionalTrimmedString,
  otp_type: z.enum(['email', 'phone']).optional(),
  otpType: z.enum(['email', 'phone']).optional(),
  otp_target: optionalTrimmedString,
  otpTarget: optionalTrimmedString,
  otp_token: optionalTrimmedString,
  otpToken: optionalTrimmedString,
  email_otp_token: optionalTrimmedString,
  emailOtpToken: optionalTrimmedString,
  phone_otp_token: optionalTrimmedString,
  phoneOtpToken: optionalTrimmedString,
}).passthrough();

function normalizeLoginIdentifier(value: string): string {
  return value.trim().trimStart().replace(/^@+/, '').toLowerCase();
}

function normalizeOtpTarget(type: 'email' | 'phone', value: string): string {
  if (type === 'email') return value.trim().toLowerCase();
  return value.replace(/\D/g, '');
}

function readStringField(
  source: Record<string, unknown> | undefined,
  keys: string[],
): string {
  if (!source) return '';
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

async function loginOtpMatchesAuthenticatedUser(
  accessToken: string,
  type: 'email' | 'phone',
  target: string,
  security: Awaited<ReturnType<typeof enforceAuthRouteSecurity>> & { ok: true },
): Promise<boolean> {
  const meRes = await fetch(`${API_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...authSecurityHeaders(security),
    },
  });
  const user = (await meRes.json().catch(() => ({}))) as Record<string, unknown>;
  if (!meRes.ok) return false;

  const expected = normalizeOtpTarget(type, target);
  const actual = normalizeOtpTarget(
    type,
    readStringField(user, type === 'email' ? ['email'] : ['phone']),
  );
  return Boolean(actual && actual === expected);
}

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
    const identifier = normalizeLoginIdentifier(
      body.username || body.identifier || body.email || '',
    );
    const captchaToken = body.captcha_token || body.captchaToken;
    const otpType =
      body.otp_type ||
      body.otpType ||
      (body.phone_otp_token || body.phoneOtpToken ? 'phone' : 'email');
    const otpTarget = normalizeOtpTarget(
      otpType,
      body.otp_target ||
        body.otpTarget ||
        (otpType === 'email' ? body.email || identifier : body.phone || ''),
    );
    const otpToken =
      body.otp_token ||
      body.otpToken ||
      (otpType === 'email'
        ? body.email_otp_token || body.emailOtpToken
        : body.phone_otp_token || body.phoneOtpToken);
    const ip = security.ip;

    if (!identifier) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 },
      );
    }

    const loginRateByIp = await enforceRateLimit({
      key: `auth:login:ip:${ip}`,
      limit: LOGIN_RATE_LIMIT_PER_15_MIN,
      windowSeconds: 900,
    });
    if (!loginRateByIp.ok) return loginRateByIp.response;

    const loginRateByUsername = await enforceRateLimit({
      key: `auth:login:username:${identifier}`,
      limit: LOGIN_USERNAME_RATE_LIMIT_PER_15_MIN,
      windowSeconds: 900,
    });
    if (!loginRateByUsername.ok) return loginRateByUsername.response;

    const captcha = await verifyCaptchaToken({
      token: captchaToken,
      ip,
      action: 'other',
    });
    if (!captcha.ok) {
      return NextResponse.json(
        { error: captcha.error },
        { status: 400 },
      );
    }

    if (LOGIN_OTP_REQUIRED) {
      if (!otpTarget || !otpToken) {
        return NextResponse.json(
          { error: 'OTP verification is required for login' },
          { status: 401 },
        );
      }

      const validOtpToken = await hasOTPVerificationTokenForPurposes(
        otpToken,
        { type: otpType, target: otpTarget },
        ['login'],
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
      body: JSON.stringify({ username: identifier, password: body.password }),
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

    if (LOGIN_OTP_REQUIRED) {
      const authData = data as Record<string, unknown>;
      const accessToken =
        typeof authData.access_token === 'string' ? authData.access_token : '';
      const contactMatches = await loginOtpMatchesAuthenticatedUser(
        accessToken,
        otpType,
        otpTarget,
        security,
      );
      if (!contactMatches) {
        return NextResponse.json(
          { error: 'OTP target does not match this account' },
          { status: 401 },
        );
      }

      const consumed = await consumeOTPVerificationTokenForPurposes(
        otpToken || '',
        { type: otpType, target: otpTarget },
        ['login'],
      );
      if (!consumed) {
        return NextResponse.json(
          { error: 'Invalid or expired login OTP verification token' },
          { status: 401 },
        );
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
    console.error('[AUTH_LOGIN_PROXY_ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}


