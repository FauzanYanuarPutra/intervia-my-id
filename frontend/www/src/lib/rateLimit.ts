import { getRedis } from '@/lib/redis';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const RATE_LIMIT_FAIL_OPEN = process.env.RATE_LIMIT_FAIL_OPEN === 'true';

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetInSec: number;
  degraded?: boolean;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowSeconds: number;
  message?: string;
};

type RouteRateLimitResult =
  | (RateLimitResult & {
      ok: true;
      response: null;
    })
  | (RateLimitResult & {
      ok: false;
      response: NextResponse;
    });

function withRateLimitHeaders(response: NextResponse, result: RateLimitResult): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set('X-RateLimit-Reset', String(result.resetInSec));
  return response;
}

async function evaluateRateLimit(
  key: string,
  maxRequests: number,
  windowSec: number,
): Promise<RateLimitResult> {
  try {
    const redis = getRedis();
    const script = `
      local current = redis.call("INCR", KEYS[1])
      if current == 1 then
        redis.call("EXPIRE", KEYS[1], ARGV[1])
      end
      local ttl = redis.call("TTL", KEYS[1])
      return {current, ttl}
    `;

    const result = (await redis.eval(script, 1, key, String(windowSec))) as [number, number];
    const currentRaw = Number(result?.[0] ?? 0);
    const ttlRaw = Number(result?.[1] ?? windowSec);
    const current = Number.isFinite(currentRaw) ? currentRaw : 0;
    const ttl = ttlRaw > 0 ? ttlRaw : windowSec;

    return {
      allowed: current <= maxRequests,
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - current),
      resetInSec: ttl,
      degraded: false,
    };
  } catch (error) {
    if (RATE_LIMIT_FAIL_OPEN) {
      console.error('[RateLimit] Redis unavailable. fail-open=true:', error);
      return {
        allowed: true,
        limit: maxRequests,
        remaining: maxRequests,
        resetInSec: windowSec,
        degraded: true,
      };
    }

    console.error('[RateLimit] Redis unavailable. fail-open=false:', error);
    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      resetInSec: windowSec,
      degraded: true,
    };
  }
}

function isOptionsArg(input: unknown): input is RateLimitOptions {
  if (!input || typeof input !== 'object') return false;
  const candidate = input as Partial<RateLimitOptions>;
  return (
    typeof candidate.key === 'string' &&
    typeof candidate.limit === 'number' &&
    typeof candidate.windowSeconds === 'number'
  );
}

export async function enforceRateLimit(
  options: RateLimitOptions,
): Promise<RouteRateLimitResult>;
export async function enforceRateLimit(
  key: string,
  maxRequests: number,
  windowSec: number,
): Promise<RateLimitResult>;
export async function enforceRateLimit(
  arg1: RateLimitOptions | string,
  arg2?: number,
  arg3?: number,
): Promise<RouteRateLimitResult | RateLimitResult> {
  if (isOptionsArg(arg1)) {
    const result = await evaluateRateLimit(arg1.key, arg1.limit, arg1.windowSeconds);
    if (result.allowed) {
      return {
        ok: true,
        response: null,
        ...result,
      };
    }

    if (result.degraded) {
      const response = withRateLimitHeaders(
        NextResponse.json(
          { error: 'Rate limit service unavailable. Please retry shortly.' },
          { status: 503 },
        ),
        result,
      );

      return {
        ok: false,
        response,
        ...result,
      };
    }

    const response = withRateLimitHeaders(
      NextResponse.json(
        { error: arg1.message || 'Too many requests. Please try again later.' },
        { status: 429 },
      ),
      result,
    );

    return {
      ok: false,
      response,
      ...result,
    };
  }

  const key = arg1;
  const maxRequests = arg2 ?? 1;
  const windowSec = arg3 ?? 60;
  return evaluateRateLimit(key, maxRequests, windowSec);
}

type HeaderCarrier = Headers | { headers: Headers };

export function getClientIp(source: HeaderCarrier): string {
  const headers = source instanceof Headers ? source : source.headers;
  const forwarded = headers.get('x-forwarded-for') || '';
  const first = forwarded.split(',')[0]?.trim();
  return first || headers.get('x-real-ip') || 'unknown';
}

export function getClientUserAgent(source: HeaderCarrier): string {
  const headers = source instanceof Headers ? source : source.headers;
  return headers.get('user-agent')?.trim() || 'unknown';
}

export function getDeviceFingerprint(source: NextRequest | HeaderCarrier): string {
  const headers = source instanceof Headers ? source : source.headers;
  const ip = getClientIp(headers);
  const ua = getClientUserAgent(headers);
  const lang = headers.get('accept-language')?.slice(0, 64) || 'unknown';
  const secChUa = headers.get('sec-ch-ua')?.slice(0, 128) || 'unknown';

  return crypto
    .createHash('sha256')
    .update(`${ip}|${ua}|${lang}|${secChUa}`)
    .digest('hex')
    .slice(0, 24);
}

export async function enforceLeakyBucket(opts: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const result = await enforceRateLimit(opts);
  if (!result.ok) {
    return { ok: false, response: result.response };
  }
  return { ok: true };
}
