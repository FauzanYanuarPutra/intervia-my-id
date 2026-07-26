import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';

import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth, type AuthContext } from '@/lib/serverAuth';

type UploadGuardResult =
  | { ok: true; auth: AuthContext }
  | { ok: false; response: Response };

function opaqueIpKey(req: NextRequest): string {
  return createHash('sha256')
    .update(getClientIp(req))
    .digest('hex')
    .slice(0, 20);
}

export async function guardUploadRequest(
  req: NextRequest,
  scope: string,
): Promise<UploadGuardResult> {
  const auth = await requireAuth(req);
  if (!auth.ok) return { ok: false, response: auth.res };

  const safeScope = scope.replace(/[^a-z0-9:_-]/gi, '').slice(0, 48);
  const [userLimit, ipLimit] = await Promise.all([
    enforceRateLimit({
      key: `upload:${safeScope}:user:${auth.ctx.userId}`,
      limit: 20,
      windowSeconds: 300,
      message: 'Too many uploads. Please wait before trying again.',
    }),
    enforceRateLimit({
      key: `upload:${safeScope}:ip:${opaqueIpKey(req)}`,
      limit: 40,
      windowSeconds: 300,
      message: 'Too many uploads from this network.',
    }),
  ]);

  if (!userLimit.ok) return { ok: false, response: userLimit.response };
  if (!ipLimit.ok) return { ok: false, response: ipLimit.response };
  return { ok: true, auth: auth.ctx };
}
