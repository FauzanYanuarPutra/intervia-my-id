import { NextRequest, NextResponse } from 'next/server';

function getCommunityBackendBase(): string | null {
  const base =
    process.env.COMMUNITY_SERVICE_URL ||
    process.env.INTERNAL_COMMUNITY_URL ||
    process.env.NEXT_PUBLIC_COMMUNITY_URL ||
    '';
  return base.trim() || null;
}

function readForwardToken(req: NextRequest): string | null {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (bearer) return bearer;
  return req.cookies.get('access_token')?.value?.trim() || null;
}

function appendSearch(req: NextRequest, upstream: URL) {
  req.nextUrl.searchParams.forEach((value, key) => {
    upstream.searchParams.append(key, value);
  });
}

export async function proxyCommunityBackend(
  req: NextRequest,
  path: string,
  options: {
    method?: string;
    includeSearch?: boolean;
  } = {},
): Promise<NextResponse> {
  const base = getCommunityBackendBase();
  if (!base) {
    return NextResponse.json(
      { error: 'Community service is not configured' },
      { status: 503 },
    );
  }

  const upstream = new URL(path, base.endsWith('/') ? base : `${base}/`);
  if (options.includeSearch !== false) {
    appendSearch(req, upstream);
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  const token = readForwardToken(req);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const forwardedFor = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  if (forwardedFor) {
    headers['X-Forwarded-For'] = forwardedFor;
  }

  const userAgent = req.headers.get('user-agent');
  if (userAgent) {
    headers['User-Agent'] = userAgent;
  }

  let body: ArrayBuffer | undefined;
  const method = options.method || req.method;
  if (method !== 'GET' && method !== 'HEAD') {
    body = await req.arrayBuffer();
    const contentType = req.headers.get('content-type');
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
  }

  try {
    const response = await fetch(upstream.toString(), {
      method,
      headers,
      body,
      cache: 'no-store',
    });
    const contentType = response.headers.get('content-type') || 'application/json';
    const bodyBuffer = await response.arrayBuffer();
    return new NextResponse(bodyBuffer.byteLength ? bodyBuffer : '{}', {
      status: response.status,
      headers: {
        'content-type': contentType,
      },
    });
  } catch (error) {
    console.error('[COMMUNITY_BACKEND_PROXY_ERROR]', error);
    return NextResponse.json(
      { error: 'Community service unavailable' },
      { status: 503 },
    );
  }
}
