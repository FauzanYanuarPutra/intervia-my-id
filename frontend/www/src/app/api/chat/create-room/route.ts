import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';

const CHAT_URL = process.env.INTERNAL_CHAT_URL || 'http://localhost:4000';
const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8080';
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

function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, '').toLowerCase();
}

function isValidUsername(value: string): boolean {
  return /^[a-z0-9_.]{3,30}$/.test(value) && !value.includes('..');
}

async function resolvePeerUserIdByUsername(
  username: string,
  token: string,
): Promise<
  { id: string; username?: string | null; full_name?: string | null } | null
> {
  const normalized = normalizeUsername(username);
  if (!normalized || !isValidUsername(normalized)) return null;

  const searchQueries = Array.from(
    new Set([normalized, `@${normalized}`].map(value => value.trim()).filter(Boolean)),
  );

  for (const query of searchQueries) {
    const params = new URLSearchParams({ q: query, limit: '32' });
    const res = await fetch(`${API_URL}/users/discover?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) continue;

    const payload = (await res.json().catch(() => ({}))) as {
      data?: Array<{
        id?: unknown;
        username?: unknown;
        full_name?: unknown;
      }>;
    };

    const exact = Array.isArray(payload.data)
      ? payload.data.find(
          item => normalizeUsername(String(item.username || '')) === normalized,
        )
      : undefined;

    if (exact) {
      const id = typeof exact.id === 'string' ? exact.id.trim() : '';
      if (!id) continue;
      return {
        id,
        username:
          typeof exact.username === 'string' ? exact.username.trim() : null,
        full_name:
          typeof exact.full_name === 'string' ? exact.full_name.trim() : null,
      };
    }
  }

  const fallback = await fetch(
    `${API_URL}/users/discover?${new URLSearchParams({ q: normalized, limit: '100' }).toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    },
  );
  if (!fallback.ok) return null;

  const fallbackPayload = (await fallback.json().catch(() => ({}))) as {
    data?: Array<{
      id?: unknown;
      username?: unknown;
      full_name?: unknown;
    }>;
  };
  const fallbackExact = Array.isArray(fallbackPayload.data)
    ? fallbackPayload.data.find(
        item => normalizeUsername(String(item.username || '')) === normalized,
      )
    : undefined;
  if (!fallbackExact) return null;

  const id = typeof fallbackExact.id === 'string' ? fallbackExact.id.trim() : '';
  if (!id) return null;

  return {
    id,
    username:
      typeof fallbackExact.username === 'string'
        ? fallbackExact.username.trim()
        : null,
    full_name:
      typeof fallbackExact.full_name === 'string'
        ? fallbackExact.full_name.trim()
        : null,
  };
}

function buildLeadPayload(
  input: any,
  roomId: string,
  peerUserId?: string,
  username?: string,
): Record<string, any> {
  const lead: Record<string, any> = {};
  if (input && typeof input === 'object') {
    if (typeof input.name === 'string') lead.name = input.name;
    if (typeof input.sector === 'string') lead.sector = input.sector;
    if (typeof input.source === 'string') lead.source = input.source;
    if (typeof input.stage === 'string') lead.stage = input.stage;
    if (typeof input.currency === 'string') lead.currency = input.currency;
    if (typeof input.chat_room_id === 'string') lead.chat_room_id = input.chat_room_id;
    if (input.value_cents != null) lead.value_cents = input.value_cents;
    if (typeof input.content_id === 'string' && isUuidLike(input.content_id)) {
      lead.content_id = input.content_id;
    }
    if (input.metadata && typeof input.metadata === 'object') lead.metadata = input.metadata;
  }

  if (!lead.source) lead.source = 'chat';
  if (!lead.name) {
    lead.name = username ? `Chat with @${username}` : 'Chat lead';
  }
  if (!lead.chat_room_id) lead.chat_room_id = roomId;
  if (peerUserId && isUuidLike(peerUserId)) {
    lead.contact_user_id = peerUserId;
  }

  return lead;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const ip = getClientIp(req);
    const ipRateLimit = await enforceRateLimit({
      key: `chat:create-room:ip:${ip}`,
      limit: 120,
      windowSeconds: 900,
    });
    if (!ipRateLimit.ok) return ipRateLimit.response;

    const userRateLimit = await enforceRateLimit({
      key: `chat:create-room:user:${auth.ctx.userId}`,
      limit: 80,
      windowSeconds: 900,
    });
    if (!userRateLimit.ok) return userRateLimit.response;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const leadInput =
      payload.lead && typeof payload.lead === 'object'
        ? (payload.lead as Record<string, unknown>)
        : null;
    const skipLead = payload.skip_lead === true;
    const peerUserId =
      typeof payload.peer_user_id === 'string' ? payload.peer_user_id.trim() : '';
    const roomType = typeof payload.room_type === 'string' ? payload.room_type.trim() : '';
    const roomName = typeof payload.room_name === 'string' ? payload.room_name.trim() : '';
    const memberIds = Array.isArray(payload.member_ids)
      ? payload.member_ids.filter(id => typeof id === 'string')
      : [];
    const rawUsername =
      typeof payload.username === 'string'
        ? payload.username
        : typeof payload.contact === 'string'
          ? payload.contact
          : '';

    if ((roomType === 'group' || memberIds.length > 0) && !rawUsername.trim()) {
      const res = await fetch(`${CHAT_URL}/api/v1/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.ctx.token}`,
        },
        body: JSON.stringify({
          room_type: 'group',
          room_name: roomName || 'Group Chat',
          member_ids: memberIds,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return NextResponse.json(
          {
            error:
              (errorData as { error?: string }).error ||
              'Failed to create group room',
          },
          { status: res.status },
        );
      }

      const data = (await res.json()) as {
        data?: { room_id?: string; room_name?: string };
        room_id?: string;
        room_name?: string;
      };
      const roomId = data?.data?.room_id ?? data?.room_id;
      return NextResponse.json(
        roomId
          ? { room_id: roomId, room_name: data?.data?.room_name ?? data?.room_name }
          : data,
        { status: 201 },
      );
    }

    if (peerUserId && isUuidLike(peerUserId)) {
      const res = await fetch(`${CHAT_URL}/api/v1/dm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.ctx.token}`,
        },
        body: JSON.stringify({ peer_user_id: peerUserId }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return NextResponse.json(
          {
            error:
              (errorData as { error?: string }).error ||
              'Failed to create chat room',
          },
          { status: res.status },
        );
      }

      const data = (await res.json()) as {
        data?: { room_id?: string };
        room_id?: string;
        room_name?: string;
      };
      const roomId = data?.data?.room_id ?? data?.room_id;
      if (roomId && !skipLead) {
        const leadPayload = buildLeadPayload(leadInput, roomId, peerUserId);
        try {
          await fetch(`${MARKETPLACE_URL}/v1/crm/leads`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${auth.ctx.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(leadPayload),
          });
        } catch (leadError) {
          console.error('[CRM_LEAD_CREATE_ERROR]', leadError);
        }
      }

      return NextResponse.json(
        roomId ? { room_id: roomId, room_name: data?.room_name } : data,
        { status: 201 },
      );
    }

    const normalizedUsername = normalizeUsername(rawUsername).slice(0, 30);
    if (!isValidUsername(normalizedUsername)) {
      return NextResponse.json(
        {
          error:
            'Username is required. Use a valid username, not email or phone number.',
        },
        { status: 400 },
      );
    }

    const resolved = await resolvePeerUserIdByUsername(
      normalizedUsername,
      auth.ctx.token,
    );
    if (!resolved) {
      return NextResponse.json(
        { error: 'No user found with that username.' },
        { status: 404 },
      );
    }

    const res = await fetch(`${CHAT_URL}/api/v1/dm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.ctx.token}`,
      },
      body: JSON.stringify({ peer_user_id: resolved.id }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(
        {
          error:
            (errorData as { error?: string }).error || 'Failed to create chat room',
        },
        { status: res.status },
      );
    }

    const data = (await res.json()) as {
      data?: { room_id?: string };
      room_id?: string;
      room_name?: string;
    };
    const roomId = data?.data?.room_id ?? data?.room_id;
    if (roomId && !skipLead) {
      const leadPayload = buildLeadPayload(
        leadInput,
        roomId,
        resolved.id,
        resolved.username || normalizedUsername,
      );
      try {
        await fetch(`${MARKETPLACE_URL}/v1/crm/leads`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${auth.ctx.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(leadPayload),
        });
      } catch (leadError) {
        console.error('[CRM_LEAD_CREATE_ERROR]', leadError);
      }
    }

    return NextResponse.json(
      roomId ? { room_id: roomId, room_name: data?.room_name } : data,
      { status: 201 },
    );
  } catch (e) {
    console.error('Create room error:', e);
    return NextResponse.json(
      { error: 'Chat service unavailable' },
      { status: 503 },
    );
  }
}
