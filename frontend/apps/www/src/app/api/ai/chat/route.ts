import { NextRequest, NextResponse } from 'next/server';

import { AI_CHAT_ENABLED } from '@/lib/featureFlags';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';

const INTERNAL_AI_URL = (process.env.INTERNAL_AI_URL || '').replace(/\/+$/, '');
const AI_SERVICE_TOKEN = process.env.AI_SERVICE_TOKEN || '';

const CHAT_RATE_LIMIT_WINDOW_SEC = 60;
const CHAT_RATE_LIMIT_MAX = 30;

const MAX_MESSAGE_CHARS = 6_000;
const MAX_HISTORY_MESSAGES = 18;
const MAX_HISTORY_MESSAGE_CHARS = 6_000;

const AI_REQUEST_TIMEOUT_MS = parsePositiveInt(
  process.env.AI_REQUEST_TIMEOUT_MS,
  90_000,
  3_000,
  180_000,
);

type ChatRole = 'user' | 'assistant';

type IncomingChatMessage = {
  role?: unknown;
  content?: unknown;
};

type ChatRequestBody = {
  message?: unknown;

  /**
   * Backward compatibility with the current frontend.
   * The old route used `context` for chat history.
   */
  context?: unknown;

  /**
   * Preferred field going forward.
   */
  messages?: unknown;

  locale?: unknown;
  use_rag?: unknown;
  useRag?: unknown;

  /**
   * Optional authorized business/product context.
   * This is forwarded as AI context, not as instructions.
   */
  ai_context?: unknown;
  memory?: unknown;
};

type RateLimitResult = Awaited<ReturnType<typeof enforceRateLimit>>;

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number.parseInt(value ?? '', 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function normalizeLocale(value: unknown): 'id' | 'en' {
  if (typeof value !== 'string') {
    return 'id';
  }

  const normalized = value.trim().toLowerCase();
  return normalized === 'en' || normalized === 'en-us' || normalized === 'en_us'
    ? 'en'
    : 'id';
}

function normalizeHistory(value: unknown): Array<{
  role: ChatRole;
  content: string;
}> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(-MAX_HISTORY_MESSAGES)
    .flatMap((item) => {
      if (!item || typeof item !== 'object') {
        return [];
      }

      const message = item as IncomingChatMessage;

      const role: ChatRole | null =
        message.role === 'assistant'
          ? 'assistant'
          : message.role === 'user'
            ? 'user'
            : null;

      if (!role || typeof message.content !== 'string') {
        return [];
      }

      const content = message.content
        .replace(/\u0000/g, '')
        .trim()
        .slice(0, MAX_HISTORY_MESSAGE_CHARS);

      if (!content) {
        return [];
      }

      return [{ role, content }];
    });
}

function normalizeMessage(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, MAX_MESSAGE_CHARS);
}

function normalizeBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  return undefined;
}

function applyRateLimitHeaders<T extends NextResponse>(
  response: T,
  rate: RateLimitResult,
): T {
  response.headers.set('X-RateLimit-Limit', String(rate.limit));
  response.headers.set('X-RateLimit-Remaining', String(rate.remaining));
  response.headers.set('X-RateLimit-Reset', String(rate.resetInSec));

  return response;
}

function jsonWithRateLimit(
  body: unknown,
  status: number,
  rate: RateLimitResult,
): NextResponse {
  return applyRateLimitHeaders(
    NextResponse.json(body, { status }),
    rate,
  );
}

async function callInternalAi(
  body: Record<string, unknown>,
  requestId: string,
): Promise<{
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
}> {
  if (!INTERNAL_AI_URL) {
    throw new Error('INTERNAL_AI_URL_NOT_CONFIGURED');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-request-id': requestId,
  };

  if (AI_SERVICE_TOKEN) {
    headers.Authorization = `Bearer ${AI_SERVICE_TOKEN}`;
  }

  const response = await fetch(`${INTERNAL_AI_URL}/v1/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
  });

  const data = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

function mapUpstreamStatus(status: number): number {
  if (status === 400) return 400;
  if (status === 413) return 413;
  if (status === 429) return 429;

  // Do not expose internal auth/provider/service errors as if they were
  // authentication failures belonging to the browser user.
  return 502;
}

function friendlyUpstreamError(
  status: number,
  data: Record<string, unknown>,
): string {
  if (typeof data.response === 'string' && data.response.trim()) {
    return data.response.trim();
  }

  if (status === 429) {
    return 'Layanan AI sedang penuh. Coba lagi sebentar.';
  }

  if (status === 400) {
    return 'Permintaan AI belum valid. Periksa pesan lalu coba lagi.';
  }

  return 'Layanan AI sedang tidak tersedia. Coba lagi sebentar.';
}

export async function POST(req: NextRequest) {
  if (!AI_CHAT_ENABLED) {
    return NextResponse.json(
      { response: 'AI chat is disabled for now.' },
      { status: 404 },
    );
  }

  const auth = await requireAuth(req);
  if (!auth.ok) {
    return auth.res;
  }

  const ip = getClientIp(req.headers);
  const rate = await enforceRateLimit(
    `rl:ai:chat:${auth.ctx.userId}:${ip}`,
    CHAT_RATE_LIMIT_MAX,
    CHAT_RATE_LIMIT_WINDOW_SEC,
  );

  if (!rate.allowed) {
    return jsonWithRateLimit(
      {
        status: 'busy',
        response: 'Terlalu banyak permintaan. Silakan coba lagi sebentar ya.',
        error: 'RATE_LIMITED',
      },
      429,
      rate,
    );
  }

  try {
    const body = (await req.json()) as ChatRequestBody;

    const message = normalizeMessage(body.message);

    // Support both the old frontend payload (`context`) and the new one
    // (`messages`). Both are normalized into ai_service's `messages` field.
    const historySource = Array.isArray(body.messages)
      ? body.messages
      : body.context;

    const messages = normalizeHistory(historySource);

    if (!message && messages.length === 0) {
      return jsonWithRateLimit(
        {
          status: 'error',
          response: 'Kirim dulu pertanyaan atau pesan yang ingin kamu tanyakan ya.',
          error: 'MESSAGE_REQUIRED',
        },
        400,
        rate,
      );
    }

    const requestId =
      req.headers.get('x-request-id')?.trim() || crypto.randomUUID();

    const useRag =
      normalizeBoolean(body.use_rag) ??
      normalizeBoolean(body.useRag);

    const aiPayload: Record<string, unknown> = {
      task: 'chat',
      message,
      messages,
      locale: normalizeLocale(body.locale),
    };

    if (typeof useRag === 'boolean') {
      aiPayload.use_rag = useRag;
    }

    if (
      body.ai_context !== undefined &&
      body.ai_context !== null
    ) {
      aiPayload.context = body.ai_context;
    }

    if (body.memory !== undefined && body.memory !== null) {
      aiPayload.memory = body.memory;
    }

    const upstream = await callInternalAi(aiPayload, requestId);

    if (!upstream.ok) {
      console.warn('[AI_CHAT_UPSTREAM_ERROR]', {
        requestId,
        status: upstream.status,
        error:
          typeof upstream.data.error === 'string'
            ? upstream.data.error
            : undefined,
      });

      return jsonWithRateLimit(
        {
          ...upstream.data,
          status: 'error',
          request_id: requestId,
          response: friendlyUpstreamError(
            upstream.status,
            upstream.data,
          ),
        },
        mapUpstreamStatus(upstream.status),
        rate,
      );
    }

    const response = jsonWithRateLimit(
      {
        ...upstream.data,

        // Compatibility contract for existing Lajukan chat UI.
        response:
          typeof upstream.data.response === 'string'
            ? upstream.data.response
            : typeof upstream.data.message === 'string'
              ? upstream.data.message
              : '',
      },
      200,
      rate,
    );

    response.headers.set('x-request-id', requestId);
    response.headers.set('Cache-Control', 'no-store');

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'UNKNOWN_ERROR';

    console.error('[AI_CHAT_ERROR]', error);

    const isTimeout =
      error instanceof DOMException && error.name === 'TimeoutError';

    const isNetwork =
      error instanceof TypeError ||
      message === 'fetch failed' ||
      message.includes('ECONNREFUSED') ||
      message.includes('ENOTFOUND');

    const isMissingConfig =
      message === 'INTERNAL_AI_URL_NOT_CONFIGURED';

    return jsonWithRateLimit(
      {
        status: 'error',
        response: isMissingConfig
          ? 'Layanan AI internal belum dikonfigurasi.'
          : isTimeout
            ? 'Layanan AI membutuhkan waktu terlalu lama. Coba lagi sebentar.'
            : isNetwork
              ? 'Koneksi ke layanan AI gagal. Coba lagi sebentar.'
              : 'Terjadi kesalahan saat memproses permintaan AI.',
        error: isMissingConfig
          ? 'AI_NOT_CONFIGURED'
          : isTimeout
            ? 'AI_TIMEOUT'
            : isNetwork
              ? 'AI_UNREACHABLE'
              : 'AI_REQUEST_FAILED',
      },
      isMissingConfig ? 503 : 502,
      rate,
    );
  }
}

