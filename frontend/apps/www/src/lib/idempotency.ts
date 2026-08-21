import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{12,128}$/;
const IDEMPOTENCY_FAIL_OPEN = process.env.IDEMPOTENCY_FAIL_OPEN === 'true';

type CachedResponse = {
  status: number;
  contentType: string;
  body: string;
};

function stableHash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function readIdempotencyKey(req: NextRequest): string | null {
  const raw = req.headers.get('x-idempotency-key')?.trim() || null;
  if (!raw) return null;
  if (!IDEMPOTENCY_KEY_PATTERN.test(raw)) return null;
  return raw;
}

function toResponse(cached: CachedResponse): NextResponse {
  return new NextResponse(cached.body, {
    status: cached.status,
    headers: {
      'Content-Type': cached.contentType || 'application/json',
      'X-Idempotent-Replay': 'true',
    },
  });
}

export async function withIdempotency(
  req: NextRequest,
  options: {
    scope: string;
    actorHint?: string;
    ttlSeconds?: number;
    forward: () => Promise<Response>;
  },
): Promise<NextResponse> {
  const key = readIdempotencyKey(req);
  if (!key) {
    return NextResponse.json(
      {
        error:
          'Missing or invalid X-Idempotency-Key. Use 12-128 chars [A-Za-z0-9._:-].',
      },
      { status: 400 },
    );
  }

  const scopeActor = options.actorHint?.trim() || 'anonymous';
  const scope = `idem:${options.scope}:${stableHash(scopeActor)}:${key}`;
  const lockKey = `${scope}:lock`;
  const ttlSeconds = Math.max(60, options.ttlSeconds ?? 24 * 60 * 60);

  try {
    const redis = getRedis();
    const cachedRaw = await redis.get(scope);
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw) as CachedResponse;
      return toResponse(parsed);
    }

    const lockAcquired = await redis.set(lockKey, '1', 'EX', 30, 'NX');
    if (!lockAcquired) {
      // Another request with same key is in-flight. Short wait for cached result.
      for (let i = 0; i < 20; i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const inFlightCached = await redis.get(scope);
        if (inFlightCached) {
          const parsed = JSON.parse(inFlightCached) as CachedResponse;
          return toResponse(parsed);
        }
      }

      return NextResponse.json(
        { error: 'Request with the same idempotency key is still processing.' },
        { status: 409 },
      );
    }

    const upstream = await options.forward();
    const body = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'application/json';

    const cached: CachedResponse = {
      status: upstream.status,
      contentType,
      body,
    };

    await redis.setex(scope, ttlSeconds, JSON.stringify(cached));
    await redis.del(lockKey);

    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    const reason = (error as Error)?.message || String(error);
    if (IDEMPOTENCY_FAIL_OPEN) {
      console.warn('[IDEMPOTENCY_BYPASS]', reason);
      const upstream = await options.forward();
      const body = await upstream.text();
      const contentType = upstream.headers.get('content-type') || 'application/json';
      return new NextResponse(body, {
        status: upstream.status,
        headers: {
          'Content-Type': contentType,
        },
      });
    }

    console.error('[IDEMPOTENCY_UNAVAILABLE]', reason);
    return NextResponse.json(
      { error: 'Idempotency service unavailable. Please retry in a moment.' },
      { status: 503 },
    );
  }
}
