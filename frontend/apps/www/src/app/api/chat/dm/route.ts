import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';

const CHAT_URL = process.env.INTERNAL_CHAT_URL || 'http://localhost:4000';
const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

function isUuidLike(value: string | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function buildLeadPayload(
  input: unknown,
  roomId: string,
  peerUserId?: string,
): Record<string, unknown> {
  const lead: Record<string, unknown> = {};
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const source = input as Record<string, unknown>;
    if (typeof source.name === 'string') lead.name = source.name;
    if (typeof source.sector === 'string') lead.sector = source.sector;
    if (typeof source.source === 'string') lead.source = source.source;
    if (typeof source.stage === 'string') lead.stage = source.stage;
    if (typeof source.currency === 'string') lead.currency = source.currency;
    if (typeof source.chat_room_id === 'string') lead.chat_room_id = source.chat_room_id;
    if (source.value_cents != null) lead.value_cents = source.value_cents;
    if (typeof source.content_id === 'string' && isUuidLike(source.content_id)) {
      lead.content_id = source.content_id;
    }
    if (source.metadata && typeof source.metadata === 'object') {
      lead.metadata = source.metadata;
    }
  }

  if (!lead.source) lead.source = 'chat';
  if (!lead.name) {
    lead.name = peerUserId ? `Chat with ${peerUserId.slice(0, 8)}` : 'Chat lead';
  }
  if (!lead.chat_room_id) lead.chat_room_id = roomId;
  if (peerUserId && isUuidLike(peerUserId)) {
    lead.contact_user_id = peerUserId;
  }

  return lead;
}

export async function POST(req: NextRequest) {
  let peerUserId: string | undefined;
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const ip = getClientIp(req);
    const ipRateLimit = await enforceRateLimit({
      key: `chat:dm:create:ip:${ip}`,
      limit: 90,
      windowSeconds: 900,
    });
    if (!ipRateLimit.ok) return ipRateLimit.response;

    const userRateLimit = await enforceRateLimit({
      key: `chat:dm:create:user:${auth.ctx.userId}`,
      limit: 60,
      windowSeconds: 900,
    });
    if (!userRateLimit.ok) return userRateLimit.response;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const peerUserIdRaw =
      typeof payload.peer_user_id === 'string' ? payload.peer_user_id.trim() : '';
    peerUserId = peerUserIdRaw;

    const leadInput =
      payload.lead && typeof payload.lead === 'object'
        ? (payload.lead as Record<string, unknown>)
        : null;
    const skipLead = payload.skip_lead === true;

    if (!peerUserIdRaw) {
      return NextResponse.json(
        { error: 'peer_user_id is required' },
        { status: 400 }
      );
    }
    if (!isUuidLike(peerUserIdRaw)) {
      return NextResponse.json(
        { error: 'Invalid peer_user_id format' },
        { status: 400 }
      );
    }

    const res = await fetch(`${CHAT_URL}/api/v1/dm`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.ctx.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ peer_user_id: peerUserIdRaw }),
    });

    const data = await res.json().catch(() => ({})) as { data?: { room_id?: string }; room_id?: string; error?: string };
    const roomId = data.room_id ?? data.data?.room_id;
    if (res.ok && roomId) {
      if (!skipLead) {
        const leadPayload = buildLeadPayload(leadInput, roomId, peerUserId);
        void fetch(`${MARKETPLACE_URL}/v1/crm/leads`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${auth.ctx.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(leadPayload),
        }).catch((leadError) => {
          console.error('[CRM_LEAD_CREATE_ERROR]', leadError);
        });
      }
      return NextResponse.json({ room_id: roomId }, { status: res.status });
    }
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[DM_CREATE_ERROR]', error);
    return NextResponse.json(
      { error: 'Chat service unavailable' },
      { status: 503 },
    );
  }
}
