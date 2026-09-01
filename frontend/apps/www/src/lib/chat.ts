import type { Channel } from 'phoenix';
import { getSocketWhenOpen } from './socket';

export type ChatMessageReference = {
  message_id: string;
  mode: 'reply' | 'quote';
  sender_id?: string;
  sender_name?: string;
  content: string;
  message_type?: string;
  attachments?: string[];
  created_at?: string;
};

type MessageExtras = {
  message_type?: string;
  attachments?: string[];
  reply_to_message_id?: string;
  reply_mode?: 'reply' | 'quote';
  reply_to?: ChatMessageReference;
};

export type SocketSendResult = {
  ok: boolean;
  message_id: string;
  sent_at: string;
  content?: string;
  message_type?: string;
  attachments?: string[];
  reference?: ChatMessageReference | null;
  reply_to?: ChatMessageReference | null;
};

export async function joinRoom(roomId: string, token: string): Promise<Channel> {
  const normalizedRoomId = (() => {
    try {
      return decodeURIComponent(roomId);
    } catch {
      return roomId;
    }
  })();
  const socket = await getSocketWhenOpen(token, 15000);
  const channel: Channel = socket.channel(`room:${normalizedRoomId}`, {});

  return new Promise<Channel>((resolve, reject) => {
    channel
      .join(20000)
      .receive('ok', () => resolve(channel))
      .receive('error', (resp: unknown) => {
        const reason =
          typeof resp === 'object' && resp !== null && 'reason' in resp
            ? String((resp as { reason?: unknown }).reason ?? '')
            : '';
        const lower = reason.toLowerCase();
        if (
          typeof window !== 'undefined' &&
          (lower.includes('unauthorized') || lower.includes('invalid') || lower.includes('token'))
        ) {
          window.dispatchEvent(new Event('auth:invalid-token'));
        }
        try {
          channel.leave();
        } catch {
          // Ignore cleanup errors.
        }
        reject(new Error(`Failed to join room:${normalizedRoomId} (${JSON.stringify(resp)})`));
      })
      .receive('timeout', () => {
        // Timeout is often transient network/proxy issue in production.
        // Do not force logout here; caller should retry/reconnect gracefully.
        try {
          channel.leave();
        } catch {
          // Ignore cleanup errors.
        }
        reject(new Error(`Join timeout for room:${normalizedRoomId}`));
      });
  });
}

export async function joinUserChannel(userId: string, token: string): Promise<Channel> {
  const socket = await getSocketWhenOpen(token, 15000);
  const channel: Channel = socket.channel(`user:${userId}`, {});

  return new Promise<Channel>((resolve, reject) => {
    channel
      .join(20000)
      .receive('ok', () => resolve(channel))
      .receive('error', (resp: unknown) => {
        const reason =
          typeof resp === 'object' && resp !== null && 'reason' in resp
            ? String((resp as { reason?: unknown }).reason ?? '')
            : '';
        const lower = reason.toLowerCase();
        if (
          typeof window !== 'undefined' &&
          (lower.includes('unauthorized') || lower.includes('invalid') || lower.includes('token'))
        ) {
          window.dispatchEvent(new Event('auth:invalid-token'));
        }
        try {
          channel.leave();
        } catch {
          // Ignore cleanup errors.
        }
        reject(new Error(`Failed to join user channel (${JSON.stringify(resp)})`));
      })
      .receive('timeout', () => {
        try {
          channel.leave();
        } catch {
          // Ignore cleanup errors.
        }
        reject(new Error('[chat] Timeout joining user channel'));
      });
  });
}

export function sendMessage(channel: Channel, message: string, user: string) {
  channel.push('send_message', { body: message, user });
}

export function onMessage(
  channel: Channel,
  callback: (msg: {
    message_id?: string;
    client_ref?: string;
    sender_id?: string;
    body?: string;
    content?: string;
    sent_at?: string;
    message_type?: string;
    attachments?: string[];
  }) => void
): () => void {
  const ref = channel.on('new_message', callback);
  return () => {
    try {
      channel.off('new_message', ref);
    } catch {
      // Ignore cleanup errors.
    }
  };
}

export async function sendMessageViaSocket(
  channel: Channel,
  content: string,
  clientRef: string,
  extras: MessageExtras = {}
): Promise<SocketSendResult> {
  return new Promise<SocketSendResult>((resolve) => {
    const sentAt = new Date().toISOString();

    try {
      channel
        .push('send_message', {
          body: content,
          client_ref: clientRef,
          ...extras,
        }, 20000)
        .receive('ok', (resp: {
          message_id?: string;
          sent_at?: string;
          body?: string;
          content?: string;
          message_type?: string;
          attachments?: string[];
          reference?: ChatMessageReference | null;
          reply_to?: ChatMessageReference | null;
        }) => {
          resolve({
            ok: true,
            message_id: resp.message_id ?? clientRef,
            sent_at: resp.sent_at ?? sentAt,
            content: resp.content ?? resp.body ?? content,
            message_type: resp.message_type ?? extras.message_type ?? 'text',
            attachments: Array.isArray(resp.attachments) ? resp.attachments : (extras.attachments ?? []),
            reference: resp.reference ?? resp.reply_to ?? extras.reply_to ?? null,
            reply_to: resp.reply_to ?? extras.reply_to ?? null,
          });
        })
        .receive('error', (resp: unknown) => {
          console.warn('[chat] send_message error', resp);
          resolve({
            ok: false,
            message_id: clientRef,
            sent_at: sentAt,
            content,
            message_type: extras.message_type ?? 'text',
            attachments: extras.attachments ?? [],
          });
        })
        .receive('timeout', () => {
          console.warn('[chat] send_message timeout');
          resolve({
            ok: false,
            message_id: clientRef,
            sent_at: sentAt,
            content,
            message_type: extras.message_type ?? 'text',
            attachments: extras.attachments ?? [],
          });
        });
    } catch (error) {
      console.error('[chat] send_message push failed', error);
      resolve({
        ok: false,
        message_id: clientRef,
        sent_at: sentAt,
        content,
        message_type: extras.message_type ?? 'text',
        attachments: extras.attachments ?? [],
      });
    }
  });
}
