'use client';

import { useEffect, useRef } from 'react';
import { Phone, Video, X } from 'lucide-react';
import { profileAvatarSrc } from '@/lib/profile/avatar';
import { readCallAlertPreferences } from '@/lib/callPreferences';
import { soundManager } from '@/lib/soundManager';

interface IncomingCallProps {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callerAvatarStyle?: unknown;
  callType: 'video' | 'voice';
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCall({
  callId,
  callerId,
  callerName,
  callerAvatar,
  callerAvatarStyle,
  callType,
  onAccept,
  onReject,
}: IncomingCallProps) {
  const acceptedRef = useRef(false);

  useEffect(() => {
    const preferences = readCallAlertPreferences();
    const shouldRing = preferences.enabled && preferences.ringtone;

    if (shouldRing) {
      soundManager.play('callAlert');
      soundManager.startLoop('incomingRing');
    }

    return () => {
      if (shouldRing) {
        soundManager.stopLoop('incomingRing');
      }
      if (!acceptedRef.current && shouldRing) {
        soundManager.play('callEnd');
      }
    };
  }, [callId]);

  const handleAccept = () => {
    acceptedRef.current = true;
    onAccept();
  };

  const handleReject = () => {
    onReject();
  };

  return (
    <div className="ui-layer-modal fixed inset-0 z-[10050] flex h-[100dvh] items-center justify-center overflow-hidden bg-[#0b141a] px-4 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(37,211,102,0.18),transparent_28%),radial-gradient(circle_at_50%_80%,rgba(0,168,132,0.10),transparent_34%)]" />
      <div className="relative z-10 w-full max-w-[420px] rounded-[30px] border border-white/8 bg-[#111b21]/96 p-6 text-white shadow-[0_30px_90px_rgba(0,0,0,0.46)] backdrop-blur-xl sm:p-8">
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <span className="absolute inset-[-12px] animate-pulse rounded-full bg-[#25d366]/10 blur-xl" aria-hidden="true" />
            <img
              src={profileAvatarSrc(
                callerAvatar,
                callerAvatarStyle,
                callerName,
              )}
              alt={callerName}
              className="relative h-28 w-28 rounded-full border-4 border-[#25d366]/55 object-cover shadow-[0_14px_40px_rgba(0,0,0,0.28)] sm:h-32 sm:w-32"
            />
          </div>

          <h2 className="mt-7 max-w-full truncate px-2 text-[clamp(1.35rem,5vw,1.75rem)] font-bold tracking-[-0.02em]">
            {callerName}
          </h2>
          <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-white/55">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#202c33]">
              {callType === 'video' ? <Video className="h-3.5 w-3.5 text-[#25d366]" /> : <Phone className="h-3.5 w-3.5 text-[#25d366]" />}
            </span>
            {callType === 'video' ? 'Panggilan video masuk' : 'Panggilan suara masuk'}
          </p>

          <div className="mt-9 grid w-full grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleReject}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-[#d14343] px-5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(209,67,67,0.24)] transition hover:bg-[#c63737] active:scale-[0.98]"
              aria-label="Reject call"
            >
              <X className="h-5 w-5" />
              Tolak
            </button>
            <button
              type="button"
              onClick={handleAccept}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-[#25d366] px-5 text-sm font-bold text-[#071c14] shadow-[0_10px_26px_rgba(37,211,102,0.24)] transition hover:bg-[#22c55e] active:scale-[0.98]"
              aria-label="Accept call"
            >
              {callType === 'video' ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
              Jawab
            </button>
          </div>

          <p className="mt-4 text-[11px] font-medium text-white/30">
            Lajukan
          </p>
        </div>
      </div>
    </div>
  );
}
