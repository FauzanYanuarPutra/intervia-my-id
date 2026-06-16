import { NextRequest, NextResponse } from 'next/server';
import { normalizeContentMediaUrl } from '@/lib/content/catalog';
import { fetchWithTimeout } from '@/lib/server/fetchWithTimeout';

function getCommunityBackendBase(): string | null {
  const base =
    process.env.COMMUNITY_SERVICE_URL ||
    process.env.INTERNAL_COMMUNITY_URL ||
    process.env.NEXT_PUBLIC_COMMUNITY_URL ||
    '';
  return base.trim() || null;
}

function readForwardToken(req: NextRequest): string | null {
  const bearer = req.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '')
    .trim();
  if (bearer) return bearer;
  return req.cookies.get('access_token')?.value?.trim() || null;
}

function appendSearch(req: NextRequest, upstream: URL) {
  req.nextUrl.searchParams.forEach((value, key) => {
    upstream.searchParams.append(key, value);
  });
}

function normalizeCommunityMediaString(value: string): string {
  const normalized = normalizeContentMediaUrl(value);
  if (
    normalized.startsWith('/api/forum/media/') ||
    normalized.startsWith('/api/content/media/') ||
    normalized.startsWith('/api/chat/media/') ||
    normalized.startsWith('/uploads/')
  ) {
    return normalized;
  }
  return value;
}

function normalizeCommunityPayloadUrls(value: unknown): unknown {
  if (typeof value === 'string') {
    return normalizeCommunityMediaString(value);
  }
  if (Array.isArray(value)) {
    return value.map(entry => normalizeCommunityPayloadUrls(entry));
  }
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      normalizeCommunityPayloadUrls(entry),
    ]),
  );
}

export async function proxyCommunityBackend(
  req: NextRequest,
  path: string,
  options: {
    method?: string;
    includeSearch?: boolean;
    accept?: string;
    cacheControl?: string;
    timeoutMs?: number;
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
    Accept: options.accept || 'application/json',
  };

  const token = readForwardToken(req);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const forwardedFor =
    req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
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
    const response = await fetchWithTimeout(
      upstream.toString(),
      {
        method,
        headers,
        body,
        cache: 'no-store',
      },
      options.timeoutMs || 8000,
    );
    const contentType =
      response.headers.get('content-type') || 'application/json';
    const cacheControl =
      options.cacheControl ||
      response.headers.get('cache-control') ||
      undefined;
    const bodyBuffer = await response.arrayBuffer();
    let responseBody: ArrayBuffer | string = bodyBuffer;
    const responseHeaders: Record<string, string> = {
      'content-type': contentType,
    };
    if (cacheControl) {
      responseHeaders['cache-control'] = cacheControl;
    }

    if (
      contentType.toLowerCase().includes('application/json') &&
      bodyBuffer.byteLength
    ) {
      try {
        const parsed = JSON.parse(
          new TextDecoder().decode(bodyBuffer),
        ) as unknown;
        responseBody = JSON.stringify(normalizeCommunityPayloadUrls(parsed));
      } catch {
        responseBody = bodyBuffer;
      }
    }

    const finalBody =
      typeof responseBody === 'string'
        ? responseBody || '{}'
        : responseBody.byteLength
          ? responseBody
          : '{}';

    return new NextResponse(finalBody, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[COMMUNITY_BACKEND_PROXY_ERROR]', error);
    return NextResponse.json(
      { error: 'Community service unavailable' },
      {
        status:
          error instanceof DOMException && error.name === 'AbortError'
            ? 504
            : 503,
      },
    );
  }
}
