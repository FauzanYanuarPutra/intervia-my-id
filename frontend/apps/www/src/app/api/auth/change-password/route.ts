import { NextRequest, NextResponse } from 'next/server';
import { authSecurityHeaders, enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { validatePasswordStrength } from '@/lib/passwordPolicy';
import { enforceRateLimit } from '@/lib/rateLimit';
import { parseJsonBodyWithSchema } from '@/lib/serverRequest';
import { safeErrorCode } from '@/lib/server/safeLog';
import { requireAuth } from '@/lib/serverAuth';
import { z } from 'zod';

const API_URL = process.env.INTERNAL_API_URL || 'http://identity_service:8080';

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(1).max(256),
});

export async function POST(req: NextRequest) {
  try {
    const security = await enforceAuthRouteSecurity(req, {
      routeKey: 'change-password',
      ipLimit: 40,
      deviceLimit: 25,
      windowSeconds: 3600,
    });
    if (!security.ok) return security.response;

    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const parsed = await parseJsonBodyWithSchema(req, ChangePasswordSchema);
    if (!parsed.ok) return parsed.response;

    const { currentPassword, newPassword } = parsed.data;
    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const ip = security.ip;
    const rl = await enforceRateLimit({
      key: `auth:change-password:${ip}:${auth.ctx.userId}`,
      limit: 5,
      windowSeconds: 3600,
    });
    if (!rl.ok) return rl.response;

    // Call identity service
    const res = await fetch(`${API_URL}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.ctx.token}`,
        ...authSecurityHeaders(security),
      },
      body: JSON.stringify({
        ...(currentPassword ? { current_password: currentPassword } : {}),
        new_password: newPassword,
      }),
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            res.status === 400 || res.status === 401
              ? 'Current password is invalid'
              : 'Failed to change password',
        },
        { status: res.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (e) {
    console.error('Change password error:', { error: safeErrorCode(e) });
    return NextResponse.json(
      { error: 'Service unavailable' },
      { status: 503 }
    );
  }
}

