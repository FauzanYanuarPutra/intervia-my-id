import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP_ENV = process.env.ENV || process.env.APP_ENV || process.env.NODE_ENV;
const IS_PRODUCTION = APP_ENV === 'production';
const CONFIGURED_VERIFY_TOKEN = (
  process.env.WHATSAPP_META_WEBHOOK_VERIFY_TOKEN || ''
).trim();
const PRIMARY_VERIFY_TOKEN = 'lajukan_verify_22012005';
const DEV_VERIFY_TOKEN = 'lajukan-dev-whatsapp-meta-webhook';
const APP_SECRET = (process.env.WHATSAPP_META_APP_SECRET || '').trim();
const REQUIRE_SIGNATURE_SETTING = (
  process.env.WHATSAPP_META_WEBHOOK_REQUIRE_SIGNATURE || ''
)
  .trim()
  .toLowerCase();

const WEBHOOK_AUDIT_KEY = 'webhook:whatsapp-meta:audit';
const WEBHOOK_AUDIT_TTL = 7 * 24 * 60 * 60;
const WEBHOOK_AUDIT_LIMIT = 200;

type WhatsAppWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    time?: number;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
        contacts?: Array<{
          wa_id?: string;
          profile?: {
            name?: string;
          };
        }>;
        messages?: Array<{
          from?: string;
          id?: string;
          timestamp?: string;
          type?: string;
          text?: {
            body?: string;
          };
        }>;
        statuses?: Array<{
          id?: string;
          recipient_id?: string;
          status?: string;
          timestamp?: string;
          conversation?: {
            id?: string;
            origin?: {
              type?: string;
            };
          };
        }>;
      };
    }>;
  }>;
};

type WhatsAppWebhookAudit = {
  receivedAt: string;
  object: string | null;
  entries: Array<{
    id: string | null;
    time: number | null;
    fields: string[];
    phoneNumberId: string | null;
    displayPhoneNumber: string | null;
    contacts: Array<{
      waId: string | null;
      name: string | null;
    }>;
    messages: Array<{
      id: string | null;
      from: string | null;
      type: string | null;
      timestamp: string | null;
      textLength: number | null;
    }>;
    statuses: Array<{
      id: string | null;
      recipientId: string | null;
      status: string | null;
      timestamp: string | null;
      conversationId: string | null;
      conversationOrigin: string | null;
    }>;
  }>;
};

function timingSafeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function requestHost(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-host') ||
    req.headers.get('host') ||
    req.nextUrl.host ||
    ''
  )
    .split(',')[0]
    .trim()
    .toLowerCase();
}

function isPublicLajukanHost(req: NextRequest): boolean {
  const host = requestHost(req);
  return (
    host === 'lajukan.com' ||
    host === 'www.lajukan.com' ||
    host.endsWith('.lajukan.com')
  );
}

function isProductionRequest(req: NextRequest): boolean {
  return IS_PRODUCTION || isPublicLajukanHost(req);
}

function verifyTokensForRequest(req: NextRequest): string[] {
  const tokens = new Set<string>();
  if (CONFIGURED_VERIFY_TOKEN) tokens.add(CONFIGURED_VERIFY_TOKEN);
  tokens.add(PRIMARY_VERIFY_TOKEN);

  if (!isProductionRequest(req)) {
    tokens.add(DEV_VERIFY_TOKEN);
  }

  return Array.from(tokens).filter(Boolean);
}

function matchesVerifyToken(req: NextRequest, token: string): boolean {
  return verifyTokensForRequest(req).some(expected =>
    timingSafeEqual(token, expected),
  );
}

function shouldRequireSignature(req: NextRequest): boolean {
  if (REQUIRE_SIGNATURE_SETTING === 'true') return true;
  if (REQUIRE_SIGNATURE_SETTING === 'false') return false;
  return isProductionRequest(req);
}

function maskPhoneLike(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length <= 4) return `****${digits}`;
  return `****${digits.slice(-4)}`;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function verifyWebhookSignature(req: NextRequest, rawBody: string) {
  const requireSignature = shouldRequireSignature(req);
  if (!APP_SECRET) {
    return {
      ok: !requireSignature,
      reason: requireSignature
        ? 'WHATSAPP_META_APP_SECRET is required to verify webhook signatures'
        : null,
    };
  }

  const signature = (req.headers.get('x-hub-signature-256') || '').trim();
  if (!signature.startsWith('sha256=')) {
    return { ok: false, reason: 'Missing x-hub-signature-256' };
  }

  const expected = `sha256=${crypto
    .createHmac('sha256', APP_SECRET)
    .update(rawBody, 'utf8')
    .digest('hex')}`;

  return {
    ok: timingSafeEqual(signature, expected),
    reason: 'Invalid x-hub-signature-256',
  };
}

function summarizePayload(payload: WhatsAppWebhookPayload): WhatsAppWebhookAudit {
  return {
    receivedAt: new Date().toISOString(),
    object: nullableString(payload.object),
    entries: Array.isArray(payload.entry)
      ? payload.entry.map(entry => {
          const changes = Array.isArray(entry.changes) ? entry.changes : [];
          const fields = changes
            .map(change => nullableString(change.field))
            .filter((field): field is string => Boolean(field));
          const values = changes
            .map(change => change.value)
            .filter((value): value is NonNullable<typeof value> =>
              Boolean(value),
            );

          return {
            id: nullableString(entry.id),
            time: nullableNumber(entry.time),
            fields,
            phoneNumberId:
              values
                .map(value => nullableString(value.metadata?.phone_number_id))
                .find(Boolean) || null,
            displayPhoneNumber:
              values
                .map(value =>
                  maskPhoneLike(value.metadata?.display_phone_number),
                )
                .find(Boolean) || null,
            contacts: values.flatMap(value =>
              Array.isArray(value.contacts)
                ? value.contacts.map(contact => ({
                    waId: maskPhoneLike(contact.wa_id),
                    name: nullableString(contact.profile?.name),
                  }))
                : [],
            ),
            messages: values.flatMap(value =>
              Array.isArray(value.messages)
                ? value.messages.map(message => ({
                    id: nullableString(message.id),
                    from: maskPhoneLike(message.from),
                    type: nullableString(message.type),
                    timestamp: nullableString(message.timestamp),
                    textLength:
                      typeof message.text?.body === 'string'
                        ? message.text.body.length
                        : null,
                  }))
                : [],
            ),
            statuses: values.flatMap(value =>
              Array.isArray(value.statuses)
                ? value.statuses.map(status => ({
                    id: nullableString(status.id),
                    recipientId: maskPhoneLike(status.recipient_id),
                    status: nullableString(status.status),
                    timestamp: nullableString(status.timestamp),
                    conversationId: nullableString(status.conversation?.id),
                    conversationOrigin: nullableString(
                      status.conversation?.origin?.type,
                    ),
                  }))
                : [],
            ),
          };
        })
      : [],
  };
}

async function storeAudit(audit: WhatsAppWebhookAudit) {
  try {
    const redis = getRedis();
    await redis.lpush(WEBHOOK_AUDIT_KEY, JSON.stringify(audit));
    await redis.ltrim(WEBHOOK_AUDIT_KEY, 0, WEBHOOK_AUDIT_LIMIT - 1);
    await redis.expire(WEBHOOK_AUDIT_KEY, WEBHOOK_AUDIT_TTL);
  } catch (error) {
    console.error('Failed to persist WhatsApp Meta webhook audit', error);
  }
}

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode') || '';
  const token = req.nextUrl.searchParams.get('hub.verify_token') || '';
  const challenge = req.nextUrl.searchParams.get('hub.challenge') || '';

  if (
    mode === 'subscribe' &&
    challenge &&
    matchesVerifyToken(req, token)
  ) {
    return new NextResponse(challenge, {
      status: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  }

  return new NextResponse('Forbidden', {
    status: 403,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (!rawBody.trim()) {
      return NextResponse.json({ ok: true, empty: true });
    }

    const signature = verifyWebhookSignature(req, rawBody);
    if (!signature.ok) {
      console.warn('[WhatsApp Meta webhook] rejected', {
        reason: signature.reason,
      });
      return NextResponse.json(
        { error: signature.reason || 'Invalid webhook signature' },
        { status: APP_SECRET || shouldRequireSignature(req) ? 401 : 503 },
      );
    }

    const payload = JSON.parse(rawBody) as WhatsAppWebhookPayload;
    const audit = summarizePayload(payload);
    await storeAudit(audit);

    const messageCount = audit.entries.reduce(
      (total, entry) => total + entry.messages.length,
      0,
    );
    const statusCount = audit.entries.reduce(
      (total, entry) => total + entry.statuses.length,
      0,
    );

    console.log('[WhatsApp Meta webhook]', {
      object: audit.object,
      entries: audit.entries.length,
      fields: Array.from(
        new Set(audit.entries.flatMap(entry => entry.fields)),
      ),
      messages: messageCount,
      statuses: statusCount,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('WhatsApp Meta webhook error', error);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
