import { NextRequest, NextResponse } from 'next/server';

import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';
import {
  deletePersonalAiAgent,
  getPersonalAiAgentForUse,
  serializePersonalAiAgentForViewer,
  updatePersonalAiAgent,
} from '@/lib/personal-ai/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
} as const;

function json(
  body: unknown,
  init?: {
    status?: number;
    headers?: HeadersInit;
  },
) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: {
      ...NO_STORE_HEADERS,
      ...(init?.headers ?? {}),
    },
  });
}

async function readId(ctx: RouteContext): Promise<string | null> {
  const params = await ctx.params;
  const id = String(params?.id ?? '').trim();

  if (!id || id.length > 128) {
    return null;
  }

  return id;
}

async function applyRateLimit(input: {
  req: NextRequest;
  userId: string;
  action: 'read' | 'update' | 'delete';
  limit: number;
}) {
  const ip = getClientIp(input.req.headers);

  return enforceRateLimit({
    key: [
      'rl',
      'ai',
      'personal-agent',
      input.action,
      input.userId,
      ip,
    ].join(':'),
    limit: input.limit,
    windowSeconds: 3600,
    message:
      input.action === 'read'
        ? 'Too many AI agent requests. Please retry later.'
        : input.action === 'update'
          ? 'Too many AI agent changes. Please retry later.'
          : 'Too many AI agent deletion attempts. Please retry later.',
  });
}

/* -------------------------------------------------------------------------- */
/* GET                                                                        */
/* -------------------------------------------------------------------------- */

export async function GET(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAuth(req);

  if (!auth.ok) {
    return auth.res;
  }

  const id = await readId(ctx);

  if (!id) {
    return json(
      {
        error: 'Invalid AI id.',
        code: 'INVALID_AGENT_ID',
      },
      {
        status: 400,
      },
    );
  }

  const rate = await applyRateLimit({
    req,
    userId: auth.ctx.userId,
    action: 'read',
    limit: 240,
  });

  if (!rate.ok) {
    return rate.response;
  }

  try {
    const agent = await getPersonalAiAgentForUse({
      userId: auth.ctx.userId,
      agentId: id,
    });

    if (!agent) {
      return json(
        {
          error: 'AI not found.',
          code: 'AGENT_NOT_FOUND',
        },
        {
          status: 404,
        },
      );
    }

    return json({
      data: {
        agent: serializePersonalAiAgentForViewer(
          agent,
          auth.ctx.userId,
        ),
      },
    });
  } catch (error) {
    console.error('[PERSONAL_AI_AGENT_GET_FAILED]', {
      userId: auth.ctx.userId,
      agentId: id,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });

    return json(
      {
        error: 'Failed to load AI.',
        code: 'AGENT_READ_FAILED',
      },
      {
        status: 500,
      },
    );
  }
}

/* -------------------------------------------------------------------------- */
/* PATCH                                                                      */
/* -------------------------------------------------------------------------- */

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAuth(req);

  if (!auth.ok) {
    return auth.res;
  }

  const id = await readId(ctx);

  if (!id) {
    return json(
      {
        error: 'Invalid AI id.',
        code: 'INVALID_AGENT_ID',
      },
      {
        status: 400,
      },
    );
  }

  const rate = await applyRateLimit({
    req,
    userId: auth.ctx.userId,
    action: 'update',
    limit: 80,
  });

  if (!rate.ok) {
    return rate.response;
  }

  let body: Record<string, unknown>;

  try {
    const parsed = (await req.json()) as unknown;

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return json(
        {
          error: 'Invalid request body.',
          code: 'INVALID_BODY',
        },
        {
          status: 400,
        },
      );
    }

    body = parsed as Record<string, unknown>;
  } catch {
    return json(
      {
        error: 'Invalid JSON body.',
        code: 'INVALID_JSON',
      },
      {
        status: 400,
      },
    );
  }

  if (Object.keys(body).length === 0) {
    return json(
      {
        error: 'No changes provided.',
        code: 'EMPTY_UPDATE',
      },
      {
        status: 400,
      },
    );
  }

  try {
    const agent = await updatePersonalAiAgent(
      auth.ctx.userId,
      id,
      body,
    );

    if (!agent) {
      return json(
        {
          error: 'AI not found or not editable.',
          code: 'AGENT_NOT_EDITABLE',
        },
        {
          status: 404,
        },
      );
    }

    return json({
      data: {
        agent: serializePersonalAiAgentForViewer(
          agent,
          auth.ctx.userId,
        ),
      },
    });
  } catch (error) {
    console.error('[PERSONAL_AI_AGENT_UPDATE_FAILED]', {
      userId: auth.ctx.userId,
      agentId: id,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });

    return json(
      {
        error: 'Failed to update AI.',
        code: 'AGENT_UPDATE_FAILED',
      },
      {
        status: 500,
      },
    );
  }
}

/* -------------------------------------------------------------------------- */
/* DELETE                                                                     */
/* -------------------------------------------------------------------------- */

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAuth(req);

  if (!auth.ok) {
    return auth.res;
  }

  const id = await readId(ctx);

  if (!id) {
    return json(
      {
        error: 'Invalid AI id.',
        code: 'INVALID_AGENT_ID',
      },
      {
        status: 400,
      },
    );
  }

  const rate = await applyRateLimit({
    req,
    userId: auth.ctx.userId,
    action: 'delete',
    limit: 30,
  });

  if (!rate.ok) {
    return rate.response;
  }

  try {
    const ok = await deletePersonalAiAgent(
      auth.ctx.userId,
      id,
    );

    if (!ok) {
      return json(
        {
          error: 'AI not found or cannot delete your last AI.',
          code: 'AGENT_DELETE_REJECTED',
        },
        {
          status: 400,
        },
      );
    }

    return json({
      ok: true,
      data: {
        deletedAgentId: id,
      },
    });
  } catch (error) {
    console.error('[PERSONAL_AI_AGENT_DELETE_FAILED]', {
      userId: auth.ctx.userId,
      agentId: id,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });

    return json(
      {
        error: 'Failed to delete AI.',
        code: 'AGENT_DELETE_FAILED',
      },
      {
        status: 500,
      },
    );
  }
}