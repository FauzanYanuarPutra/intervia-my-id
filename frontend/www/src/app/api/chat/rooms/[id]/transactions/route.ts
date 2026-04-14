import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { parseTransactionDelivery } from '@/lib/transactionDelivery';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

type TimelineEntry = {
  event: string;
  status: string;
  actor: string | null;
  at: string | null;
  description?: string;
};

function resolveDmCounterparty(
  roomId: string,
  currentUserId: string,
): string | null {
  const value = String(roomId || '').trim();
  if (!value.startsWith('dm:')) return null;
  const parts = value.split(':');
  if (parts.length < 3) return null;
  const first = (parts[1] || '').trim();
  const second = (parts[2] || '').trim();
  if (!first || !second) return null;
  if (first.toLowerCase() === currentUserId.toLowerCase()) return second;
  if (second.toLowerCase() === currentUserId.toLowerCase()) return first;
  return first;
}

function normalizeRoomId(raw: string): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asIso(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function asStatus(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized || fallback;
}

function buildTransactionTimeline(
  row: Record<string, unknown>,
): TimelineEntry[] {
  const buyerId = typeof row.buyer_id === 'string' ? row.buyer_id : null;
  const sellerId = typeof row.seller_id === 'string' ? row.seller_id : null;
  const createdAt = asIso(row.created_at);
  const updatedAt = asIso(row.updated_at) || createdAt;
  const status = asStatus(row.status, 'pending');
  const protectionStatus = asStatus(row.protection_status, 'awaiting_funding');
  const meta = asRecord(row.transaction_meta);
  const paymentMeta = asRecord(meta.payment);
  const paymentStatus = asStatus(paymentMeta.status, '');
  const fundedAt = asIso(paymentMeta.funded_at);

  const timeline: TimelineEntry[] = [];
  const push = (entry: TimelineEntry) => {
    const exists = timeline.some(
      item =>
        item.event === entry.event &&
        item.status === entry.status &&
        (item.at || '') === (entry.at || ''),
    );
    if (!exists) timeline.push(entry);
  };

  push({
    event: 'created',
    status: 'pending',
    actor: buyerId,
    at: createdAt,
    description: 'Order dibuat buyer',
  });

  if (paymentStatus) {
    push({
      event: `payment_${paymentStatus}`,
      status: paymentStatus,
      actor: buyerId,
      at: fundedAt || updatedAt,
      description:
        paymentStatus === 'paid'
          ? 'Pembayaran terkonfirmasi'
          : paymentStatus === 'partial'
            ? 'Pembayaran sebagian terkonfirmasi'
            : paymentStatus === 'awaiting_payment'
              ? 'Menunggu pembayaran'
              : 'Perubahan status pembayaran',
    });
  }

  if (protectionStatus) {
    push({
      event: `protection_${protectionStatus}`,
      status: protectionStatus,
      actor:
        protectionStatus === 'escrow_released' ||
        protectionStatus === 'refunded'
          ? sellerId
          : buyerId,
      at: updatedAt,
      description:
        protectionStatus === 'funds_held' || protectionStatus === 'on_hold'
          ? 'Dana ditahan di proteksi transaksi'
          : protectionStatus === 'escrow_released'
            ? 'Dana diteruskan ke seller'
            : protectionStatus === 'refunded'
              ? 'Dana dikembalikan ke buyer'
              : 'Perubahan status proteksi',
    });
  }

  if (status !== 'pending') {
    push({
      event: `status_${status}`,
      status,
      actor:
        status === 'completed'
          ? buyerId
          : status === 'cancelled'
            ? null
            : sellerId,
      at: updatedAt,
      description:
        status === 'accepted'
          ? 'Seller menerima order'
          : status === 'in_progress'
            ? 'Order sedang diproses'
            : status === 'delivered'
              ? 'Seller menandai delivered'
              : status === 'completed'
                ? 'Buyer menyelesaikan order'
                : status === 'cancelled'
                  ? 'Order dibatalkan'
                  : status === 'disputed'
                    ? 'Order masuk sengketa'
                    : 'Status order diperbarui',
    });
  }

  const offerMessage =
    typeof row.offer_message === 'string' ? row.offer_message.trim() : '';
  if (offerMessage) {
    push({
      event: 'offer_message',
      status: status,
      actor: buyerId,
      at: createdAt,
      description: `Catatan buyer: ${offerMessage}`,
    });
  }

  const responseMessage =
    typeof row.response_message === 'string' ? row.response_message.trim() : '';
  if (responseMessage) {
    push({
      event: 'response_message',
      status: status,
      actor: sellerId,
      at: updatedAt,
      description: `Catatan seller: ${responseMessage}`,
    });
  }

  const delivery = parseTransactionDelivery(row.transaction_meta);
  delivery.submissions.forEach(submission => {
    push({
      event: `delivery_submission_${submission.attemptNumber || delivery.attemptsUsed}`,
      status: 'delivered',
      actor: sellerId,
      at: submission.submittedAt || updatedAt,
      description:
        submission.title ||
        submission.note ||
        `Seller mengirim hasil kerja attempt ${submission.attemptNumber || delivery.attemptsUsed}/${delivery.maxAttempts}`,
    });

    if (
      submission.reviewStatus === 'accepted' ||
      submission.reviewStatus === 'revision_requested'
    ) {
      push({
        event: `delivery_review_${submission.attemptNumber || delivery.attemptsUsed}`,
        status:
          submission.reviewStatus === 'accepted' ? 'completed' : 'in_progress',
        actor: buyerId,
        at: submission.reviewedAt || updatedAt,
        description:
          submission.buyerFeedbackNote ||
          (submission.reviewStatus === 'accepted'
            ? `Buyer menerima hasil kerja attempt ${submission.attemptNumber || delivery.attemptsUsed}/${delivery.maxAttempts}`
            : `Buyer meminta revisi untuk attempt ${submission.attemptNumber || delivery.attemptsUsed}/${delivery.maxAttempts}`),
      });
    }
  });

  return timeline
    .map((item, idx) => ({ ...item, __idx: idx }))
    .sort((a, b) => {
      const atA = a.at ? new Date(a.at).getTime() : Number.MAX_SAFE_INTEGER;
      const atB = b.at ? new Date(b.at).getTime() : Number.MAX_SAFE_INTEGER;
      if (atA !== atB) return atA - atB;
      return a.__idx - b.__idx;
    })
    .map(item => {
      const next = { ...item };
      delete (next as { __idx?: number }).__idx;
      return next;
    });
}

type CrmLead = {
  requester_user_id?: string | null;
  contact_user_id?: string | null;
  owner_id?: string | null;
};

function pickCounterpartyFromLead(
  lead: CrmLead | null,
  currentUserId: string,
): string | null {
  if (!lead) return null;
  const requester =
    typeof lead.requester_user_id === 'string'
      ? lead.requester_user_id.trim()
      : '';
  const contact =
    typeof lead.contact_user_id === 'string' ? lead.contact_user_id.trim() : '';
  const owner = typeof lead.owner_id === 'string' ? lead.owner_id.trim() : '';

  if (requester && requester.toLowerCase() === currentUserId.toLowerCase())
    return contact || owner || null;
  if (contact && contact.toLowerCase() === currentUserId.toLowerCase())
    return requester || owner || null;
  if (owner && owner.toLowerCase() === currentUserId.toLowerCase())
    return requester || contact || null;

  return contact || requester || owner || null;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;
    const { token, userId } = auth.ctx;

    const { id } = await context.params;
    const roomId = normalizeRoomId(id);
    if (!roomId) {
      return NextResponse.json({ error: 'invalid room id' }, { status: 400 });
    }

    let counterpartyId = resolveDmCounterparty(roomId, userId);
    let source: 'dm' | 'crm' | 'unknown' = counterpartyId ? 'dm' : 'unknown';

    if (!counterpartyId) {
      const leadUrl = new URL('/v1/crm/leads', MARKETPLACE_URL);
      leadUrl.searchParams.set('chat_room_id', roomId);
      leadUrl.searchParams.set('limit', '1');
      const leadRes = await fetch(leadUrl.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const leadPayload = await leadRes.json().catch(() => ({}));
      const lead = Array.isArray((leadPayload as { items?: unknown[] }).items)
        ? (leadPayload as { items: CrmLead[] }).items[0] || null
        : null;
      const viaLead = pickCounterpartyFromLead(lead, userId);
      if (viaLead) {
        counterpartyId = viaLead;
        source = 'crm';
      }
    }

    if (!counterpartyId) {
      return NextResponse.json({
        room_id: roomId,
        counterparty_id: null,
        source,
        transactions: [],
      });
    }

    const txUrl = new URL('/v1/transactions', MARKETPLACE_URL);
    txUrl.searchParams.set('counterparty_id', counterpartyId);
    txUrl.searchParams.set(
      'limit',
      req.nextUrl.searchParams.get('limit') || '100',
    );
    txUrl.searchParams.set(
      'offset',
      req.nextUrl.searchParams.get('offset') || '0',
    );

    const txRes = await fetch(txUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    const txPayload = await txRes.json().catch(() => []);
    if (!txRes.ok) {
      return NextResponse.json(txPayload, { status: txRes.status });
    }

    const transactions = Array.isArray(txPayload)
      ? txPayload
      : Array.isArray((txPayload as { items?: unknown[] }).items)
        ? (txPayload as { items: unknown[] }).items
        : [];

    const enriched = transactions.map(txn => {
      const row = (txn && typeof txn === 'object' ? txn : {}) as Record<
        string,
        unknown
      >;
      return {
        ...row,
        timeline: buildTransactionTimeline(row),
      };
    });

    return NextResponse.json({
      room_id: roomId,
      counterparty_id: counterpartyId,
      source,
      transactions: enriched,
    });
  } catch (error) {
    console.error('[CHAT_ROOM_TRANSACTIONS_ERROR]', error);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
