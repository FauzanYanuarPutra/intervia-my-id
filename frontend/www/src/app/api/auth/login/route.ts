import { NextRequest, NextResponse } from 'next/server';
import {
  forwardSetCookieHeaders,
  readSetCookiesFromFetchResponse,
  shouldUseSecureCookies,
} from '@/lib/server/forwardCookies';
import { authSecurityHeaders, enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { verifyCaptchaToken } from '@/lib/captcha';
import { enforceRateLimit } from '@/lib/rateLimit';
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

const optionalTrimmedString = z.preprocess((value) => {
  if (value == null) return undefined;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}, z.string().min(1).optional());

const LoginProxySchema = z.object({
  username: optionalTrimmedString,
  identifier: optionalTrimmedString,
  email: optionalTrimmedString,
  password: z.string().min(1),
  captcha_token: optionalTrimmedString,
  captchaToken: optionalTrimmedString,
}).passthrough();

function normalizeLoginIdentifier(value: string): string {
  return value.trim().trimStart().replace(/^@+/, '').toLowerCase();
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


