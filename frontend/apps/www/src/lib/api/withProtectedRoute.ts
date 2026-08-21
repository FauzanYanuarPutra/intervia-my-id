import { NextRequest, NextResponse } from 'next/server';
import { authSecurityHeaders, enforceAuthRouteSecurity } from '@/lib/authSecurity';
import type { AuthSecurityResult } from '@/lib/authSecurity';
import { requireAuth } from '@/lib/serverAuth';

export type ProtectedRouteContext = {
  token: string;
  userId: string;
  roles: string[];
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

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  return handler({
    token: auth.ctx.token,
    userId: auth.ctx.userId,
    roles: auth.ctx.roles,
    security,
  });
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
