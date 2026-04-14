import { NextRequest, NextResponse } from 'next/server';
import { withIdempotency } from '@/lib/idempotency';
import { CreateOfferSchema } from '@/lib/transactionSchemas';
import { withProtectedRoute, buildForwardAuthHeaders } from '@/lib/api/withProtectedRoute';
import { withValidatedBody } from '@/lib/api/withValidatedBody';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

export async function POST(req: NextRequest) {
  try {
    const body = await withValidatedBody(req, CreateOfferSchema);
    if (!body.ok) return body.response;
    const { content_id, ...offerData } = body.data;

    if (!content_id) {
      return NextResponse.json({ error: 'content_id is required' }, { status: 400 });
    }

    return withProtectedRoute(
      req,
      {
        routeKey: 'tx-offer',
        ipLimit: 180,
        deviceLimit: 120,
        windowSeconds: 900,
      },
      async (ctx) =>
        withIdempotency(req, {
          scope: `tx-offer:${content_id}`,
          actorHint: ctx.token,
          forward: () =>
            fetch(`${MARKETPLACE_URL}/v1/content/${content_id}/offers`, {
              method: 'POST',
              headers: buildForwardAuthHeaders(ctx, {
                'Content-Type': 'application/json',
                'X-Idempotency-Key': req.headers.get('x-idempotency-key') || '',
              }),
              body: JSON.stringify(offerData),
            }),
        }),
    );
  } catch (error) {
    console.error('[OFFER_CREATE_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

