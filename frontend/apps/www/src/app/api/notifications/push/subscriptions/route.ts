import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/serverAuth';
import {
  deletePushSubscription,
  ensurePushSubscriptionTable,
  upsertPushSubscription,
} from '@/lib/server/pushSubscriptions';
import { getWebPushPublicKey } from '@/lib/server/webPush';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanString(value: unknown, max = 4096): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function isValidSubscriptionEndpoint(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.length > 0;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  try {
    await ensurePushSubscriptionTable();
    return NextResponse.json({
      enabled: Boolean(getWebPushPublicKey()),
      publicKey: getWebPushPublicKey(),
    });
  } catch (error) {
    console.error('[PUSH_SUBSCRIPTIONS_STATUS_FAILED]', error);
    return NextResponse.json(
      { enabled: false, publicKey: null, error: 'push_storage_unavailable' },
      { status: 503 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const endpoint = cleanString(body.endpoint, 8_000);
    const p256dh = cleanString(body.p256dh, 512);
    const authSecret = cleanString(body.auth, 512);

    if (
      !isValidSubscriptionEndpoint(endpoint) ||
      !p256dh ||
      !authSecret ||
      !getWebPushPublicKey()
    ) {
      return NextResponse.json(
        { error: 'invalid_or_unavailable_push_subscription' },
        { status: 400 },
      );
    }

    await upsertPushSubscription({
      userId: auth.ctx.userId,
      endpoint,
      p256dh,
      auth: authSecret,
      userAgent: req.headers.get('user-agent'),
      deviceLabel: cleanString(body.deviceLabel, 120) || null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[PUSH_SUBSCRIPTIONS_SAVE_FAILED]', error);
    return NextResponse.json(
      { error: 'push_subscription_unavailable' },
      { status: 503 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const endpoint = cleanString(body.endpoint, 8_000);
    if (!endpoint) {
      return NextResponse.json({ error: 'endpoint_required' }, { status: 400 });
    }

    await deletePushSubscription(auth.ctx.userId, endpoint);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[PUSH_SUBSCRIPTIONS_DELETE_FAILED]', error);
    return NextResponse.json(
      { error: 'push_subscription_unavailable' },
      { status: 503 },
    );
  }
}