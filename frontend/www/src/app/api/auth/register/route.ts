import { NextRequest, NextResponse } from 'next/server';
import {
  forwardSetCookieHeaders,
  readSetCookiesFromFetchResponse,
  shouldUseSecureCookies,
} from '@/lib/server/forwardCookies';
import { authSecurityHeaders, enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { verifyCaptchaToken } from '@/lib/captcha';
import {
  consumeOTPVerificationTokenForPurposes,
  hasOTPVerificationTokenForPurposes,
} from '@/lib/redis';
import { enforceRateLimit } from '@/lib/rateLimit';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { z } from 'zod';

const API_URL = process.env.INTERNAL_API_URL || 'http://identity_service:8080';
const REGISTER_PHONE_OTP_REQUIRED =
  process.env.REGISTER_PHONE_OTP_REQUIRED !== 'false';
const REGISTER_RATE_LIMIT_PER_HOUR = Number.parseInt(
  process.env.REGISTER_RATE_LIMIT_PER_HOUR || '20',
  10,
);
const REGISTER_PHONE_RATE_LIMIT_PER_HOUR = Number.parseInt(
  process.env.REGISTER_PHONE_RATE_LIMIT_PER_HOUR || '5',
  10,
);

const optionalTrimmedString = z.preprocess((value) => {
  if (value == null) return undefined;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}, z.string().min(1).optional());

const optionalEmailString = z.preprocess((value) => {
  if (value == null) return undefined;
  const normalized = String(value).trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}, z.string().email().optional());

const normalizedPhoneString = z.preprocess((value) => {
  const normalized = String(value ?? '').replace(/\D/g, '');
  return normalized.length > 0 ? normalized : undefined;
}, z.string().min(8));

const RegisterProxySchema = z
  .object({
    phone: normalizedPhoneString,
    phone_number: optionalTrimmedString,
    phoneNumber: optionalTrimmedString,
    email: optionalEmailString,
    full_name: optionalTrimmedString,
    fullName: optionalTrimmedString,
    name: optionalTrimmedString,
    username: optionalTrimmedString,
    phone_otp_token: optionalTrimmedString,
    phoneOtpToken: optionalTrimmedString,
    captcha_token: optionalTrimmedString,
    captchaToken: optionalTrimmedString,
  })
  .passthrough();

async function readJsonResponse(
  response: Response,
): Promise<Record<string, unknown>> {
  const text = await response.text();
  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function createAuthProxySuccessResponse(
  req: NextRequest,
  backendRes: Response,
  data: Record<string, unknown>,
) {
  const response = NextResponse.json(data);
  const secure = shouldUseSecureCookies(req);

  forwardSetCookieHeaders(
    response,
    readSetCookiesFromFetchResponse(backendRes),
    {
      secure,
    },
  );
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
}

export async function POST(req: NextRequest) {
  try {
    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'register',
      ipLimit: 120,
      deviceLimit: 80,
      windowSeconds: 900,
    });
    if (!security.ok) return security.response;

    const parsed = await parseJsonBodyWithSchema(req, RegisterProxySchema);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: 'Invalid registration payload' },
        { status: 400 },
      );
    }

    const body = parsed.data;
    const ip = security.ip;
    const phone =
      body.phone ||
      body.phone_number?.replace(/\D/g, '') ||
      body.phoneNumber?.replace(/\D/g, '') ||
      '';
    const email = body.email;
    const fullName = body.full_name || body.fullName || body.name;
    const phoneOtpToken = body.phone_otp_token || body.phoneOtpToken;
    const captchaToken = body.captcha_token || body.captchaToken;

    if (phone.length < 8) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 },
      );
    }

    const registerRateByIp = await enforceRateLimit({
      key: `auth:register:ip:${ip}`,
      limit: REGISTER_RATE_LIMIT_PER_HOUR,
      windowSeconds: 3600,
    });
    if (!registerRateByIp.ok) return registerRateByIp.response;

    const registerRateByPhone = await enforceRateLimit({
      key: `auth:register:phone:${phone}`,
      limit: REGISTER_PHONE_RATE_LIMIT_PER_HOUR,
      windowSeconds: 3600,
    });
    if (!registerRateByPhone.ok) return registerRateByPhone.response;

    const captcha = await verifyCaptchaToken({
      token: captchaToken,
      ip,
      action: 'register',
    });
    if (!captcha.ok) {
      return NextResponse.json(
        { error: captcha.error },
        { status: 400 },
      );
    }

    if (REGISTER_PHONE_OTP_REQUIRED && !phoneOtpToken) {
      return NextResponse.json(
        { error: 'Phone OTP verification is required for registration' },
        { status: 401 },
      );
    }

    if (phoneOtpToken) {
      const validPhoneVerification =
        await hasOTPVerificationTokenForPurposes(
          phoneOtpToken,
          {
            type: 'phone',
            target: phone,
          },
          ['register', 'login'],
        );
      if (!validPhoneVerification) {
        return NextResponse.json(
          { error: 'Phone OTP verification is invalid or expired' },
          { status: 401 },
        );
      }
    }

    const backendRes = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authSecurityHeaders(security),
      },
      body: JSON.stringify({
        phone,
        email,
        full_name: fullName,
        username: body.username,
      }),
    });

    const data = await readJsonResponse(backendRes);
    const normalizedError =
      typeof data.error === 'string' ? data.error.toLowerCase() : '';

    if (!backendRes.ok) {
      const canRecoverByPhoneLogin =
        Boolean(phoneOtpToken) &&
        (backendRes.status === 409 ||
          normalizedError.includes('already registered') ||
          normalizedError.includes('already exists') ||
          normalizedError.includes('duplicate'));

      if (canRecoverByPhoneLogin) {
        const recoveryLoginRes = await fetch(`${API_URL}/auth/login-phone`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authSecurityHeaders(security),
          },
          body: JSON.stringify({ phone }),
        });

        const recoveryData = await readJsonResponse(recoveryLoginRes);

        if (recoveryLoginRes.ok) {
          if (phoneOtpToken) {
            await consumeOTPVerificationTokenForPurposes(
              phoneOtpToken,
              {
                type: 'phone',
                target: phone,
              },
              ['register', 'login'],
            );
          }

          return createAuthProxySuccessResponse(req, recoveryLoginRes, {
            ...recoveryData,
            recovery_action: 'login',
            recovered_from: 'duplicate_register',
          });
        }

        return NextResponse.json(
          {
            ...data,
            next_step: 'login',
            recovery_action: 'login_required',
          },
          { status: backendRes.status },
        );
      }

      return NextResponse.json(data, { status: backendRes.status });
    }

    if (phoneOtpToken) {
      await consumeOTPVerificationTokenForPurposes(
        phoneOtpToken,
        {
          type: 'phone',
          target: phone,
        },
        ['register', 'login'],
      );
    }

    return createAuthProxySuccessResponse(req, backendRes, {
      ...data,
      recovery_action: 'register',
    });
  } catch (error) {
    console.error('[REGISTER_PROXY_ERROR]', error);
    return NextResponse.json(
      { error: 'Registration service temporarily unavailable' },
      { status: 503 },
    );
  }
}
