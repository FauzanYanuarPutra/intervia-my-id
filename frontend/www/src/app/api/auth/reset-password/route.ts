import { NextRequest, NextResponse } from 'next/server';
import { clearOTPAttempts, getRedis, verifyOTP } from '@/lib/redis';
import { authSecurityHeaders, enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { validatePasswordStrength } from '@/lib/passwordPolicy';
import { safeErrorCode } from '@/lib/server/safeLog';
import crypto from 'node:crypto';
import { SignJWT } from 'jose';
import { z } from 'zod';

const API_URL = process.env.INTERNAL_API_URL || 'http://identity_service:8080';

const ResetWithLinkSchema = z.object({
  mode: z.literal('link').default('link'),
  token: z.string().min(1),
  password: z.string().min(1).max(256),
});

const ResetWithOtpSchema = z.object({
  mode: z.literal('otp'),
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/),
  password: z.string().min(1).max(256),
});

const ResetPasswordSchema = z.union([ResetWithLinkSchema, ResetWithOtpSchema]);

const RESET_PROOF_AUDIENCE = 'identity-reset';

async function buildResetProof(email: string): Promise<string | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    purpose: 'password_reset',
    email,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(email)
    .setAudience(RESET_PROOF_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + 5 * 60)
    .sign(new TextEncoder().encode(secret));
}

export async function POST(req: NextRequest) {
  try {
    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'reset-password',
      ipLimit: 80,
      deviceLimit: 50,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const parsed = await parseJsonBodyWithSchema(req, ResetPasswordSchema);
    if (!parsed.ok) return parsed.response;

    const ip = security.ip;
    const rateLimitTarget =
      parsed.data.mode === 'otp' ? parsed.data.email : parsed.data.token;
    const opaqueRateLimitTarget = crypto
      .createHash('sha256')
      .update(rateLimitTarget.trim().toLowerCase())
      .digest('hex')
      .slice(0, 24);
    const rl = await enforceRateLimit({
      key: `auth:reset-password:${ip}:${opaqueRateLimitTarget}`,
      limit: 10,
      windowSeconds: 3600,
    });
    if (!rl.ok) return rl.response;

    let email: string | null = null;
    const password = parsed.data.password;
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return NextResponse.json(
        { error: passwordError },
        { status: 400 },
      );
    }

    if (parsed.data.mode === 'otp') {
      email = parsed.data.email.trim().toLowerCase();
      const validOtp = await verifyOTP('email', email, parsed.data.otp.trim());
      if (!validOtp) {
        return NextResponse.json(
          { error: 'Invalid or expired OTP code' },
          { status: 400 },
        );
      }
      await clearOTPAttempts('email', email);
    } else {
      const redis = getRedis();
      email = await redis.getdel(`reset:${parsed.data.token}`);
      if (!email) {
        return NextResponse.json(
          { error: 'Invalid or expired reset token' },
          { status: 400 }
        );
      }
    }

    if (!email) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    const resetProof = await buildResetProof(email);
    if (!resetProof) {
      return NextResponse.json(
        { error: 'Reset service is not configured' },
        { status: 503 },
      );
    }

    // Call identity service to update password
    const res = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authSecurityHeaders(security),
      },
      body: JSON.stringify({ email, password, reset_proof: resetProof }),
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            res.status === 400 || res.status === 401
              ? 'Invalid password reset request'
              : 'Failed to reset password',
        },
        { status: res.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully',
    });
  } catch (e) {
    console.error('Reset password error:', { error: safeErrorCode(e) });
    return NextResponse.json(
      { error: 'Service unavailable' },
      { status: 503 }
    );
  }
}

