import { NextRequest, NextResponse } from 'next/server';
import { authSecurityHeaders, enforceAuthRouteSecurity } from '@/lib/authSecurity';
import type { AuthSecurityResult } from '@/lib/authSecurity';
import { errorResponse } from '@/lib/api/errorResponse';

export type ProtectedRouteContext = {
  token: string;
  security: Extract<AuthSecurityResult, { ok: true }>;
};

export async function withProtectedRoute(
  req: NextRequest,
  options: {
    routeKey: string;
    ipLimit: number;
    deviceLimit?: number;
    windowSeconds: number;
  },
  handler: (ctx: ProtectedRouteContext) => Promise<NextResponse>,
): Promise<NextResponse> {
  const security = await enforceAuthRouteSecurity(req, options);
  if (!security.ok) return security.response;

  const bearerToken = req.headers.get('authorization')?.replace('Bearer ', '').trim();
  const cookieToken = req.cookies.get('access_token')?.value?.trim();
  const preferCookie = process.env.NODE_ENV === 'production';
  const token = preferCookie
    ? cookieToken || bearerToken
    : bearerToken || cookieToken;

  if (!token) {
    return errorResponse(401, 'Unauthorized');
  }

  return handler({ token, security });
}

export function buildForwardAuthHeaders(
  ctx: ProtectedRouteContext,
  extraHeaders?: Record<string, string>,
): Record<string, string> {
  return {
    Authorization: `Bearer ${ctx.token}`,
    ...authSecurityHeaders(ctx.security),
    ...(extraHeaders || {}),
  };
}
