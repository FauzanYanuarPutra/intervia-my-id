import { NextRequest, NextResponse } from 'next/server';

import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';
import {
  deletePersonalAiMemory,
  getPersonalAiAgentForUse,
  getPersonalAiMemory,
  isPersonalAiMemoryEnabled,
  setPersonalAiMemoryPreference,
} from '@/lib/personal-ai/store';

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
const MAX_SHARE_ID_LENGTH = 512;
const MAX_PATCH_BODY_BYTES = 4 * 1024;

type ResolvedAgent = NonNullable<
  Awaited<ReturnType<typeof getPersonalAiAgentForUse>>
>;

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
  const response = NextResponse.json(body, {
    ...init,
    headers: {
      ...NO_STORE_HEADERS,
      ...(init?.headers || {}),
      'X-Request-Id': requestId,
    },
  });

  return response;
}

function normalizeOpaqueValue(
  value: string | null | undefined,
  maxLength: number,
): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > maxLength ||
    /[\u0000-\u001F\u007F]/.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

async function resolveRouteAgent(
  req: NextRequest,
  ctx: RouteContext,
  userId: string,
): Promise<
  | { ok: true; id: string; shareId?: string; agent: ResolvedAgent }
  | { ok: false; response: NextResponse }
> {
  const { id: rawId } = await ctx.params;
  const id = normalizeOpaqueValue(rawId, MAX_AGENT_ID_LENGTH);

  if (!id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid AI id.' },
        { status: 400 },
      ),
    };
  }

  const rawShareId = req.nextUrl.searchParams.get('share_id');
  const shareId =
    rawShareId === null
      ? undefined
      : normalizeOpaqueValue(rawShareId, MAX_SHARE_ID_LENGTH) || undefined;

  if (rawShareId !== null && !shareId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid share_id.' },
        { status: 400 },
      ),
    };
  }

  const agent = await getPersonalAiAgentForUse({
    userId,
    agentId: shareId ? undefined : id,
    shareId,
  });

  // The route id remains authoritative even when access is resolved through
  // a share token. This prevents one share token from being replayed against
  // another /agents/:id route.
  if (!agent || agent.id !== id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'AI not found.' },
        { status: 404 },
      ),
    };
  }

  return {
    ok: true,
    id,
    shareId,
    agent,
  };
}

async function parseBooleanPatchBody(
  req: NextRequest,
): Promise<
  | { ok: true; enabled: boolean }
  | { ok: false; status: number; error: string }
> {
  const contentLength = Number(req.headers.get('content-length') || '0');
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_PATCH_BODY_BYTES
  ) {
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

  const enabled = (body as Record<string, unknown>).enabled;
  if (typeof enabled !== 'boolean') {
    return {
      ok: false,
      status: 400,
      error: 'enabled must be a boolean.',
    };
  }

  return { ok: true, enabled };
}

function logUnexpectedError(
  operation: string,
  requestId: string,
  error: unknown,
) {
  console.error('[PERSONAL_AI_MEMORY_ROUTE_ERROR]', {
    operation,
    requestId,
    error: error instanceof Error ? error.message : String(error),
  });
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const requestId = createRequestId(req);

  try {
    const auth = await requireAuth(req);
    if (!auth.ok) {
      return decorateResponse(auth.res, requestId);
    }

    const ip = getClientIp(req.headers);
    const rate = await enforceRateLimit({
      key: `rl:ai:personal-memory-read:${auth.ctx.userId}:${ip}`,
      limit: 600,
      windowSeconds: 3600,
      message: 'Too many memory requests. Please retry later.',
    });
    if (!rate.ok) {
      return decorateResponse(rate.response, requestId);
    }

    const resolved = await resolveRouteAgent(
      req,
      ctx,
      auth.ctx.userId,
    );
    if (!resolved.ok) {
      return decorateResponse(resolved.response, requestId);
    }

    const { agent } = resolved;

    const [enabled, memory] = await Promise.all([
      isPersonalAiMemoryEnabled({
        agent,
        userId: auth.ctx.userId,
      }),
      getPersonalAiMemory(agent.id, auth.ctx.userId),
    ]);

    return json(requestId, {
      data: {
        enabled,
        can_manage_recipient_consent:
          agent.owner_id !== auth.ctx.userId,
        memory: memory
          ? {
              summary: memory.summary,
              facts: memory.facts,
              updated_at: memory.updated_at,
            }
          : null,
      },
    });
  } catch (error) {
    logUnexpectedError('GET', requestId, error);
    return json(
      requestId,
      { error: 'Unable to load AI memory.' },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const requestId = createRequestId(req);

  try {
    const auth = await requireAuth(req);
    if (!auth.ok) {
      return decorateResponse(auth.res, requestId);
    }

    const ip = getClientIp(req.headers);
    const rate = await enforceRateLimit({
      key: `rl:ai:personal-memory:${auth.ctx.userId}:${ip}`,
      limit: 40,
      windowSeconds: 3600,
      message: 'Too many memory changes. Please retry later.',
    });
    if (!rate.ok) {
      return decorateResponse(rate.response, requestId);
    }

    const resolved = await resolveRouteAgent(
      req,
      ctx,
      auth.ctx.userId,
    );
    if (!resolved.ok) {
      return decorateResponse(resolved.response, requestId);
    }

    const { agent } = resolved;

    // The creator's own memory preference belongs to assistant settings.
    // This endpoint only manages per-recipient consent for a shared AI.
    if (agent.owner_id === auth.ctx.userId) {
      return json(
        requestId,
        { error: 'Owner memory is managed in assistant settings.' },
        { status: 400 },
      );
    }

    const parsedBody = await parseBooleanPatchBody(req);
    if (!parsedBody.ok) {
      return json(
        requestId,
        { error: parsedBody.error },
        { status: parsedBody.status },
      );
    }

    const preference = await setPersonalAiMemoryPreference({
      agent,
      userId: auth.ctx.userId,
      enabled: parsedBody.enabled,
    });

    // Fail closed: only an explicit persisted true means enabled.
    const enabled = preference?.enabled === true;

    return json(requestId, {
      data: { enabled },
    });
  } catch (error) {
    logUnexpectedError('PATCH', requestId, error);
    return json(
      requestId,
      { error: 'Unable to update AI memory preference.' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const requestId = createRequestId(req);

  try {
    const auth = await requireAuth(req);
    if (!auth.ok) {
      return decorateResponse(auth.res, requestId);
    }

    const ip = getClientIp(req.headers);
    const rate = await enforceRateLimit({
      key: `rl:ai:personal-memory-delete:${auth.ctx.userId}:${ip}`,
      limit: 12,
      windowSeconds: 3600,
      message: 'Too many memory deletions. Please retry later.',
    });
    if (!rate.ok) {
      return decorateResponse(rate.response, requestId);
    }

    const resolved = await resolveRouteAgent(
      req,
      ctx,
      auth.ctx.userId,
    );
    if (!resolved.ok) {
      return decorateResponse(resolved.response, requestId);
    }

    const { agent } = resolved;
    const isOwner = agent.owner_id === auth.ctx.userId;

    await deletePersonalAiMemory({
      agentId: agent.id,
      userId: auth.ctx.userId,
      // Recipient delete means "forget me and stop learning from me".
      // Owner delete clears current memory but keeps the owner's global
      // assistant-memory preference managed by assistant settings.
      disablePreference: !isOwner,
    });

    const enabled = await isPersonalAiMemoryEnabled({
      agent,
      userId: auth.ctx.userId,
    });

    return json(requestId, {
      data: {
        enabled,
        memory: null,
      },
    });
  } catch (error) {
    logUnexpectedError('DELETE', requestId, error);
    return json(
      requestId,
      { error: 'Unable to delete AI memory.' },
      { status: 500 },
    );
  }
}