import { NextRequest, NextResponse } from 'next/server';
import {
  forwardSetCookieHeaders,
  readSetCookiesFromFetchResponse,
  shouldUseSecureCookies,
} from '@/lib/server/forwardCookies';
import { authSecurityHeaders, enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { isRegisterOtpRequired } from '@/lib/auth/runtimeConfig';
import { verifyCaptchaToken } from '@/lib/captcha';
import {
  passwordContainsIdentityHint,
  validatePasswordStrength,
} from '@/lib/passwordPolicy';
import { enforceRateLimit } from '@/lib/rateLimit';
import {
  consumeOTPVerificationTokenForPurposes,
  hasOTPVerificationTokenForPurposes,
} from '@/lib/redis';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { z } from 'zod';

const API_URL = process.env.INTERNAL_API_URL || 'http://identity_service:8080';
const REGISTER_RATE_LIMIT_PER_HOUR = Number.parseInt(
  process.env.REGISTER_RATE_LIMIT_PER_HOUR || '12',
  10,
);
const REGISTER_USERNAME_RATE_LIMIT_PER_HOUR = Number.parseInt(
  process.env.REGISTER_USERNAME_RATE_LIMIT_PER_HOUR || '3',
  10,
);
const REGISTER_OTP_REQUIRED = isRegisterOtpRequired();

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
}, z.string().min(8).optional());

const RegisterProxySchema = z
  .object({
    username: z.preprocess(
      (value) => String(value ?? '').trim().replace(/^@+/, '').toLowerCase(),
      z.string().min(3).max(30),
    ),
    password: z.string().min(1).max(256),
    phone: normalizedPhoneString,
    phone_number: optionalTrimmedString,
    phoneNumber: optionalTrimmedString,
    email: optionalEmailString,
    full_name: optionalTrimmedString,
    fullName: optionalTrimmedString,
    name: optionalTrimmedString,
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

function normalizeOtpTarget(type: 'email' | 'phone', value: string): string {
  if (type === 'email') return value.trim().toLowerCase();
  return value.replace(/\D/g, '');
}

async function applyVerifiedContactMetadata(
  accessToken: string,
  security: { ip: string; deviceFingerprint: string },
  contact: { type: 'email' | 'phone'; target: string },
) {
  if (!accessToken || !contact.target) return;

  const verification =
    contact.type === 'phone'
      ? { phone_verified: true }
      : { email_verified: true };

  await fetch(`${API_URL}/users/me`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...authSecurityHeaders(security),
    },
    body: JSON.stringify({
      ...(contact.type === 'phone' ? { phone: contact.target } : {}),
      verification,
    }),
  }).catch(error => {
    console.warn('[REGISTER_VERIFY_CONTACT_METADATA_FAILED]', error);
  });
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
    const username = body.username;
    const captchaToken = body.captcha_token || body.captchaToken;
    const otpType =
      body.otp_type ||
      body.otpType ||
      (phone || body.phone_otp_token || body.phoneOtpToken ? 'phone' : 'email');
    const otpTarget = normalizeOtpTarget(
      otpType,
      body.otp_target ||
        body.otpTarget ||
        (otpType === 'email' ? email || '' : phone),
    );
    const otpToken =
      body.otp_token ||
      body.otpToken ||
      (otpType === 'email'
        ? body.email_otp_token || body.emailOtpToken
        : body.phone_otp_token || body.phoneOtpToken);

    if (!/^[a-z0-9_.]{3,30}$/.test(username) || username.includes('..')) {
      return NextResponse.json(
        { error: 'Username format is invalid' },
        { status: 400 },
      );
    }

    const passwordPolicyError = validatePasswordStrength(body.password);
    if (passwordPolicyError) {
      return NextResponse.json(
        { error: passwordPolicyError },
        { status: 400 },
      );
    }

    if (passwordContainsIdentityHint(body.password, [username, fullName])) {
      return NextResponse.json(
        { error: 'Password cannot contain username or name' },
        { status: 400 },
      );
    }

    const registerRateByIp = await enforceRateLimit({
      key: `auth:register:ip:${ip}`,
      limit: REGISTER_RATE_LIMIT_PER_HOUR,
      windowSeconds: 3600,
    });
    if (!registerRateByIp.ok) return registerRateByIp.response;

    const registerRateByUsername = await enforceRateLimit({
      key: `auth:register:username:${username}`,
      limit: REGISTER_USERNAME_RATE_LIMIT_PER_HOUR,
      windowSeconds: 3600,
    });
    if (!registerRateByUsername.ok) return registerRateByUsername.response;

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

    if (REGISTER_OTP_REQUIRED) {
      if (!otpTarget || !otpToken) {
        return NextResponse.json(
          { error: 'OTP verification is required for registration' },
          { status: 401 },
        );
      }

      const validOtpToken = await hasOTPVerificationTokenForPurposes(
        otpToken,
        { type: otpType, target: otpTarget },
        ['register', 'login'],
      );
      if (!validOtpToken) {
        return NextResponse.json(
          { error: 'Invalid or expired registration OTP verification token' },
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
        username,
        password: body.password,
        ...(phone ? { phone } : {}),
        email,
        full_name: fullName,
      }),
    });

    const data = await readJsonResponse(backendRes);

    if (!backendRes.ok) {
      return NextResponse.json(data, { status: backendRes.status });
    }

    if (REGISTER_OTP_REQUIRED) {
      const consumed = await consumeOTPVerificationTokenForPurposes(
        otpToken || '',
        { type: otpType, target: otpTarget },
        ['register', 'login'],
      );
      if (!consumed) {
        return NextResponse.json(
          { error: 'Invalid or expired registration OTP verification token' },
          { status: 401 },
        );
      }

      const accessToken =
        typeof data.access_token === 'string' ? data.access_token : '';
      await applyVerifiedContactMetadata(accessToken, security, {
        type: otpType,
        target: otpTarget,
      });
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
