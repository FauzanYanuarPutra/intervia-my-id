'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { joinRoom } from '@/lib/chat';
import { soundManager } from '@/lib/soundManager';
import { closeBrowserNotificationsByTag } from '@/lib/browserNotifications';
import { IncomingCall } from './IncomingCall';

type IncomingCallState = {
  callId: string;
  roomId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callerAvatarStyle?: unknown;
  callType: 'video' | 'voice';
  receivedAt: number;
};

const PENDING_KEY = 'lajukan:pending-incoming-call:v1';
const MAX_PENDING_AGE_MS = 55_000;

function currentChatRoomId(pathname: string): string | null {
  const match = pathname.match(/^\/(?:id|en)\/chat\/([^/?#]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function sameId(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function readPendingCall(): IncomingCallState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<IncomingCallState>;
    if (
      typeof value.callId !== 'string' ||
      typeof value.roomId !== 'string' ||
      typeof value.callerId !== 'string' ||
      typeof value.callerName !== 'string' ||
      (value.callType !== 'voice' && value.callType !== 'video') ||
      typeof value.receivedAt !== 'number'
    ) {
      window.sessionStorage.removeItem(PENDING_KEY);
      return null;
    }
    if (Date.now() - value.receivedAt > MAX_PENDING_AGE_MS) {
      window.sessionStorage.removeItem(PENDING_KEY);
      return null;
    }
    return value as IncomingCallState;
  } catch {
    return null;
  }
}

function writePendingCall(call: IncomingCallState | null) {
  if (typeof window === 'undefined') return;
  try {
    if (!call) window.sessionStorage.removeItem(PENDING_KEY);
    else window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(call));
  } catch {
    // Best effort only.
  }
}

export function GlobalIncomingCallController() {
  const { user, accessToken } = useAuth();
  const pathname = usePathname() || '';
  const router = useRouter();
  const [incomingCall, setIncomingCall] = useState<IncomingCallState | null>(
    null,
  );

  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') {
      setIncomingCall(null);
      return;
    }

    const initial = readPendingCall();
    if (initial && !sameId(initial.callerId, user.id)) {
      setIncomingCall(initial);
    }

    const onIncoming = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail;
      if (!detail || !detail.call_id || !detail.room_id || !detail.caller_id) {
        return;
      }

      if (sameId(String(detail.caller_id), String(user.id))) return;

      const activeRoom = currentChatRoomId(window.location.pathname);
      if (activeRoom && sameId(activeRoom, String(detail.room_id))) {
        return;
      }

      const next: IncomingCallState = {
        callId: String(detail.call_id),
        roomId: String(detail.room_id),
        callerId: String(detail.caller_id),
        callerName:
          typeof detail.caller_username === 'string' &&
          detail.caller_username.trim()
            ? detail.caller_username.trim()
            : 'Pengguna Lajukan',
        callerAvatar:
          typeof detail.caller_avatar === 'string'
            ? detail.caller_avatar
            : undefined,
        callerAvatarStyle:
          detail.caller_avatar_style ?? detail.avatar_style,
        callType: detail.call_type === 'video' ? 'video' : 'voice',
        receivedAt: Date.now(),
      };

      writePendingCall(next);
      setIncomingCall(next);
    };

    const onLifecycle = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          event?: string;
          call_id?: string;
        }>
      ).detail;
      if (!detail?.call_id) return;

      setIncomingCall(current => {
        if (!current || current.callId !== detail.call_id) return current;
        writePendingCall(null);
        return null;
      });

      if (detail.event === 'call_rejected' || detail.event === 'call_ended') {
        void closeBrowserNotificationsByTag(
          'incoming-call:' + detail.call_id,
        );
      }
    };

    window.addEventListener(
      'chat:incoming-call',
      onIncoming as EventListener,
    );
    window.addEventListener(
      'chat:call-lifecycle',
      onLifecycle as EventListener,
    );

    return () => {
      window.removeEventListener(
        'chat:incoming-call',
        onIncoming as EventListener,
      );
      window.removeEventListener(
        'chat:call-lifecycle',
        onLifecycle as EventListener,
      );
    };
  }, [user?.id]);

  const clearPending = useCallback(() => {
    writePendingCall(null);
    setIncomingCall(null);
  }, []);

  const openCallRoom = useCallback(
    (call: IncomingCallState, action: 'accept' | 'reject' | 'show') => {
      clearPending();
      const query = new URLSearchParams({
        incomingCall: '1',
        callAction: action,
        callId: call.callId,
      });
      router.push(
        '/chat/' + encodeURIComponent(call.roomId) + '?' + query.toString(),
      );
    },
    [clearPending, router],
  );

  const rejectCall = useCallback(async () => {
    const call = incomingCall;
    clearPending();
    if (!call || !accessToken) return;

    try {
      void soundManager.unlock();
      const channel = await joinRoom(call.roomId, accessToken);
      await new Promise<void>(resolve => {
        channel
          .push('call_reject', { call_id: call.callId }, 8_000)
          .receive('ok', () => resolve())
          .receive('error', () => resolve())
          .receive('timeout', () => resolve());
      });
      channel.leave();
    } catch {
      // The call may already have ended; the server remains authoritative.
    } finally {
      void closeBrowserNotificationsByTag('incoming-call:' + call.callId);
    }
  }, [accessToken, clearPending, incomingCall]);

  if (!incomingCall) return null;

  if (
    currentChatRoomId(pathname) &&
    currentChatRoomId(pathname) === incomingCall.roomId
  ) {
    return null;
  }

  return (
    <IncomingCall
      callId={incomingCall.callId}
      callerId={incomingCall.callerId}
      callerName={incomingCall.callerName}
      callerAvatar={incomingCall.callerAvatar}
      callerAvatarStyle={incomingCall.callerAvatarStyle}
      callType={incomingCall.callType}
      onAccept={() => openCallRoom(incomingCall, 'accept')}
      onReject={rejectCall}
    />
  );
}
