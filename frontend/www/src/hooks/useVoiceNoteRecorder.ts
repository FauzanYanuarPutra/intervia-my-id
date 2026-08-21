'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { VOICE_NOTE_UPLOAD_MAX_BYTES } from '@/lib/media/uploadStandard';
import {
  createVoiceNoteFile,
  selectVoiceNoteMime,
  VOICE_NOTE_AUDIO_BITS_PER_SECOND,
  VOICE_NOTE_MAX_DURATION_MS,
  VoiceNoteFileError,
  type VoiceNoteFileErrorCode,
} from '@/lib/media/voiceNote';

export type VoiceNoteRecorderStatus =
  | 'idle'
  | 'requesting-permission'
  | 'recording'
  | 'paused'
  | 'processing'
  | 'ready'
  | 'error';

export type VoiceNoteRecorderErrorCode =
  | VoiceNoteFileErrorCode
  | 'insecure-context'
  | 'unsupported'
  | 'permission-denied'
  | 'microphone-not-found'
  | 'microphone-busy'
  | 'recording-failed';

export type VoiceNoteRecording = {
  file: File;
  durationMs: number;
  mimeType: string;
  previewUrl: string;
};

type StopReason = 'complete' | 'cancelled' | 'too-large' | 'recording-failed';

type RecorderSession = {
  generation: number;
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  bytes: number;
  elapsedMs: number;
  segmentStartedAt: number | null;
  stopReason: StopReason | null;
  timerId: number | null;
};

export type UseVoiceNoteRecorderOptions = {
  maxBytes?: number;
  maxDurationMs?: number;
};

function monotonicNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function currentDuration(session: RecorderSession): number {
  if (session.segmentStartedAt === null) return session.elapsedMs;
  return session.elapsedMs + (monotonicNow() - session.segmentStartedAt);
}

function captureCurrentSegment(session: RecorderSession) {
  if (session.segmentStartedAt === null) return;
  session.elapsedMs += monotonicNow() - session.segmentStartedAt;
  session.segmentStartedAt = null;
}

function stopMediaTracks(stream: MediaStream) {
  stream.getTracks().forEach(track => track.stop());
}

export function voiceNoteRecorderErrorCode(
  error: unknown,
): VoiceNoteRecorderErrorCode {
  const name =
    error && typeof error === 'object' && 'name' in error
      ? String((error as { name?: unknown }).name || '')
      : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'permission-denied';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'microphone-not-found';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'microphone-busy';
  }
  if (name === 'NotSupportedError') return 'unsupported';
  return 'recording-failed';
}

export function useVoiceNoteRecorder(
  options: UseVoiceNoteRecorderOptions = {},
) {
  const maxBytes = options.maxBytes ?? VOICE_NOTE_UPLOAD_MAX_BYTES;
  const maxDurationMs = options.maxDurationMs ?? VOICE_NOTE_MAX_DURATION_MS;
  const [status, setStatus] = useState<VoiceNoteRecorderStatus>('idle');
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<VoiceNoteRecorderErrorCode | null>(null);
  const [recording, setRecording] = useState<VoiceNoteRecording | null>(null);
  const sessionRef = useRef<RecorderSession | null>(null);
  const permissionGenerationRef = useRef<number | null>(null);
  const generationRef = useRef(0);
  const previewUrlRef = useRef('');
  const mountedRef = useRef(true);

  const revokePreview = useCallback(() => {
    if (!previewUrlRef.current) return;
    URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = '';
  }, []);

  const fail = useCallback((code: VoiceNoteRecorderErrorCode) => {
    if (!mountedRef.current) return;
    setError(code);
    setRecording(null);
    setDurationMs(0);
    setStatus('error');
  }, []);

  const stopSession = useCallback(
    (session: RecorderSession, reason: StopReason) => {
      if (session.stopReason) return;
      captureCurrentSegment(session);
      session.stopReason = reason;
      if (session.timerId !== null) {
        window.clearInterval(session.timerId);
        session.timerId = null;
      }
      if (
        mountedRef.current &&
        generationRef.current === session.generation &&
        reason === 'complete'
      ) {
        setDurationMs(Math.min(session.elapsedMs, maxDurationMs));
        setStatus('processing');
      }
      try {
        if (session.recorder.state !== 'inactive') {
          session.recorder.stop();
          return;
        }

        stopMediaTracks(session.stream);
        if (sessionRef.current === session) sessionRef.current = null;
        if (reason !== 'cancelled') fail('recording-failed');
      } catch {
        stopMediaTracks(session.stream);
        if (sessionRef.current === session) sessionRef.current = null;
        if (reason !== 'cancelled') fail('recording-failed');
      }
    },
    [fail, maxDurationMs],
  );

  const start = useCallback(async () => {
    if (status !== 'idle' && status !== 'error' && status !== 'ready') return;
    if (sessionRef.current || permissionGenerationRef.current !== null) return;

    const generation = ++generationRef.current;
    revokePreview();
    setRecording(null);
    setDurationMs(0);
    setError(null);

    if (typeof window === 'undefined' || window.isSecureContext === false) {
      fail('insecure-context');
      return;
    }
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      fail('unsupported');
      return;
    }

    permissionGenerationRef.current = generation;
    setStatus('requesting-permission');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (requestError) {
      if (permissionGenerationRef.current === generation) {
        permissionGenerationRef.current = null;
      }
      if (generationRef.current === generation) {
        fail(voiceNoteRecorderErrorCode(requestError));
      }
      return;
    }

    if (permissionGenerationRef.current === generation) {
      permissionGenerationRef.current = null;
    }

    if (!mountedRef.current || generationRef.current !== generation) {
      stopMediaTracks(stream);
      return;
    }

    let selectedMime = '';
    try {
      selectedMime = selectVoiceNoteMime(mimeType =>
        typeof MediaRecorder.isTypeSupported === 'function'
          ? MediaRecorder.isTypeSupported(mimeType)
          : false,
      );
    } catch {
      // A few embedded browsers expose isTypeSupported but throw when queried.
      // Their default encoder can still be usable, so let the constructor decide.
    }

    let recorder: MediaRecorder;
    try {
      recorder = selectedMime
        ? new MediaRecorder(stream, {
            mimeType: selectedMime,
            audioBitsPerSecond: VOICE_NOTE_AUDIO_BITS_PER_SECOND,
          })
        : new MediaRecorder(stream, {
            audioBitsPerSecond: VOICE_NOTE_AUDIO_BITS_PER_SECOND,
          });
    } catch (recorderError) {
      try {
        // Some embedded WebViews over-report codec support. Retrying without
        // constraints lets the browser choose its native audio container.
        recorder = new MediaRecorder(stream);
        selectedMime = '';
      } catch (fallbackError) {
        stopMediaTracks(stream);
        fail(
          voiceNoteRecorderErrorCode(
            fallbackError instanceof Error ? fallbackError : recorderError,
          ),
        );
        return;
      }
    }

    const session: RecorderSession = {
      generation,
      recorder,
      stream,
      chunks: [],
      bytes: 0,
      elapsedMs: 0,
      segmentStartedAt: null,
      stopReason: null,
      timerId: null,
    };
    sessionRef.current = session;

    recorder.ondataavailable = event => {
      if (event.data.size <= 0 || session.stopReason === 'cancelled') return;
      session.chunks.push(event.data);
      session.bytes += event.data.size;
      if (session.bytes > maxBytes && !session.stopReason) {
        if (
          mountedRef.current &&
          generationRef.current === session.generation
        ) {
          setStatus('processing');
        }
        stopSession(session, 'too-large');
      }
    };

    recorder.onerror = () => {
      if (session.stopReason === 'complete') {
        session.stopReason = 'recording-failed';
        return;
      }
      stopSession(session, 'recording-failed');
    };

    recorder.onstop = async () => {
      captureCurrentSegment(session);
      if (session.timerId !== null) {
        window.clearInterval(session.timerId);
        session.timerId = null;
      }
      stopMediaTracks(session.stream);
      if (sessionRef.current === session) sessionRef.current = null;

      if (
        session.stopReason === 'cancelled' ||
        generationRef.current !== session.generation ||
        !mountedRef.current
      ) {
        return;
      }
      if (session.stopReason === 'too-large') {
        fail('too-large');
        return;
      }
      if (session.stopReason === 'recording-failed') {
        fail('recording-failed');
        return;
      }

      try {
        const emittedMime = session.chunks.find(chunk => chunk.type)?.type;
        const blobType =
          emittedMime || recorder.mimeType || selectedMime || '';
        const blob = new Blob(session.chunks, { type: blobType });
        const file = await createVoiceNoteFile(blob, { maxBytes });
        if (
          generationRef.current !== session.generation ||
          !mountedRef.current
        ) {
          return;
        }
        const previewUrl = URL.createObjectURL(file);
        revokePreview();
        previewUrlRef.current = previewUrl;
        const completed: VoiceNoteRecording = {
          file,
          durationMs: Math.min(session.elapsedMs, maxDurationMs),
          mimeType: file.type,
          previewUrl,
        };
        setRecording(completed);
        setDurationMs(completed.durationMs);
        setError(null);
        setStatus('ready');
      } catch (fileError) {
        if (fileError instanceof VoiceNoteFileError) {
          fail(fileError.code);
        } else {
          fail('recording-failed');
        }
      }
    };

    try {
      recorder.start(1_000);
      session.segmentStartedAt = monotonicNow();
    } catch (startError) {
      session.stopReason = 'recording-failed';
      sessionRef.current = null;
      stopMediaTracks(stream);
      fail(voiceNoteRecorderErrorCode(startError));
      return;
    }

    setStatus('recording');
    session.timerId = window.setInterval(() => {
      const elapsed = Math.min(currentDuration(session), maxDurationMs);
      if (mountedRef.current && generationRef.current === session.generation) {
        setDurationMs(elapsed);
      }
      if (elapsed >= maxDurationMs && !session.stopReason) {
        stopSession(session, 'complete');
      }
    }, 200);
  }, [fail, maxBytes, maxDurationMs, revokePreview, status, stopSession]);

  const pause = useCallback(() => {
    const session = sessionRef.current;
    if (!session || session.recorder.state !== 'recording') return;
    try {
      captureCurrentSegment(session);
      session.recorder.pause();
      setDurationMs(Math.min(session.elapsedMs, maxDurationMs));
      setStatus('paused');
    } catch {
      stopSession(session, 'recording-failed');
    }
  }, [maxDurationMs, stopSession]);

  const resume = useCallback(() => {
    const session = sessionRef.current;
    if (!session || session.recorder.state !== 'paused') return;
    try {
      session.recorder.resume();
      session.segmentStartedAt = monotonicNow();
      setStatus('recording');
    } catch {
      stopSession(session, 'recording-failed');
    }
  }, [stopSession]);

  const stop = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    stopSession(session, 'complete');
  }, [stopSession]);

  const cancel = useCallback(() => {
    generationRef.current += 1;
    permissionGenerationRef.current = null;
    const session = sessionRef.current;
    if (session) {
      session.stopReason = 'cancelled';
      if (session.timerId !== null) {
        window.clearInterval(session.timerId);
        session.timerId = null;
      }
      try {
        if (session.recorder.state !== 'inactive') session.recorder.stop();
      } catch {
        // Tracks are released below even if MediaRecorder has already stopped.
      }
      stopMediaTracks(session.stream);
      sessionRef.current = null;
    }
    revokePreview();
    setRecording(null);
    setDurationMs(0);
    setError(null);
    setStatus('idle');
  }, [revokePreview]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      permissionGenerationRef.current = null;
      const session = sessionRef.current;
      if (session) {
        session.stopReason = 'cancelled';
        if (session.timerId !== null) window.clearInterval(session.timerId);
        try {
          if (session.recorder.state !== 'inactive') session.recorder.stop();
        } catch {
          // The stream cleanup below is the important unmount invariant.
        }
        stopMediaTracks(session.stream);
        sessionRef.current = null;
      }
      revokePreview();
    };
  }, [revokePreview]);

  return {
    status,
    durationMs,
    error,
    recording,
    start,
    pause,
    resume,
    stop,
    cancel,
    reset: cancel,
  };
}
