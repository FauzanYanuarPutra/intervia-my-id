'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { getIceConfiguration } from '@/lib/webrtc';
import {
  createCallLifecycle,
  type CallLifecycle,
} from '@/lib/webrtcCallLifecycle';
import { useAuth } from '@/context/AuthContext';
import { soundManager } from '@/lib/soundManager';
import {
  describeGetUserMediaError,
  getMediaEnvironmentError,
  getUserMediaErrorName,
} from '@/lib/mediaDevices';
import { MediaPermissionGate } from '@/components/common/MediaPermissionGate';
import { useToast } from '@/components/system/feedback/ToastProvider';

interface VideoCallProps {
  roomId: string;
  userId: string;
  callId: string;
  channel: CallChannel | null;
  isCaller?: boolean; // true jika ini yang initiate call
  onClose: () => void;
}

type CallChannel = {
  push: (event: string, payload: Record<string, unknown>) => void;
  on: <TPayload>(
    event: string,
    callback: (payload: TPayload) => void,
  ) => number;
  off: (event: string, ref: number) => void;
};

type ConnectionStatus = 'connecting' | 'connected' | 'failed' | 'disconnected';
type VideoOrientation = 'portrait' | 'landscape' | 'square';
type VideoMeta = {
  width: number;
  height: number;
  aspectRatio: number;
  orientation: VideoOrientation;
};

function getViewportSize() {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0 };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

function readVideoMeta(video: HTMLVideoElement | null): VideoMeta | null {
  if (!video?.videoWidth || !video.videoHeight) {
    return null;
  }

  const aspectRatio = video.videoWidth / video.videoHeight;
  let orientation: VideoOrientation = 'square';

  if (aspectRatio > 1.05) {
    orientation = 'landscape';
  } else if (aspectRatio < 0.95) {
    orientation = 'portrait';
  }

  return {
    width: video.videoWidth,
    height: video.videoHeight,
    aspectRatio,
    orientation,
  };
}

export function VideoCall({
  roomId,
  userId,
  callId,
  channel,
  isCaller = false,
  onClose,
}: VideoCallProps) {
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isRemoteVideoEnabled, setIsRemoteVideoEnabled] = useState(false);
  const [remotePlaybackBlocked, setRemotePlaybackBlocked] = useState(false);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('connecting');
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [viewportSize, setViewportSize] = useState(getViewportSize);
  const [localVideoMeta, setLocalVideoMeta] = useState<VideoMeta | null>(null);
  const [remoteVideoMeta, setRemoteVideoMeta] = useState<VideoMeta | null>(
    null,
  );
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const remotePlayAttemptRef = useRef(0);
  const lifecycleRef = useRef<CallLifecycle | null>(null);
  const { authFetch } = useAuth();
  const [iceConfiguration, setIceConfiguration] =
    useState<RTCConfiguration | null>(null);
  const pathname = usePathname();
  const isId = pathname.startsWith('/id');
  const { notify } = useToast();
  const lastConnectionSoundRef = useRef(connectionStatus);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const requestClose = useCallback(() => {
    onCloseRef.current();
  }, []);

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
    if (
      connectionStatus === 'connected' &&
      lastConnectionSoundRef.current !== 'connected'
    ) {
      soundManager.stopLoop('incomingRing');
      soundManager.stopLoop('outgoingRing');
      soundManager.play('callConnected');
    }
    lastConnectionSoundRef.current = connectionStatus;
  }, [connectionStatus]);

  useEffect(() => {
    const syncViewport = () => {
      setViewportSize(getViewportSize());
    };

    syncViewport();
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', syncViewport);

    return () => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
    };
  }, []);

  const syncLocalVideoMeta = useCallback(() => {
    setLocalVideoMeta(readVideoMeta(localVideoRef.current));
  }, []);

  const syncRemoteVideoMeta = useCallback(() => {
    setRemoteVideoMeta(readVideoMeta(remoteVideoRef.current));
  }, []);

  useEffect(() => {
    const video = localVideoRef.current;
    if (!video) return;

    const handleUpdate = () => {
      syncLocalVideoMeta();
    };

    handleUpdate();
    video.addEventListener('loadedmetadata', handleUpdate);
    video.addEventListener('resize', handleUpdate);

    return () => {
      video.removeEventListener('loadedmetadata', handleUpdate);
      video.removeEventListener('resize', handleUpdate);
    };
  }, [syncLocalVideoMeta, isVideoEnabled]);

  useEffect(() => {
    const video = remoteVideoRef.current;
    if (!video) return;

    const handleUpdate = () => {
      syncRemoteVideoMeta();
    };

    handleUpdate();
    video.addEventListener('loadedmetadata', handleUpdate);
    video.addEventListener('resize', handleUpdate);

    return () => {
      video.removeEventListener('loadedmetadata', handleUpdate);
      video.removeEventListener('resize', handleUpdate);
    };
  }, [syncRemoteVideoMeta]);

  const clearVideoElements = useCallback((resetState = true) => {
    remotePlayAttemptRef.current += 1;

    if (localVideoRef.current) {
      localVideoRef.current.pause();
      localVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.pause();
      remoteVideoRef.current.srcObject = null;
    }

    remoteStreamRef.current = null;
    if (resetState) {
      setIsRemoteVideoEnabled(false);
      setRemotePlaybackBlocked(false);
      setLocalVideoMeta(null);
      setRemoteVideoMeta(null);
    }
  }, []);

  const tryPlayRemoteVideo = useCallback(
    async (userInitiated = false) => {
      const video = remoteVideoRef.current;
      if (!video?.srcObject) return;

      const playAttemptId = ++remotePlayAttemptRef.current;

      if (userInitiated) {
        await soundManager.unlock();
      }

      try {
        await video.play();
        if (remotePlayAttemptRef.current !== playAttemptId) return;
        setRemotePlaybackBlocked(false);
        syncRemoteVideoMeta();
      } catch (error) {
        if (remotePlayAttemptRef.current !== playAttemptId) return;

        const errorName =
          error instanceof DOMException
            ? error.name
            : error instanceof Error
              ? error.name
              : '';

        if (errorName === 'AbortError') {
          return;
        }

        if (errorName === 'NotAllowedError') {
          setRemotePlaybackBlocked(true);
          return;
        }

        console.warn('[VideoCall] Unable to autoplay remote video:', error);
      }
    },
    [syncRemoteVideoMeta],
  );

  const flushPendingCandidates = () => {
    const pc = peerConnectionRef.current;
    if (!pc || !pc.remoteDescription) return;
    const queue = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    queue.forEach(candidateInit => {
      pc.addIceCandidate(new RTCIceCandidate(candidateInit)).catch(err => {
        console.error('[VideoCall] Error adding pending ICE candidate:', err);
      });
    });
  };

  const releaseCallResources = useCallback(
    (resetVideoState = true) => {
      lifecycleRef.current?.dispose();
      lifecycleRef.current = null;
      localStreamRef.current = null;
      peerConnectionRef.current = null;
      pendingCandidatesRef.current = [];
      clearVideoElements(resetVideoState);
    },
    [clearVideoElements],
  );

  const closeCallWithError = useCallback(
    (message: string) => {
      try {
        channel?.push('call_end', { call_id: callId });
      } catch {
        // Ignore signaling failures.
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
    [
      callId,
      channel,
      isId,
      notify,
      releaseCallResources,
      requestClose,
    ],
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
    if (!channel || !permissionGranted || !iceConfiguration) return;

    const lifecycle = createCallLifecycle();
    lifecycleRef.current = lifecycle;
    let ownedStream: MediaStream | null = null;
    let ownedPeer: RTCPeerConnection | null = null;

    // Initialize WebRTC dengan signaling via Phoenix Channel
    const initCall = async () => {
      try {
        const mediaEnvironmentError = getMediaEnvironmentError();
        if (mediaEnvironmentError) {
          throw new Error(mediaEnvironmentError);
        }

        // Try full media first, then degrade gracefully.
        let stream: MediaStream | null = null;
        let lastMediaError: unknown = null;
        const { width, height } = getViewportSize();
        const preferPortrait = height >= width;
        const preferredVideoConstraints: MediaTrackConstraints = {
          facingMode: 'user',
          width: { ideal: preferPortrait ? 960 : 1280 },
          height: { ideal: preferPortrait ? 1280 : 720 },
          aspectRatio: { ideal: preferPortrait ? 3 / 4 : 16 / 9 },
        };
        const attempts: Array<MediaStreamConstraints> = [
          { video: preferredVideoConstraints, audio: true },
          { video: preferredVideoConstraints, audio: false },
          { video: false, audio: true },
        ];

        for (const constraints of attempts) {
          try {
            const acquiredStream =
              await navigator.mediaDevices.getUserMedia(constraints);
            if (!lifecycle.registerStream(acquiredStream)) return;
            stream = acquiredStream;
            ownedStream = acquiredStream;
            break;
          } catch (mediaError) {
            if (!lifecycle.isActive()) return;
            lastMediaError = mediaError;
            const errName = getUserMediaErrorName(mediaError);
            if (
              errName === 'NotAllowedError' ||
              errName === 'SecurityError' ||
              errName === 'AbortError'
            ) {
              break;
            }
          }
        }

        if (!lifecycle.isActive()) return;
        if (!stream) {
          throw (
            lastMediaError ?? new Error('Unable to access camera/microphone.')
          );
        }

        localStreamRef.current = stream;
        const hasVideoTrack = stream.getVideoTracks().length > 0;
        const hasAudioTrack = stream.getAudioTracks().length > 0;

        setCameraUnavailable(!hasVideoTrack);
        setIsVideoEnabled(hasVideoTrack);
        setIsAudioEnabled(hasAudioTrack);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = hasVideoTrack ? stream : null;
          if (hasVideoTrack) {
            localVideoRef.current.play().catch(() => {});
          }
        }
        syncLocalVideoMeta();

        // Create peer connection
        const pc = new RTCPeerConnection(iceConfiguration);
        if (!lifecycle.registerPeer(pc)) return;
        ownedPeer = pc;

        // Add local stream tracks
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });

        // Handle remote stream
        pc.ontrack = event => {
          if (!lifecycle.isActive()) return;
          const [stream] = event.streams;
          if (!stream) return;

          const hasRemoteVideo = stream.getVideoTracks().length > 0;
          remoteStreamRef.current = stream;
          setIsRemoteVideoEnabled(hasRemoteVideo);
          setRemotePlaybackBlocked(false);

          if (
            remoteVideoRef.current &&
            remoteVideoRef.current.srcObject !== stream
          ) {
            remoteVideoRef.current.srcObject = stream;
          }

          syncRemoteVideoMeta();
          if (hasRemoteVideo) {
            void tryPlayRemoteVideo();
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (!lifecycle.isActive()) return;
          const state = pc.iceConnectionState;
          console.log('[VideoCall] ICE state:', state);
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
          console.log('[VideoCall] Peer state:', state);
          if (state === 'failed') {
            setConnectionStatus('failed');
          }
        };

        // Handle ICE candidates
        pc.onicecandidate = event => {
          if (lifecycle.isActive() && event.candidate) {
            channel.push('call_ice_candidate', {
              call_id: callId,
              candidate: JSON.stringify(event.candidate),
            });
          }
        };

        peerConnectionRef.current = pc;

        // Listen untuk signaling events dari Phoenix Channel
        const offerRef = channel.on(
          'call_offer_received',
          (payload: {
            offer: string;
            from_user_id: string;
            call_id?: string;
          }) => {
            if (!lifecycle.isActive()) return;
            if (payload.call_id && payload.call_id !== callId) return;
            if (payload.from_user_id !== userId && !isCaller) {
              try {
                const offer = JSON.parse(payload.offer);
                pc.setRemoteDescription(new RTCSessionDescription(offer))
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
                  .catch(error => {
                    if (lifecycle.isActive()) {
                      console.error('[VideoCall] Error handling offer:', error);
                    }
                  });
              } catch (error) {
                console.error('[VideoCall] Error parsing offer:', error);
              }
            }
          },
        );

        const answerRef = channel.on(
          'call_answer_received',
          (payload: {
            answer: string;
            from_user_id: string;
            call_id?: string;
          }) => {
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
                  .catch(err => {
                    console.error(
                      '[VideoCall] Error setting remote description:',
                      err,
                    );
                  });
              } catch (err) {
                console.error('[VideoCall] Error parsing answer:', err);
              }
            }
          },
        );

        const iceRef = channel.on(
          'call_ice_candidate_received',
          (payload: {
            candidate: string;
            from_user_id: string;
            call_id?: string;
          }) => {
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
                  .catch(err => {
                    console.error(
                      '[VideoCall] Error adding ICE candidate:',
                      err,
                    );
                  });
              } catch (err) {
                console.error('[VideoCall] Error parsing ICE candidate:', err);
              }
            }
          },
        );

        const endedRef = channel.on(
          'call_ended',
          (payload: { call_id: string }) => {
            if (lifecycle.isActive() && payload.call_id === callId) {
              endCall();
            }
          },
        );

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
                offerToReceiveVideo: true,
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
              console.error('[VideoCall] Failed to create offer:', error);
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
        closeCallWithError(
          describeGetUserMediaError(error, { audio: true, video: true }),
        );
      }
    };

    void initCall();

    return () => {
      lifecycle.dispose();
      if (localStreamRef.current === ownedStream) {
        localStreamRef.current = null;
      }
      if (peerConnectionRef.current === ownedPeer) {
        peerConnectionRef.current = null;
      }
      if (lifecycleRef.current === lifecycle) {
        lifecycleRef.current = null;
      }
      pendingCandidatesRef.current = [];
      if (lifecycleRef.current === null) clearVideoElements(false);
    };
  }, [
    roomId,
    userId,
    callId,
    channel,
    isCaller,
    closeCallWithError,
    permissionGranted,
    clearVideoElements,
    endCall,
    iceConfiguration,
    isId,
    syncLocalVideoMeta,
    syncRemoteVideoMeta,
    tryPlayRemoteVideo,
  ]);

  // Set caller flag - akan di-set dari parent saat initiate call
  // Untuk incoming call, flag akan false sehingga tidak create offer

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled;
        setIsVideoEnabled(!isVideoEnabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled;
        setIsAudioEnabled(!isAudioEnabled);
      }
    }
  };

  const hasLocalAudioTrack = Boolean(
    localStreamRef.current?.getAudioTracks()[0],
  );
  const hasLocalVideoTrack = Boolean(
    localStreamRef.current?.getVideoTracks()[0],
  );
  const isLandscapeViewport = viewportSize.width > viewportSize.height;
  const isCompactViewport = viewportSize.width > 0 && viewportSize.width < 768;
  const localPreviewStyle = useMemo(() => {
    const width = isLandscapeViewport
      ? isCompactViewport
        ? 'min(28vw, 168px)'
        : 'min(18vw, 240px)'
      : isCompactViewport
        ? 'min(38vw, 156px)'
        : 'min(24vw, 220px)';

    return {
      width,
      aspectRatio: String(
        localVideoMeta?.aspectRatio ?? (isLandscapeViewport ? 4 / 3 : 3 / 4),
      ),
    };
  }, [isCompactViewport, isLandscapeViewport, localVideoMeta?.aspectRatio]);
  const localPreviewPositionClass = isLandscapeViewport
    ? 'bottom-4 right-4 sm:bottom-5 sm:right-5'
    : 'right-3 top-3 sm:right-5 sm:top-5';
  const connectionLabel = isId
    ? connectionStatus === 'connected'
      ? 'Terhubung'
      : connectionStatus === 'failed'
        ? 'Koneksi gagal'
        : connectionStatus === 'disconnected'
          ? 'Menyambung ulang...'
          : 'Menghubungkan...'
    : connectionStatus === 'connected'
      ? 'Connected'
      : connectionStatus === 'failed'
        ? 'Connection failed'
        : connectionStatus === 'disconnected'
          ? 'Reconnecting...'
          : 'Connecting...';
  const waitingLabel = cameraUnavailable
    ? isId
      ? 'Mode audio aktif. Kamera lokal tidak tersedia.'
      : 'Audio mode is active. Your camera is unavailable.'
    : isId
      ? 'Menunggu video lawan bicara...'
      : 'Waiting for remote video...';
  const playbackButtonLabel = isId
    ? 'Ketuk untuk mulai video'
    : 'Tap to start remote video';
  const previewLabel = isId ? 'Kamu' : 'You';
  const remoteVideoClassName = `absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${
    remoteVideoMeta?.orientation === 'portrait'
      ? 'bg-black/55 p-2 sm:p-4'
      : 'bg-black/35'
  } ${isRemoteVideoEnabled ? 'opacity-100' : 'opacity-0'}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-call-title"
      aria-describedby="video-call-status"
      className="fixed inset-0 z-50 flex flex-col bg-[#020617] text-[color:var(--app-text-inverse)]"
    >
      <h2 id="video-call-title" className="sr-only">
        {isId ? 'Panggilan video' : 'Video call'}
      </h2>
      <MediaPermissionGate
        enabled={!permissionGranted}
        isId={isId}
        need={{ audio: true, video: true }}
        title={isId ? 'Izinkan kamera & mikrofon' : 'Allow camera & microphone'}
        description={
          isId
            ? 'Panggilan video butuh akses kamera dan mikrofon.'
            : 'Video calls need access to your camera and microphone.'
        }
        allowLabel={isId ? 'Izinkan akses' : 'Allow access'}
        denyLabel={isId ? 'Tidak sekarang' : 'Not now'}
        onGranted={() => setPermissionGranted(true)}
        onDenied={handlePermissionDenied}
      />
      <div className="flex min-h-0 flex-1 px-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:px-5 sm:pb-5 sm:pt-5">
        <div className="relative min-h-0 w-full overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] shadow-[0_36px_80px_-48px_rgba(15,23,42,0.9)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(14,165,233,0.08),_transparent_36%)]" />
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={remoteVideoClassName}
          />
          {!isRemoteVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/82 sm:text-base">
              <div className="max-w-sm rounded-3xl border border-white/10 bg-black/28 px-5 py-4 ">
                <p>{waitingLabel}</p>
              </div>
            </div>
          )}

          <div className="absolute left-3 top-3 z-10 sm:left-5 sm:top-5">
            <div
              id="video-call-status"
              role="status"
              aria-live="polite"
              className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-xs font-semibold tracking-[0.02em] text-white/88  sm:text-sm"
            >
              {connectionLabel}
            </div>
          </div>

          {remotePlaybackBlocked ? (
            <div className="absolute inset-x-4 bottom-4 z-10 flex justify-center sm:bottom-5">
              <button
                type="button"
                onClick={() => void tryPlayRemoteVideo(true)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/12 bg-black/48 px-4 py-2 text-sm font-semibold text-white  transition hover:bg-black/56"
              >
                {playbackButtonLabel}
              </button>
            </div>
          ) : null}

          <div
            className={`absolute z-10 overflow-hidden rounded-[22px] border border-white/12 bg-black/52 shadow-[0_20px_40px_-26px_rgba(2,6,23,0.9)]  ${localPreviewPositionClass}`}
            style={localPreviewStyle}
          >
            <div className="absolute left-2 top-2 z-10 rounded-full bg-black/45 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/72">
              {previewLabel}
            </div>
            {isVideoEnabled ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full bg-black/60 object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-black/60 text-white/82">
                <VideoOff className="h-8 w-8" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 ">
        <button
          onClick={toggleAudio}
          disabled={!hasLocalAudioTrack}
          className={`rounded-full p-3 transition-colors ${
            isAudioEnabled
              ? 'bg-[color:var(--app-surface-strong)] hover:bg-[color:var(--app-surface)] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]'
              : 'bg-[color:var(--app-danger)] hover:bg-[color:var(--app-danger)] text-[color:var(--app-text-inverse)]'
          } ${!hasLocalAudioTrack ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isAudioEnabled ? (
            <Mic className="w-6 h-6" />
          ) : (
            <MicOff className="w-6 h-6" />
          )}
        </button>

        <button
          onClick={toggleVideo}
          disabled={!hasLocalVideoTrack}
          className={`rounded-full p-3 transition-colors ${
            isVideoEnabled
              ? 'bg-[color:var(--app-surface-strong)] hover:bg-[color:var(--app-surface)] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]'
              : 'bg-[color:var(--app-danger)] hover:bg-[color:var(--app-danger)] text-[color:var(--app-text-inverse)]'
          } ${!hasLocalVideoTrack ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {isVideoEnabled ? (
            <Video className="w-6 h-6" />
          ) : (
            <VideoOff className="w-6 h-6" />
          )}
        </button>

        <button
          onClick={endCall}
          className="p-3 rounded-full bg-[color:var(--app-danger)] hover:bg-[color:var(--app-danger)] text-[color:var(--app-text-inverse)] transition-colors"
          aria-label="End call"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
