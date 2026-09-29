import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';

const INTERNAL_AI_URL = (process.env.INTERNAL_AI_URL || '').replace(/\/+$/, '');
const AI_SERVICE_TOKEN = process.env.AI_SERVICE_TOKEN || '';
const AI_REQUEST_TIMEOUT_MS = 90_000;

const CUSTOM_RATE_LIMIT_WINDOW_SEC = 60;
const CUSTOM_RATE_LIMIT_MAX = 30;

type IncomingMessage = {
  role?: unknown;
  content?: unknown;
};

function normalizeHistory(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .slice(-12)
    .flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const message = item as IncomingMessage;
      const role =
        message.role === 'assistant'
          ? 'assistant'
          : message.role === 'user'
            ? 'user'
            : null;

      if (!role || typeof message.content !== 'string') return [];

      const content = message.content.replace(/\u0000/g, '').trim().slice(0, 6_000);
      return content ? [{ role, content }] : [];
    });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rate = await enforceRateLimit(
    `rl:ai:custom-chat:${ip}`,
    CUSTOM_RATE_LIMIT_MAX,
    CUSTOM_RATE_LIMIT_WINDOW_SEC,
  );

  if (!rate.allowed) {
    const limited = NextResponse.json(
      {
        status: 'busy',
        response: 'Terlalu banyak permintaan. Silakan coba lagi sebentar ya.',
        error: 'RATE_LIMITED',
      },
      { status: 429 },
    );
    limited.headers.set('X-RateLimit-Limit', String(rate.limit));
    limited.headers.set('X-RateLimit-Remaining', String(rate.remaining));
    limited.headers.set('X-RateLimit-Reset', String(rate.resetInSec));
    return limited;
  }

  if (!INTERNAL_AI_URL) {
    return NextResponse.json(
      {
        status: 'error',
        response: 'Layanan AI internal belum dikonfigurasi.',
        error: 'AI_NOT_CONFIGURED',
      },
      { status: 503 },
    );
  }

  try {
    const body = (await req.json()) as {
      message?: unknown;
      context?: unknown;
      messages?: unknown;
      locale?: unknown;
    };

    const message =
      typeof body.message === 'string'
        ? body.message.replace(/\u0000/g, '').trim().slice(0, 6_000)
        : '';

    const historySource = Array.isArray(body.messages)
      ? body.messages
      : body.context;
    const messages = normalizeHistory(historySource);

    if (!message && messages.length === 0) {
      return NextResponse.json(
        {
          status: 'error',
          response: 'Kirim dulu pertanyaan atau kalimat yang ingin kamu tanyakan ya.',
          error: 'MESSAGE_REQUIRED',
        },
        { status: 400 },
      );
    }

    const requestId =
      req.headers.get('x-request-id')?.trim() || crypto.randomUUID();

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
      body: JSON.stringify({
        task: 'chat',
        message,
        messages,
        locale:
          typeof body.locale === 'string' &&
          body.locale.toLowerCase().startsWith('en')
            ? 'en'
            : 'id',
        use_rag: true,
        context: {
          page: {
            pathname: req.nextUrl.pathname,
            search: req.nextUrl.search.slice(0, 1024),
          },
          legacy_endpoint: true,
        },
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    });

    const data = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const output = NextResponse.json(
      {
        ...data,
        response:
          typeof data.response === 'string'
            ? data.response
            : typeof data.message === 'string'
              ? data.message
              : '',
      },
      { status: response.ok ? 200 : response.status >= 500 ? 502 : response.status },
    );

    output.headers.set('X-RateLimit-Limit', String(rate.limit));
    output.headers.set('X-RateLimit-Remaining', String(rate.remaining));
    output.headers.set('X-RateLimit-Reset', String(rate.resetInSec));
    output.headers.set('x-request-id', requestId);
    output.headers.set('Cache-Control', 'no-store');

    return output;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    const timeout =
      error instanceof DOMException && error.name === 'TimeoutError';

    return NextResponse.json(
      {
        status: 'error',
        response: timeout
          ? 'Layanan AI membutuhkan waktu terlalu lama. Coba lagi sebentar.'
          : 'Koneksi ke layanan AI gagal. Coba lagi sebentar.',
        error: timeout ? 'AI_TIMEOUT' : 'AI_UNREACHABLE',
      },
      { status: 502 },
    );
  }
}
