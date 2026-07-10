'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Mic, MicOff, PhoneOff, User } from 'lucide-react';
import { getIceServers } from '@/lib/webrtc';
import { soundManager } from '@/lib/soundManager';
import { describeGetUserMediaError, getMediaEnvironmentError } from '@/lib/mediaDevices';
import { MediaPermissionGate } from '@/components/common/MediaPermissionGate';
import { useToast } from '@/components/system/feedback/ToastProvider';

interface VoiceCallProps {
  roomId: string;
  userId: string;
  callId: string;
  channel: any; // Phoenix Channel
  isCaller?: boolean; // true jika ini yang initiate call
  userName?: string;
  onClose: () => void;
}

export function VoiceCall({ roomId, userId, callId, channel, isCaller = false, userName, onClose }: VoiceCallProps) {
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isRemoteAudioEnabled, setIsRemoteAudioEnabled] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'failed'>('connecting');
  const [permissionGranted, setPermissionGranted] = useState(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const iceServers = useMemo(() => getIceServers(), []);
  const lastConnectionSoundRef = useRef(connectionStatus);
  const pathname = usePathname();
  const isId = pathname.startsWith('/id');
  const { notify } = useToast();

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

  const closeCallWithError = useCallback((message: string) => {
    try {
      channel?.push('call_end', { call_id: callId });
    } catch {
      // Ignore signaling failure.
    }
    notify({
      title: isId ? 'Panggilan gagal' : 'Call failed',
      description: message,
      variant: 'error',
      durationMs: 5000,
    });
    onClose();
  }, [callId, channel, isId, notify, onClose]);

  const handlePermissionDenied = useCallback(() => {
    try {
      channel?.push('call_end', { call_id: callId });
    } catch {
      // ignore
    }
    onClose();
  }, [callId, channel, onClose]);

  useEffect(() => {
    if (!channel || !permissionGranted) return;

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
        localStreamRef.current = stream;

        // Create peer connection
        const pc = new RTCPeerConnection({
          iceServers,
        });

        // Add local audio tracks
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Handle remote stream
        pc.ontrack = (event) => {
          setIsRemoteAudioEnabled(true);
          // Play remote audio
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = event.streams[0];
            remoteAudioRef.current.play().catch(console.error);
          }
        };

        pc.oniceconnectionstatechange = () => {
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
          const state = pc.connectionState;
          console.log('[VoiceCall] Peer state:', state);
          if (state === 'connected') {
            setIsRemoteAudioEnabled(true);
          }
          if (state === 'failed') {
            setConnectionStatus('failed');
          }
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate && channel) {
            channel.push('call_ice_candidate', {
              call_id: callId,
              candidate: JSON.stringify(event.candidate),
            });
          }
        };

        peerConnectionRef.current = pc;

        // Listen untuk signaling events
        const offerRef = channel.on('call_offer_received', (payload: { offer: string; from_user_id: string; call_id?: string }) => {
          if (payload.call_id && payload.call_id !== callId) return; // Ignore offers for other calls
          if (payload.from_user_id !== userId && peerConnectionRef.current && !isCaller) {
            try {
              const offer = JSON.parse(payload.offer);
              peerConnectionRef.current
                .setRemoteDescription(new RTCSessionDescription(offer))
                .then(() => {
                  flushPendingCandidates();
                  return peerConnectionRef.current!.createAnswer();
                })
                .then((answer) => peerConnectionRef.current!.setLocalDescription(answer))
                .then(() => {
                  if (channel && peerConnectionRef.current?.localDescription) {
                    channel.push('call_answer', {
                      call_id: callId,
                      answer: JSON.stringify(peerConnectionRef.current.localDescription),
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
          if (payload.call_id && payload.call_id !== callId) return; // Ignore answers for other calls
          if (payload.from_user_id !== userId && peerConnectionRef.current && isCaller) {
            try {
              const answer = JSON.parse(payload.answer);
              peerConnectionRef.current
                .setRemoteDescription(new RTCSessionDescription(answer))
                .then(() => {
                  flushPendingCandidates();
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
          if (payload.call_id && payload.call_id !== callId) return; // Ignore ICE candidates for other calls
          if (payload.from_user_id !== userId && peerConnectionRef.current) {
            try {
              const candidate = JSON.parse(payload.candidate);
              if (!peerConnectionRef.current.remoteDescription) {
                pendingCandidatesRef.current.push(candidate);
                return;
              }
              peerConnectionRef.current
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
          if (payload.call_id === callId) {
            endCall();
          }
        });

        // Jika caller, create offer setelah delay
        if (isCaller) {
          setTimeout(async () => {
            try {
              if (!peerConnectionRef.current || !channel) return;
              const offer = await peerConnectionRef.current.createOffer({
                offerToReceiveAudio: true,
              });
              await peerConnectionRef.current.setLocalDescription(offer);
              channel.push('call_offer', {
                call_id: callId,
                offer: JSON.stringify(offer),
              });
            } catch (error) {
              console.error('[VoiceCall] Failed to create offer:', error);
              onClose(); // Close call UI on error
            }
          }, 1500); // Increased delay for better reliability
        }

        return () => {
          channel.off('call_offer_received', offerRef);
          channel.off('call_answer_received', answerRef);
          channel.off('call_ice_candidate_received', iceRef);
          channel.off('call_ended', endedRef);
        };
      } catch (error) {
        console.error('Failed to initialize call:', error);
        closeCallWithError(describeGetUserMediaError(error, { audio: true, video: false }));
      }
    };

    const cleanupPromise = initCall();

    return () => {
      cleanupPromise.then((cleanupFn) => cleanupFn?.()).catch(() => {});
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
      }
      pendingCandidatesRef.current = [];
    };
  }, [roomId, userId, callId, channel, isCaller, onClose, closeCallWithError, permissionGranted]);

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled;
        setIsAudioEnabled(!isAudioEnabled);
      }
    }
  };

  const endCall = () => {
    // Notify via channel
    if (channel) {
      try {
        channel.push('call_end', { call_id: callId });
      } catch {
        // ignore
      }
    }
    soundManager.play('callEnd');
    soundManager.stopLoop('outgoingRing');
    soundManager.stopLoop('incomingRing');
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }
    onClose();
  };

  const hasLocalAudioTrack = Boolean(localStreamRef.current?.getAudioTracks()[0]);

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-[color:var(--app-accent)] to-[color:var(--app-accent-strong)] flex flex-col items-center justify-center">
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
      <div className="text-center text-[color:var(--app-text-inverse)] space-y-6">
        {/* Avatar */}
        <div className="flex justify-center">
          <div className="w-32 h-32 bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_20%,_transparent)] rounded-full flex items-center justify-center ">
            <User className="w-16 h-16 text-[color:var(--app-text-inverse)]" />
          </div>
        </div>

        {/* User name */}
        <div>
          <h2 className="text-2xl font-semibold">{userName || 'Calling...'}</h2>
          <p className="text-[color:color-mix(in_srgb,_var(--app-text-inverse)_80%,_transparent)] mt-2">
            {isRemoteAudioEnabled
              ? 'Connected'
              : connectionStatus === 'failed'
                ? 'Connection failed'
                : connectionStatus === 'disconnected'
                  ? 'Reconnecting...'
                  : 'Connecting...'}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 pt-8">
          <button
            onClick={toggleAudio}
            disabled={!hasLocalAudioTrack}
            className={`p-4 rounded-full transition-colors ${
              isAudioEnabled
                ? 'bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_20%,_transparent)] hover:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_30%,_transparent)] text-[color:var(--app-text-inverse)]'
                : 'bg-[color:var(--app-danger)] hover:bg-[color:var(--app-danger)] text-[color:var(--app-text-inverse)]'
            } ${!hasLocalAudioTrack ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
          >
            {isAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>

          <button
            onClick={endCall}
            className="p-4 rounded-full bg-[color:var(--app-danger)] hover:bg-[color:var(--app-danger)] text-[color:var(--app-text-inverse)] transition-colors"
            aria-label="End call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
