import { NextRequest, NextResponse } from 'next/server';

import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';
import { rotatePersonalAiShare } from '@/lib/personal-ai/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
} as const;

const MAX_AGENT_ID_LENGTH = 160;
const MAX_BODY_BYTES = 4 * 1024;

type ShareAction = 'rotate' | 'revoke';

function createRequestId(req: NextRequest): string {
  const incoming = req.headers.get('x-request-id')?.trim() || '';
  if (
    incoming &&
    incoming.length <= 128 &&
    /^[A-Za-z0-9._:-]+$/.test(incoming)
  ) {
    return incoming;
  }

  return crypto.randomUUID();
}

function decorateResponse<T extends Response>(response: T, requestId: string): T {
  response.headers.set('Cache-Control', NO_STORE_HEADERS['Cache-Control']);
  response.headers.set('Pragma', NO_STORE_HEADERS.Pragma);
  response.headers.set(
    'X-Content-Type-Options',
    NO_STORE_HEADERS['X-Content-Type-Options'],
  );
  response.headers.set('X-Request-Id', requestId);
  return response;
}

function json(
  requestId: string,
  body: unknown,
  init?: ResponseInit,
): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...NO_STORE_HEADERS,
      ...(init?.headers || {}),
      'X-Request-Id': requestId,
    },
  });
}

function normalizeAgentId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > MAX_AGENT_ID_LENGTH ||
    /[\u0000-\u001F\u007F]/.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

async function parseShareAction(
  req: NextRequest,
): Promise<
  | { ok: true; action: ShareAction }
  | { ok: false; status: number; error: string }
> {
  const contentLength = Number(req.headers.get('content-length') || '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return {
      ok: false,
      status: 413,
      error: 'Request body is too large.',
    };
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return {
      ok: false,
      status: 400,
      error: 'Request body must be valid JSON.',
    };
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      ok: false,
      status: 400,
      error: 'Request body must be a JSON object.',
    };
  }

  const action = (body as Record<string, unknown>).action;

  if (action !== 'rotate' && action !== 'revoke') {
    return {
      ok: false,
      status: 400,
      error: 'action must be rotate or revoke.',
    };
  }

  return { ok: true, action };
}

function logUnexpectedError(requestId: string, error: unknown) {
  console.error('[PERSONAL_AI_SHARE_ROUTE_ERROR]', {
    requestId,
    error: error instanceof Error ? error.message : String(error),
  });
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const requestId = createRequestId(req);

  try {
    const auth = await requireAuth(req);
    if (!auth.ok) {
      return decorateResponse(auth.res, requestId);
    }

    const { id: rawId } = await ctx.params;
    const id = normalizeAgentId(rawId);

    if (!id) {
      return json(
        requestId,
        { error: 'Invalid AI id.' },
        { status: 400 },
      );
    }

    const ip = getClientIp(req.headers);
    const rate = await enforceRateLimit({
      key: `rl:ai:personal-share:${auth.ctx.userId}:${id}:${ip}`,
      limit: 20,
      windowSeconds: 3600,
      message: 'Too many share-link changes. Please retry later.',
    });
    if (!rate.ok) {
      return decorateResponse(rate.response, requestId);
    }

    const parsedBody = await parseShareAction(req);
    if (!parsedBody.ok) {
      return json(
        requestId,
        { error: parsedBody.error },
        { status: parsedBody.status },
      );
    }

    const agent = await rotatePersonalAiShare({
      userId: auth.ctx.userId,
      agentId: id,
      revoke: parsedBody.action === 'revoke',
    });

    if (!agent) {
      // Keep a single response for "not found" and "not editable" so the
      // endpoint does not become an ownership-enumeration oracle.
      return json(
        requestId,
        { error: 'AI not found or not editable.' },
        { status: 404 },
      );
    }

    return json(requestId, {
      data: { agent },
    });
  } catch (error) {
    logUnexpectedError(requestId, error);
    return json(
      requestId,
      { error: 'Unable to update AI share link.' },
      { status: 500 },
    );
  }
}