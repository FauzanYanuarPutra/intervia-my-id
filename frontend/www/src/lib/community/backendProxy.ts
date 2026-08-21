import { NextResponse } from 'next/server';
import { normalizeContentMediaUrl } from '@/lib/content/catalog';
import { fetchWithTimeout } from '@/lib/server/fetchWithTimeout';

function getCommunityBackendBase(): string | null {
  const base =
    process.env.COMMUNITY_SERVICE_URL ||
    process.env.INTERNAL_COMMUNITY_URL ||
    '';
  const configured = base.trim();
  if (configured) return configured;
  return process.env.NODE_ENV === 'development'
    ? 'http://127.0.0.1:8082'
    : null;
}

function readCookieValue(
  cookieHeader: string | null,
  name: string,
): string | null {
  if (!cookieHeader) return null;
  const pattern = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`);
  const match = cookieHeader.match(pattern);
  return match ? decodeURIComponent(match[1]) : null;
}

function readForwardToken(req: Request): string | null {
  const bearer = req.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '')
    .trim();
  if (bearer) return bearer;
  return (
    readCookieValue(req.headers.get('cookie'), 'access_token')?.trim() || null
  );
}

function appendSearch(req: Request, upstream: URL) {
  try {
    const currentSearch = new URL(req.url).search;
    if (!currentSearch) return;
    new URLSearchParams(currentSearch).forEach((value, key) => {
      upstream.searchParams.append(key, value);
    });
  } catch {
    // Ignore malformed URLs and continue without query parameters.
  }
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
  req: Request,
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
    console.error('[COMMUNITY_BACKEND_CONFIG_MISSING]');
    return NextResponse.json(
      { error: 'Community service unavailable' },
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
  const range = req.headers.get('range');
  if (method === 'GET' && range) {
    headers.Range = range;
  }

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
    const isJsonContent = contentType
      .toLowerCase()
      .includes('application/json');
    for (const headerName of ['accept-ranges', 'content-range']) {
      const headerValue = response.headers.get(headerName);
      if (headerValue) responseHeaders[headerName] = headerValue;
    }
    const contentLength = response.headers.get('content-length');
    if (contentLength && !isJsonContent) {
      responseHeaders['content-length'] = contentLength;
    }

    if (isJsonContent && bodyBuffer.byteLength) {
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
