'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import type { Channel } from 'phoenix';
import { Mic, MicOff, PhoneOff, User } from 'lucide-react';
import { getIceConfiguration } from '@/lib/webrtc';
import {
  createCallLifecycle,
  type CallLifecycle,
} from '@/lib/webrtcCallLifecycle';
import { useAuth } from '@/context/AuthContext';
import { soundManager } from '@/lib/soundManager';
import { describeGetUserMediaError, getMediaEnvironmentError } from '@/lib/mediaDevices';
import { MediaPermissionGate } from '@/components/common/MediaPermissionGate';
import { useToast } from '@/components/system/feedback/ToastProvider';

interface VoiceCallProps {
  roomId: string;
  userId: string;
  callId: string;
  channel: Channel | null;
  isCaller?: boolean; // true jika ini yang initiate call
  userName?: string;
  onClose: () => void;
}

export function VoiceCall({ roomId, userId, callId, channel, isCaller = false, userName, onClose }: VoiceCallProps) {
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isRemoteAudioEnabled, setIsRemoteAudioEnabled] = useState(false);
  const [hasLocalAudioTrack, setHasLocalAudioTrack] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'failed'>('connecting');
  const [permissionGranted, setPermissionGranted] = useState(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const lifecycleRef = useRef<CallLifecycle | null>(null);
  const { authFetch } = useAuth();
  const [iceConfiguration, setIceConfiguration] =
    useState<RTCConfiguration | null>(null);
  const lastConnectionSoundRef = useRef(connectionStatus);
  const pathname = usePathname();
  const isId = pathname.startsWith('/id');
  const { notify } = useToast();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const requestClose = useCallback(() => {
    onCloseRef.current();
  }, []);

  const releaseCallResources = useCallback(() => {
    lifecycleRef.current?.dispose();
    lifecycleRef.current = null;
    localStreamRef.current = null;
    setHasLocalAudioTrack(false);
    peerConnectionRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }
    pendingCandidatesRef.current = [];
  }, []);

  const closeCallWithError = useCallback(
    (message: string) => {
      try {
        channel?.push('call_end', { call_id: callId });
      } catch {
        // Ignore signaling failure.
      }
      releaseCallResources();
      notify({
        title: isId ? 'Panggilan gagal' : 'Call failed',
        description: message,
        variant: 'error',
        durationMs: 5000,
      });
      requestClose();
    },
    [callId, channel, isId, notify, releaseCallResources, requestClose],
  );

  const handlePermissionDenied = useCallback(() => {
    try {
      channel?.push('call_end', { call_id: callId });
    } catch {
      // ignore
    }
    releaseCallResources();
    requestClose();
  }, [callId, channel, releaseCallResources, requestClose]);

  const endCall = useCallback(() => {
    try {
      channel?.push('call_end', { call_id: callId });
    } catch {
      // ignore
    }
    soundManager.play('callEnd');
    soundManager.stopLoop('outgoingRing');
    soundManager.stopLoop('incomingRing');
    releaseCallResources();
    requestClose();
  }, [callId, channel, releaseCallResources, requestClose]);

  useEffect(() => {
    let cancelled = false;
    void getIceConfiguration(authFetch)
      .then(configuration => {
        if (!cancelled) setIceConfiguration(configuration);
      })
      .catch(() => {
        if (cancelled) return;
        closeCallWithError(
          isId
            ? 'Panggilan aman sedang tidak tersedia. Coba lagi nanti.'
            : 'Secure calling is temporarily unavailable. Please try again later.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch, closeCallWithError, isId]);

  useEffect(() => {
    soundManager.play('callStart');
    if (isCaller) {
      soundManager.startLoop('outgoingRing');
    }
    return () => {
      soundManager.stopLoop('outgoingRing');
      soundManager.stopLoop('incomingRing');
      soundManager.play('callEnd');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (connectionStatus === 'connected' && lastConnectionSoundRef.current !== 'connected') {
      soundManager.stopLoop('incomingRing');
      soundManager.stopLoop('outgoingRing');
      soundManager.play('callConnected');
    }
    lastConnectionSoundRef.current = connectionStatus;
  }, [connectionStatus]);

  const flushPendingCandidates = () => {
    const pc = peerConnectionRef.current;
    if (!pc || !pc.remoteDescription) return;
    const queue = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    queue.forEach((candidateInit) => {
      pc.addIceCandidate(new RTCIceCandidate(candidateInit)).catch((err) => {
        console.error('[VoiceCall] Error adding pending ICE candidate:', err);
      });
    });
  };

  useEffect(() => {
    if (!channel || !permissionGranted || !iceConfiguration) return;

    const lifecycle = createCallLifecycle();
    lifecycleRef.current = lifecycle;
    let ownedStream: MediaStream | null = null;
    let ownedPeer: RTCPeerConnection | null = null;
    const remoteAudioElement = remoteAudioRef.current;

    // Initialize WebRTC for voice only dengan signaling
    const initCall = async () => {
      try {
        const mediaEnvironmentError = getMediaEnvironmentError();
        if (mediaEnvironmentError) {
          throw new Error(mediaEnvironmentError);
        }

        // Get user media (audio only)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        });
        if (!lifecycle.registerStream(stream)) return;
        ownedStream = stream;
        localStreamRef.current = stream;
        setHasLocalAudioTrack(stream.getAudioTracks().length > 0);

        // Create peer connection
        const pc = new RTCPeerConnection(iceConfiguration);
        if (!lifecycle.registerPeer(pc)) return;
        ownedPeer = pc;

        // Add local audio tracks
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Handle remote stream
        pc.ontrack = (event) => {
          if (!lifecycle.isActive()) return;
          setIsRemoteAudioEnabled(true);
          // Play remote audio
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = event.streams[0];
            remoteAudioRef.current.play().catch(console.error);
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (!lifecycle.isActive()) return;
          const state = pc.iceConnectionState;
          console.log('[VoiceCall] ICE state:', state);
          if (state === 'connected' || state === 'completed') {
            setConnectionStatus('connected');
          } else if (state === 'failed') {
            setConnectionStatus('failed');
          } else if (state === 'disconnected') {
            setConnectionStatus('disconnected');
          } else {
            setConnectionStatus('connecting');
          }
        };

        pc.onconnectionstatechange = () => {
          if (!lifecycle.isActive()) return;
          const state = pc.connectionState;
          console.log('[VoiceCall] Peer state:', state);
          if (state === 'connected') {
            setIsRemoteAudioEnabled(true);
            try {
              channel.push('call_connected', { call_id: callId });
            } catch {
              // Best effort; peer connection remains authoritative locally.
            }
          }
          if (state === 'failed') {
            setConnectionStatus('failed');
          }
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (lifecycle.isActive() && event.candidate) {
            channel.push('call_ice_candidate', {
              call_id: callId,
              candidate: JSON.stringify(event.candidate),
            });
          }
        };

        peerConnectionRef.current = pc;

        // Listen untuk signaling events
        const offerRef = channel.on('call_offer_received', (payload: { offer: string; from_user_id: string; call_id?: string }) => {
          if (!lifecycle.isActive()) return;
          if (payload.call_id && payload.call_id !== callId) return; // Ignore offers for other calls
          if (payload.from_user_id !== userId && !isCaller) {
            try {
              const offer = JSON.parse(payload.offer);
              pc
                .setRemoteDescription(new RTCSessionDescription(offer))
                .then(() => {
                  if (!lifecycle.isActive()) return undefined;
                  flushPendingCandidates();
                  return pc.createAnswer();
                })
                .then(answer => {
                  if (!answer || !lifecycle.isActive()) return undefined;
                  return pc.setLocalDescription(answer);
                })
                .then(() => {
                  if (lifecycle.isActive() && pc.localDescription) {
                    channel.push('call_answer', {
                      call_id: callId,
                      answer: JSON.stringify(pc.localDescription),
                    });
                  }
                })
                .catch((err) => {
                  console.error('[VoiceCall] Error handling offer:', err);
                });
            } catch (err) {
              console.error('[VoiceCall] Error parsing offer:', err);
            }
          }
        });

        const answerRef = channel.on('call_answer_received', (payload: { answer: string; from_user_id: string; call_id?: string }) => {
          if (!lifecycle.isActive()) return;
          if (payload.call_id && payload.call_id !== callId) return; // Ignore answers for other calls
          if (payload.from_user_id !== userId && isCaller) {
            try {
              const answer = JSON.parse(payload.answer);
              pc
                .setRemoteDescription(new RTCSessionDescription(answer))
                .then(() => {
                  if (lifecycle.isActive()) flushPendingCandidates();
                })
                .catch((err) => {
                  console.error('[VoiceCall] Error setting remote description:', err);
                });
            } catch (err) {
              console.error('[VoiceCall] Error parsing answer:', err);
            }
          }
        });

        const iceRef = channel.on('call_ice_candidate_received', (payload: { candidate: string; from_user_id: string; call_id?: string }) => {
          if (!lifecycle.isActive()) return;
          if (payload.call_id && payload.call_id !== callId) return; // Ignore ICE candidates for other calls
          if (payload.from_user_id !== userId) {
            try {
              const candidate = JSON.parse(payload.candidate);
              if (!pc.remoteDescription) {
                pendingCandidatesRef.current.push(candidate);
                return;
              }
              pc
                .addIceCandidate(new RTCIceCandidate(candidate))
                .catch((err) => {
                  console.error('[VoiceCall] Error adding ICE candidate:', err);
                });
            } catch (err) {
              console.error('[VoiceCall] Error parsing ICE candidate:', err);
            }
          }
        });

        const endedRef = channel.on('call_ended', (payload: { call_id: string }) => {
          if (lifecycle.isActive() && payload.call_id === callId) {
            endCall();
          }
        });

        lifecycle.addCleanup(() => {
          pc.ontrack = null;
          pc.oniceconnectionstatechange = null;
          pc.onconnectionstatechange = null;
          pc.onicecandidate = null;
          channel.off('call_offer_received', offerRef);
          channel.off('call_answer_received', answerRef);
          channel.off('call_ice_candidate_received', iceRef);
          channel.off('call_ended', endedRef);
        });

        // Jika caller, create offer setelah delay
        if (isCaller) {
          const offerTimer = window.setTimeout(async () => {
            try {
              if (!lifecycle.isActive()) return;
              const offer = await pc.createOffer({
                offerToReceiveAudio: true,
              });
              if (!lifecycle.isActive()) return;
              await pc.setLocalDescription(offer);
              if (!lifecycle.isActive()) return;
              channel.push('call_offer', {
                call_id: callId,
                offer: JSON.stringify(offer),
              });
            } catch (error) {
              if (!lifecycle.isActive()) return;
              console.error('[VoiceCall] Failed to create offer:', error);
              closeCallWithError(
                isId
                  ? 'Gagal memulai panggilan. Coba lagi.'
                  : 'Could not start the call. Please try again.',
              );
            }
          }, 1500); // Increased delay for better reliability
          lifecycle.setOfferTimer(offerTimer);
        }
      } catch (error) {
        if (!lifecycle.isActive()) return;
        console.error('Failed to initialize call:', error);
        closeCallWithError(describeGetUserMediaError(error, { audio: true, video: false }));
      }
    };

    void initCall();

    return () => {
      lifecycle.dispose();
      if (localStreamRef.current === ownedStream) {
        localStreamRef.current = null;
        setHasLocalAudioTrack(false);
      }
      if (peerConnectionRef.current === ownedPeer) {
        peerConnectionRef.current = null;
      }
      if (lifecycleRef.current === lifecycle) {
        lifecycleRef.current = null;
      }
      if (lifecycleRef.current === null && remoteAudioElement) {
        remoteAudioElement.pause();
        remoteAudioElement.srcObject = null;
      }
      pendingCandidatesRef.current = [];
    };
  }, [
    roomId,
    userId,
    callId,
    channel,
    isCaller,
    closeCallWithError,
    endCall,
    iceConfiguration,
    isId,
    permissionGranted,
  ]);

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled;
        setIsAudioEnabled(!isAudioEnabled);
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-call-title"
      aria-describedby="voice-call-status"
      className="fixed inset-0 z-[10040] flex h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[#0b141a] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] text-white"
    >
      <MediaPermissionGate
        enabled={!permissionGranted}
        isId={isId}
        need={{ audio: true, video: false }}
        title={isId ? 'Izinkan mikrofon' : 'Allow microphone'}
        description={isId ? 'Panggilan suara butuh akses mikrofon.' : 'Voice calls need access to your microphone.'}
        allowLabel={isId ? 'Izinkan akses' : 'Allow access'}
        denyLabel={isId ? 'Tidak sekarang' : 'Not now'}
        onGranted={() => setPermissionGranted(true)}
        onDenied={handlePermissionDenied}
      />
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(37,211,102,0.16),transparent_24%),radial-gradient(circle_at_50%_78%,rgba(0,168,132,0.10),transparent_34%)]" />
      <div className="relative z-10 flex w-full max-w-md flex-1 flex-col items-center justify-center text-center">
        <div className="relative">
          {connectionStatus === 'connected' ? (
            <span className="absolute inset-0 rounded-full bg-[#25d366]/20 blur-2xl" aria-hidden="true" />
          ) : null}
          <div className="relative inline-flex h-32 w-32 items-center justify-center rounded-full border-4 border-white/10 bg-[#202c33] shadow-[0_18px_48px_rgba(0,0,0,0.35)] sm:h-36 sm:w-36">
            <User className="h-16 w-16 text-white/80 sm:h-[72px] sm:w-[72px]" />
          </div>
          {connectionStatus === 'connected' ? (
            <span className="absolute bottom-1 right-1 inline-flex h-8 w-8 items-center justify-center rounded-full border-4 border-[#0b141a] bg-[#25d366]" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-[#0b141a]" />
            </span>
          ) : null}
        </div>

        <div className="mt-8">
          <h2 id="voice-call-title" className="text-[clamp(1.5rem,5vw,2rem)] font-bold tracking-[-0.02em]">
            {userName || (isId ? 'Memanggil…' : 'Calling…')}
          </h2>
          <p
            id="voice-call-status"
            role="status"
            aria-live="polite"
            className="mt-2 text-sm font-medium text-white/60"
          >
            {isRemoteAudioEnabled
              ? isId ? 'Terhubung' : 'Connected'
              : connectionStatus === 'failed'
                ? isId ? 'Koneksi gagal' : 'Connection failed'
                : connectionStatus === 'disconnected'
                  ? isId ? 'Menyambungkan lagi…' : 'Reconnecting…'
                  : isId ? 'Memanggil…' : 'Connecting…'}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-center gap-5 pt-12">
          <button
            type="button"
            onClick={toggleAudio}
            disabled={!hasLocalAudioTrack}
            className={`inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/8 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
              isAudioEnabled
                ? 'bg-[#202c33] text-white hover:bg-[#2a3942]'
                : 'bg-[#d14343] text-white hover:bg-[#c63737]'
            }`}
            aria-label={isAudioEnabled ? (isId ? 'Matikan mikrofon' : 'Mute microphone') : (isId ? 'Nyalakan mikrofon' : 'Unmute microphone')}
          >
            {isAudioEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
          </button>

          <button
            type="button"
            onClick={endCall}
            className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#d14343] text-white shadow-[0_12px_30px_rgba(209,67,67,0.28)] transition hover:bg-[#c63737] active:scale-95"
            aria-label={isId ? 'Akhiri panggilan' : 'End call'}
          >
            <PhoneOff className="h-7 w-7" />
          </button>
        </div>

        <p className="mt-6 text-[11px] font-medium text-white/34">
          {isId ? 'Panggilan terenkripsi melalui koneksi aman.' : 'Calls use the secure Lajukan connection.'}
        </p>
      </div>
    </div>
  );
}
