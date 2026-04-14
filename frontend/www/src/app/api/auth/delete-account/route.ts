import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceRateLimit } from '@/lib/rateLimit';
import { shouldUseSecureCookies, clearAuthCookies } from '@/lib/server/forwardCookies';
import { withProtectedRoute, buildForwardAuthHeaders } from '@/lib/api/withProtectedRoute';
import { withValidatedBody } from '@/lib/api/withValidatedBody';
import { errorResponse } from '@/lib/api/errorResponse';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8080';

const DeleteAccountSchema = z
  .object({
    password: z.string().min(1),
    reason: z.string().min(1).max(500).optional(),
  })
  .passthrough();

export async function DELETE(req: NextRequest) {
  try {
    const validated = await withValidatedBody(req, DeleteAccountSchema);
    if (!validated.ok) return validated.response;

    return withProtectedRoute(
      req,
      {
        routeKey: 'delete-account',
        ipLimit: 30,
        deviceLimit: 20,
        windowSeconds: 3600,
      },
      async (ctx) => {
        const rl = await enforceRateLimit({
          key: `auth:delete-account:${ctx.security.ip}`,
          limit: 3,
          windowSeconds: 3600,
        });
        if (!rl.ok) return rl.response;

        const upstream = await fetch(`${API_URL}/users/me`, {
          method: 'DELETE',
          headers: buildForwardAuthHeaders(ctx, {
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(validated.data),
        });

        if (!upstream.ok) {
          if (upstream.status === 404 || upstream.status === 405) {
            return errorResponse(
              501,
              'Account deletion is not available yet. Backend endpoint is missing.',
            );
          }
          const body = await upstream.json().catch(() => ({}));
          return errorResponse(
            upstream.status,
            (body as { error?: string }).error || 'Failed to delete account',
          );
        }

        const secure = shouldUseSecureCookies(req);
        const response = NextResponse.json({
          success: true,
          message: 'Account deleted successfully',
          shouldClearLocalAuth: true,
        });
        clearAuthCookies(response, secure);
        return response;
      },
    );
  } catch (error) {
    console.error('[DELETE_ACCOUNT_ERROR]', error);
    return errorResponse(503, 'Service unavailable');
  }
}
