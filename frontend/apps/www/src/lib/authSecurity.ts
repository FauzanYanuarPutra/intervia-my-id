import { NextRequest, NextResponse } from 'next/server';
import {
  enforceLeakyBucket,
  getClientIp,
  getDeviceFingerprint,
} from '@/lib/rateLimit';

export type AuthSecurityResult =
  | { ok: true; ip: string; deviceFingerprint: string }
  | { ok: false; response: NextResponse };

export async function enforceAuthRouteSecurity(
  req: NextRequest,
  opts: {
    routeKey: string;
    ipLimit: number;
    deviceLimit?: number;
    windowSeconds: number;
  },
): Promise<AuthSecurityResult> {
  const ip = getClientIp(req);
  const deviceFingerprint = getDeviceFingerprint(req);
  const deviceLimit = Math.max(1, opts.deviceLimit ?? Math.ceil(opts.ipLimit * 0.8));

  const byIp = await enforceLeakyBucket({
    key: `auth:${opts.routeKey}:ip:${ip}`,
    limit: opts.ipLimit,
    windowSeconds: opts.windowSeconds,
  });
  if (!byIp.ok) {
    return { ok: false, response: byIp.response };
  }

  const byDevice = await enforceLeakyBucket({
    key: `auth:${opts.routeKey}:device:${deviceFingerprint}`,
    limit: deviceLimit,
    windowSeconds: opts.windowSeconds,
  });
  if (!byDevice.ok) {
    return { ok: false, response: byDevice.response };
  }

  return { ok: true, ip, deviceFingerprint };
}

export function authSecurityHeaders(ctx: {
  ip: string;
  deviceFingerprint: string;
}): Record<string, string> {
  return {
    'x-client-ip': ctx.ip,
    'x-device-fingerprint': ctx.deviceFingerprint,
  };
}
