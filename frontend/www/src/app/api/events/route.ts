import { NextRequest, NextResponse } from 'next/server';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';

const MAX_EVENT_BODY_BYTES = 64 * 1024;

function isUpstreamFailure(status: number): boolean {
  return status >= 500;
}

function getForwardToken(req: NextRequest): string | null {
  const bearer = req.headers.get('authorization');
  if (bearer?.startsWith('Bearer '))
    return bearer.slice('Bearer '.length).trim();
  return req.cookies.get('access_token')?.value?.trim() || null;
}

function getClientIp(req: NextRequest): string | null {
  return (
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    null
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    if (!body.trim()) {
      return NextResponse.json(
        { error: 'Event body is required' },
        { status: 400 },
      );
    }

    if (new TextEncoder().encode(body).byteLength > MAX_EVENT_BODY_BYTES) {
      return NextResponse.json(
        { error: 'Event body is too large' },
        { status: 413 },
      );
    }

    const token = getForwardToken(req);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': req.headers.get('user-agent') || 'lajukan-www-event-proxy',
    };

    if (token) headers.Authorization = `Bearer ${token}`;
    const ip = getClientIp(req);
    if (ip) headers['X-Forwarded-For'] = ip;
    const requestId = req.headers.get('x-request-id');
    if (requestId) headers['X-Request-Id'] = requestId;

    const response = await fetch(`${MARKETPLACE_URL}/v1/events`, {
      method: 'POST',
      headers,
      body,
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => ({}));
    if (isUpstreamFailure(response.status)) {
      console.warn('[EVENT_COLLECTOR_UPSTREAM_UNAVAILABLE]', {
        status: response.status,
        payload,
      });
      return NextResponse.json(
        { accepted: 0, deferred: true, source: 'event-proxy-soft-fail' },
        { status: 202 },
      );
    }

    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error('[EVENT_COLLECTOR_PROXY_ERROR]', error);
    return NextResponse.json(
      { accepted: 0, deferred: true, source: 'event-proxy-soft-fail' },
      { status: 202 },
    );
  }
}
