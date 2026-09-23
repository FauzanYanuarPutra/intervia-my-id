import { NextRequest, NextResponse } from 'next/server';

import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';
import {
  createPersonalAiAgent,
  listPersonalAiAgents,
  personalAiLimits,
  PersonalAiAgentQuotaExceededError,
  PersonalAiStorageUnavailableError,
} from '@/lib/personal-ai/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonNoStore(
  body: unknown,
  init?: ResponseInit,
) {
  const response = NextResponse.json(body, init);

  response.headers.set('Cache-Control', 'no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');

  return response;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return auth.res;
  }

  try {
    const shareId =
      req.nextUrl.searchParams.get('share_id')?.trim() || undefined;

    const data = await listPersonalAiAgents(
      auth.ctx.userId,
      shareId,
    );

    return jsonNoStore({
      data: {
        ...data,
        limits: personalAiLimits,
      },
    });
  } catch (error) {
    console.error('[PERSONAL_AI_AGENTS_LIST_FAILED]', {
      userId: auth.ctx.userId,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    });

    return jsonNoStore(
      {
        error: 'Gagal memuat AI pribadi.',
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return auth.res;
  }

  const ip = getClientIp(req.headers);

  const rate = await enforceRateLimit({
    key: `rl:ai:personal-agent:create:${auth.ctx.userId}:${ip}`,
    limit: 20,
    windowSeconds: 3600,
    message:
      'Terlalu banyak perubahan AI pribadi. Coba lagi nanti.',
  });

  if (!rate.ok) {
    return rate.response;
  }

  let body: Record<string, unknown>;

  try {
    const parsed = await req.json();

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return jsonNoStore(
        {
          error: 'Payload tidak valid.',
        },
        {
          status: 400,
        },
      );
    }

    body = parsed as Record<string, unknown>;
  } catch {
    return jsonNoStore(
      {
        error: 'Body request harus berupa JSON yang valid.',
      },
      {
        status: 400,
      },
    );
  }

  try {
    const agent = await createPersonalAiAgent(
      auth.ctx.userId,
      body,
    );

    return jsonNoStore(
      {
        data: {
          agent,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Gagal membuat AI pribadi.';

    if (error instanceof PersonalAiAgentQuotaExceededError) {
      return jsonNoStore(
        {
          error: message,
          code: error.code,
          quota: {
            resource: 'agents',
            limit: error.limit,
          },
        },
        {
          status: 409,
        },
      );
    }

    if (error instanceof PersonalAiStorageUnavailableError) {
      console.error('[PERSONAL_AI_AGENT_STORAGE_UNAVAILABLE]', {
        userId: auth.ctx.userId,
        error: message,
      });

      return jsonNoStore(
        {
          error:
            'Penyimpanan AI sedang tidak tersedia. Coba lagi sebentar lagi.',
          code: error.code,
        },
        {
          status: 503,
        },
      );
    }

    // Database/schema/runtime failures must not be reported as user input
    // errors. Keep the technical detail in server logs and return a stable
    // 500 so the client can offer a retry instead of blaming the form.
    console.error('[PERSONAL_AI_AGENT_CREATE_FAILED]', {
      userId: auth.ctx.userId,
      error: message,
    });

    return jsonNoStore(
      {
        error: 'AI pribadi belum bisa dibuat. Coba lagi sebentar lagi.',
        code: 'personal_ai_agent_create_failed',
      },
      {
        status: 500,
      },
    );
  }
}