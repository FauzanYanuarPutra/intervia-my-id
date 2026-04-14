import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { withIdempotency } from '@/lib/idempotency';
import {
  TransactionActionSchema,
  TransactionDisputeSchema,
} from '@/lib/transactionSchemas';
import { withProtectedRoute, buildForwardAuthHeaders } from '@/lib/api/withProtectedRoute';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const raw = await req.json().catch(() => null);
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    let normalizedPayload: Record<string, unknown> | null = null;
    const parsed = TransactionDisputeSchema.safeParse(raw);
    if (parsed.success) {
      normalizedPayload = parsed.data as Record<string, unknown>;
    } else {
      const idemKey = req.headers.get('x-idempotency-key') || '';
      const isLegacyChatRequest = idemKey.startsWith('chat-dispute-');
      if (!isLegacyChatRequest) {
        return NextResponse.json(
          {
            error:
              'Invalid request body. Dispute requires reason_code, evidence_note, and evidence_attachments.',
          },
          { status: 400 }
        );
      }

      const legacy = TransactionActionSchema.safeParse(raw);
      if (!legacy.success) {
        return NextResponse.json(
          { error: 'Invalid request body' },
          { status: 400 }
        );
      }

      const msgRaw = legacy.data.response_message ?? legacy.data.message;
      const message = typeof msgRaw === 'string' ? msgRaw.trim() : '';
      if (!message) {
        return NextResponse.json(
          { error: 'Dispute reason is required' },
          { status: 400 }
        );
      }

      const hash = crypto.createHash('sha256').update(message).digest('hex');
      normalizedPayload = {
        response_message: message,
        evidence_note: message,
        reason_code: 'other',
        evidence_attachments: [
          {
            evidence_type: 'chat_export',
            external_ref: `chat_self_report:${id}:${Date.now()}`,
            file_hash_sha256: hash,
            description: 'Auto-generated evidence from legacy chat dispute payload',
          },
        ],
      };
    }

    return withProtectedRoute(
      req,
      {
        routeKey: 'tx-dispute',
        ipLimit: 180,
        deviceLimit: 120,
        windowSeconds: 900,
      },
      async (ctx) =>
        withIdempotency(req, {
          scope: `tx-dispute:${id}`,
          actorHint: ctx.token,
          forward: () =>
            fetch(`${MARKETPLACE_URL}/v1/transactions/${id}/dispute`, {
              method: 'PUT',
              headers: buildForwardAuthHeaders(ctx, {
                'Content-Type': 'application/json',
                'X-Idempotency-Key': req.headers.get('x-idempotency-key') || '',
              }),
              body: JSON.stringify(normalizedPayload),
            }),
        }),
    );
  } catch (error) {
    console.error('[TRANSACTION_DISPUTE_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
