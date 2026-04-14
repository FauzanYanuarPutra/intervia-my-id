'use client';

import { useEffect, useRef } from 'react';
import { Phone, Video, X } from 'lucide-react';
import { soundManager } from '@/lib/soundManager';

interface IncomingCallProps {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  callType: 'video' | 'voice';
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCall({
  callId,
  callerId,
  callerName,
  callerAvatar,
  callType,
  onAccept,
  onReject,
}: IncomingCallProps) {
  const acceptedRef = useRef(false);

  useEffect(() => {
    soundManager.play('callAlert');
    soundManager.startLoop('incomingRing');
    return () => {
      soundManager.stopLoop('incomingRing');
      if (!acceptedRef.current) {
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
    <div className="fixed inset-0 z-[60] bg-[color:color-mix(in_srgb,_var(--app-overlay)_50%,_transparent)] backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-h-[80svh] w-full max-w-md overflow-y-auto rounded-2xl bg-[color:var(--app-surface-strong)] p-8 shadow-2xl animate-in fade-in zoom-in duration-300 dark:bg-[color:var(--app-surface-strong)]">
        <div className="text-center space-y-6">
          {/* Avatar */}
          <div className="flex justify-center">
            {callerAvatar ? (
              <img
                src={callerAvatar}
                alt={callerName}
                className="w-24 h-24 rounded-full object-cover border-4 border-[color:var(--app-accent-border)]"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-[color:var(--app-accent)] flex items-center justify-center border-4 border-[color:var(--app-accent-border)]">
                <span className="text-3xl font-bold text-[color:var(--app-text-inverse)]">
                  {callerName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Caller name */}
          <div>
            <h2 className="text-2xl font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              {callerName}
            </h2>
            <p className="text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] mt-2">
              {callType === 'video'
                ? 'Incoming video call'
                : 'Incoming voice call'}
            </p>
          </div>

          {/* Call icon animation */}
          <div className="flex justify-center">
            {callType === 'video' ? (
              <Video className="w-16 h-16 text-[color:var(--app-accent)] animate-pulse" />
            ) : (
              <Phone className="w-16 h-16 text-[color:var(--app-accent)] animate-pulse" />
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-4 pt-4">
            <button
              onClick={handleReject}
              className="p-4 rounded-full bg-[color:var(--app-danger)] hover:bg-[color:var(--app-danger)] text-[color:var(--app-text-inverse)] transition-colors shadow-lg"
              aria-label="Reject call"
            >
              <X className="w-6 h-6" />
            </button>
            <button
              onClick={handleAccept}
              className="p-4 rounded-full bg-[color:var(--app-accent)] hover:bg-[color:var(--app-accent-strong)] text-[color:var(--app-text-inverse)] transition-colors shadow-lg"
              aria-label="Accept call"
            >
              {callType === 'video' ? (
                <Video className="w-6 h-6" />
              ) : (
                <Phone className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
