import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/server/fetchWithTimeout';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';
const LISTING_DRAFT_TIMEOUT_MS = 8_000;

function authHeaders(req: NextRequest): Headers {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const bearer = req.headers.get('authorization');
  const cookieToken = req.cookies.get('access_token')?.value?.trim();

  if (bearer) headers.set('Authorization', bearer);
  else if (cookieToken) headers.set('Authorization', `Bearer ${cookieToken}`);

  return headers;
}

function appendSearch(req: NextRequest, upstream: URL): void {
  req.nextUrl.searchParams.forEach((value, key) => {
    upstream.searchParams.set(key, value);
  });
}

function publicUpstreamError(status: number): string {
  switch (status) {
    case 400:
      return 'Invalid listing draft request.';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Listing draft not found.';
    case 409:
    case 412:
      return 'Listing draft conflict.';
    case 413:
      return 'Listing draft request is too large.';
    case 422:
      return 'Invalid listing draft data.';
    case 429:
      return 'Too many requests.';
    default:
      return status >= 500
        ? 'Listing draft service is unavailable.'
        : 'Listing draft request failed.';
  }
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  );
}

async function readSuccessPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return null;
  return JSON.parse(text) as unknown;
}

export async function proxyListingDraftRequest(
  req: NextRequest,
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    includeSearch?: boolean;
  } = {},
): Promise<NextResponse> {
  const method = options.method || req.method;

  try {
    const upstream = new URL(path, MARKETPLACE_URL);
    if (options.includeSearch) appendSearch(req, upstream);

    const body =
      method === 'GET' || method === 'HEAD' ? undefined : await req.text();
    const response = await fetchWithTimeout(
      upstream,
      {
        method,
        headers: authHeaders(req),
        body,
        cache: 'no-store',
      },
      LISTING_DRAFT_TIMEOUT_MS,
    );

    if (response.status === 204 || response.status === 205) {
      return new NextResponse(null, { status: response.status });
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      const status =
        response.status >= 400 && response.status <= 599
          ? response.status
          : 502;
      return NextResponse.json(
        { error: publicUpstreamError(status) },
        { status },
      );
    }

    try {
      return NextResponse.json(await readSuccessPayload(response), {
        status: response.status,
      });
    } catch {
      return NextResponse.json(
        { error: 'Invalid listing draft service response.' },
        { status: 502 },
      );
    }
  } catch (error) {
    const timedOut = isAbortError(error);
    console.error(timedOut ? '[LISTING_DRAFT_TIMEOUT]' : '[LISTING_DRAFT_UNAVAILABLE]', {
      method,
      path,
    });
    return NextResponse.json(
      {
        error: timedOut
          ? 'Listing draft service timed out.'
          : 'Listing draft service is unavailable.',
      },
      { status: timedOut ? 504 : 503 },
    );
  }
}
