import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';
import { createIceServerPayload } from '@/lib/server/turnCredentials';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readTtlSeconds() {
  const value = Number(process.env.TURN_CREDENTIAL_TTL_SECONDS || 3_600);
  return Number.isFinite(value) ? value : 3_600;
}

function isEnabled(value: string | undefined) {
  return ['1', 'true', 'yes', 'on'].includes((value || '').toLowerCase());
}

function isProductionDeployment() {
  const appEnvironment = (
    process.env.APP_ENV ||
    process.env.ENV ||
    process.env.NODE_ENV ||
    ''
  ).toLowerCase();
  return appEnvironment !== 'development' && appEnvironment !== 'test';
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const networkKey = createHash('sha256')
    .update(getClientIp(req))
    .digest('hex')
    .slice(0, 20);
  const rate = await enforceRateLimit({
    key: `chat:call-ice:${auth.ctx.userId}:${networkKey}`,
    limit: 30,
    windowSeconds: 300,
    message: 'Too many call configuration requests. Please retry shortly.',
  });
  if (!rate.ok) return rate.response;

  const relayOnly =
    isProductionDeployment() || isEnabled(process.env.WEBRTC_RELAY_ONLY);
  const data = createIceServerPayload(auth.ctx.userId, {
    turnUrls: process.env.TURN_URLS || process.env.TURN_URL,
    stunUrls:
      process.env.STUN_URLS ||
      process.env.NEXT_PUBLIC_STUN_URLS,
    sharedSecret: process.env.TURN_SHARED_SECRET,
    ttlSeconds: readTtlSeconds(),
    relayOnly,
  });

  if (relayOnly && !data.relay_configured) {
    return NextResponse.json(
      {
        error: {
          code: 'call_relay_unavailable',
          message: 'Secure call relay is temporarily unavailable.',
        },
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'private, no-store, max-age=0' },
      },
    );
  }

  return NextResponse.json(
    { data },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
  );
}
