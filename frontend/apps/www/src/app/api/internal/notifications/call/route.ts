import { NextRequest, NextResponse } from 'next/server';

import {
  deletePushEndpoint,
  listPushSubscriptions,
} from '@/lib/server/pushSubscriptions';
import { sendWebPush } from '@/lib/server/webPush';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(req: NextRequest) {
  const configured = String(process.env.INTERNAL_PUSH_SECRET || '').trim();
  const supplied = String(
    req.headers.get('x-internal-push-secret') || '',
  ).trim();

  return Boolean(configured && supplied && configured === supplied);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  const targetUserId =
    typeof body?.target_user_id === 'string' ? body.target_user_id.trim() : '';

  if (!targetUserId) {
    return NextResponse.json(
      { error: 'target_user_id_required' },
      { status: 400 },
    );
  }

  try {
    const subscriptions = await listPushSubscriptions(targetUserId);
    let sent = 0;
    let expired = 0;

    const pushType = typeof body?.type === 'string' ? body.type : 'incoming_call';

    for (const subscription of subscriptions) {
      try {
        const isCleanup = pushType === 'call_end';
        const result = await sendWebPush(
          subscription,
          isCleanup
            ? {
                type: 'call_end',
                call_id: body?.call_id,
                tag:
                  typeof body?.call_id === 'string'
                    ? `incoming-call:${body.call_id}`
                    : 'incoming-call',
              }
            : pushType === 'chat_message'
            ? {
                type: 'chat_message',
                room_id: body?.room_id,
                sender_id: body?.sender_id,
                sender_username: body?.sender_username,
                message_type: body?.message_type,
                title:
                  typeof body?.sender_username === 'string' &&
                  body.sender_username.trim()
                    ? body.sender_username.trim()
                    : 'Pesan baru',
                body:
                  typeof body?.body === 'string' && body.body.trim()
                    ? body.body.trim().slice(0, 240)
                    : 'Ada pesan baru di chat Lajukan.',
                url:
                  typeof body?.room_id === 'string'
                    ? '/id/chat/' + encodeURIComponent(body.room_id)
                    : '/id/chat',
                tag:
                  typeof body?.room_id === 'string'
                    ? 'chat:' + body.room_id
                    : 'chat-message',
                renotify: false,
              }
            : {
                type: 'incoming_call',
                call_id: body?.call_id,
                room_id: body?.room_id,
                caller_id: body?.caller_id,
                caller_username: body?.caller_username,
                caller_avatar: body?.caller_avatar,
                caller_avatar_style: body?.caller_avatar_style,
                call_type: body?.call_type === 'video' ? 'video' : 'voice',
                title:
                  body?.call_type === 'video'
                    ? 'Panggilan video masuk'
                    : 'Panggilan suara masuk',
                body:
                  typeof body?.caller_username === 'string'
                    ? `${body.caller_username} menghubungi kamu`
                    : 'Ada panggilan masuk',
                url:
                  typeof body?.room_id === 'string'
                    ? `/id/chat/${encodeURIComponent(body.room_id)}?incomingCall=1`
                    : '/id/chat',
                tag:
                  typeof body?.call_id === 'string'
                    ? `incoming-call:${body.call_id}`
                    : 'incoming-call',
                requireInteraction: true,
                renotify: true,
              },
        );

        if (result === 'ok') {
          sent += 1;
        } else {
          expired += 1;
          await deletePushEndpoint(subscription.endpoint);
        }
      } catch (error) {
        console.warn(
          '[INTERNAL_CALL_PUSH_FAILED]',
          subscription.endpoint,
          error,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      subscriptions: subscriptions.length,
      sent,
      expired,
    });
  } catch (error) {
    console.error('[INTERNAL_CALL_PUSH_GATEWAY_FAILED]', error);
    return NextResponse.json(
      { error: 'push_gateway_unavailable' },
      { status: 503 },
    );
  }
}