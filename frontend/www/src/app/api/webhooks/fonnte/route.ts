import { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import type { FonnteWebhookEvent } from '@/lib/fonnte';

const WEBHOOK_SECRET = (process.env.FONNTE_WEBHOOK_SECRET || '').trim();
const WEBHOOK_AUDIT_KEY = 'webhook:fonnte:audit';
const WEBHOOK_AUDIT_TTL = 7 * 24 * 60 * 60;
const WEBHOOK_AUDIT_LIMIT = 200;

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function verifyWebhookSecret(req: NextRequest): boolean {
  if (!WEBHOOK_SECRET) return true;

  const headerSecret =
    req.headers.get('x-fonnte-secret') ||
    req.headers.get('x-webhook-secret') ||
    req.nextUrl.searchParams.get('secret') ||
    '';

  return safeEqual(headerSecret.trim(), WEBHOOK_SECRET);
}

async function storeAudit(event: FonnteWebhookEvent) {
  try {
    const redis = getRedis();
    const payload = JSON.stringify({
      receivedAt: new Date().toISOString(),
      event,
    });
    await redis.lpush(WEBHOOK_AUDIT_KEY, payload);
    await redis.ltrim(WEBHOOK_AUDIT_KEY, 0, WEBHOOK_AUDIT_LIMIT - 1);
    await redis.expire(WEBHOOK_AUDIT_KEY, WEBHOOK_AUDIT_TTL);
  } catch (error) {
    console.error('Failed to persist Fonnte webhook audit', error);
  }
}

async function parseIncomingEvent(req: NextRequest): Promise<FonnteWebhookEvent | null> {
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return (await req.json().catch(() => null)) as FonnteWebhookEvent | null;
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await req.formData().catch(() => null);
    if (!formData) return null;

    const event: FonnteWebhookEvent = {};
    formData.forEach((value, key) => {
      event[key] = typeof value === 'string' ? value : String(value);
    });
    return event;
  }

  const text = await req.text().catch(() => '');
  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as FonnteWebhookEvent;
  } catch {
    return {
      message: text,
    };
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  try {
    if (!verifyWebhookSecret(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const event = await parseIncomingEvent(req);
    if (!event) {
      return NextResponse.json({ ok: true, empty: true });
    }

    await storeAudit(event);

    const kind =
      typeof event.status === 'string'
        ? 'status'
        : typeof event.message === 'string' && event.message.trim().length > 0
          ? 'message'
          : 'unknown';

    console.log('[Fonnte webhook]', {
      kind,
      device: event.device || null,
      sender: event.sender || null,
      inboxid: event.inboxid || null,
      status: event.status || null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Fonnte webhook error', error);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}

