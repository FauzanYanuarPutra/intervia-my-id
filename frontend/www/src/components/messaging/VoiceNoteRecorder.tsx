'use client';

import { useState } from 'react';
import {
  CircleAlert,
  Loader2,
  Mic,
  Pause,
  Play,
  Send,
  Square,
  Trash2,
} from 'lucide-react';
import {
  useVoiceNoteRecorder,
  type VoiceNoteRecorderErrorCode,
  type VoiceNoteRecording,
} from '@/hooks/useVoiceNoteRecorder';
import { formatVoiceNoteDuration } from '@/lib/media/voiceNote';

export type VoiceNoteRecorderProps = {
  locale?: string;
  disabled?: boolean;
  className?: string;
  maxBytes?: number;
  maxDurationMs?: number;
  onSubmit: (recording: VoiceNoteRecording) => void | Promise<void>;
  onCancel?: () => void;
};

function errorMessage(code: VoiceNoteRecorderErrorCode, isId: boolean) {
  const copy: Record<VoiceNoteRecorderErrorCode, [string, string]> = {
    empty: ['Rekaman masih kosong.', 'The recording is empty.'],
    'too-large': [
      'Rekaman terlalu besar. Buat rekaman yang lebih pendek.',
      'The recording is too large. Record a shorter message.',
    ],
    'unsupported-format': [
      'Format rekaman browser ini belum didukung.',
      'This browser recording format is not supported.',
    ],
    'mime-mismatch': [
      'Format dan isi rekaman tidak cocok.',
      'The recording format does not match its contents.',
    ],
    'insecure-context': [
      'Rekam suara membutuhkan HTTPS atau localhost.',
      'Voice recording requires HTTPS or localhost.',
    ],
    unsupported: [
      'Browser ini belum mendukung rekam suara.',
      'This browser does not support voice recording.',
    ],
    'permission-denied': [
      'Izin mikrofon ditolak. Izinkan dari pengaturan browser.',
      'Microphone permission was denied. Allow it in browser settings.',
    ],
    'microphone-not-found': [
      'Mikrofon tidak ditemukan.',
      'No microphone was found.',
    ],
    'microphone-busy': [
      'Mikrofon sedang dipakai aplikasi lain.',
      'The microphone is being used by another app.',
    ],
    'recording-failed': [
      'Rekaman gagal. Silakan coba lagi.',
      'Recording failed. Please try again.',
    ],
  };
  return copy[code][isId ? 0 : 1];
}

export function VoiceNoteRecorder({
  locale = 'id',
  disabled = false,
  className = '',
  maxBytes,
  maxDurationMs,
  onSubmit,
  onCancel,
}: VoiceNoteRecorderProps) {
  const isId = locale.toLowerCase().startsWith('id');
  const recorder = useVoiceNoteRecorder({ maxBytes, maxDurationMs });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const discard = () => {
    recorder.cancel();
    setSubmitError('');
    onCancel?.();
  };

  const submit = async () => {
    if (!recorder.recording || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit(recorder.recording);
      recorder.reset();
    } catch {
      setSubmitError(
        isId
          ? 'Pesan suara belum terkirim. Coba lagi.'
          : 'The voice message was not sent. Try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (recorder.status === 'idle' || recorder.status === 'error') {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => void recorder.start()}
          disabled={disabled}
          className="inline-flex h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-full text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={isId ? 'Rekam pesan suara' : 'Record a voice message'}
          title={isId ? 'Rekam pesan suara' : 'Record a voice message'}
        >
          <Mic className="h-5 w-5" aria-hidden="true" />
        </button>
        {recorder.error ? (
          <p
            role="alert"
            className="mt-1 flex max-w-xs items-start gap-1.5 text-xs text-[color:var(--app-danger)]"
          >
            <CircleAlert
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            {errorMessage(recorder.error, isId)}
          </p>
        ) : null}
      </div>
    );
  }

  if (recorder.status === 'ready' && recorder.recording) {
    return (
      <div
        className={`w-full rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-2 shadow-sm ${className}`}
      >
        <div className="min-w-0">
          <audio
            controls
            preload="metadata"
            src={recorder.recording.previewUrl}
            className="h-11 w-full min-w-0"
            aria-label={
              isId ? 'Pratinjau pesan suara' : 'Voice message preview'
            }
          />
          <div className="mt-1 flex min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-xs text-[color:var(--app-text-soft)]">
              {isId ? 'Siap dikirim' : 'Ready to send'} -{' '}
              <span className="tabular-nums">
                {formatVoiceNoteDuration(recorder.recording.durationMs)}
              </span>
            </span>
            <button
              type="button"
              onClick={discard}
              disabled={submitting}
              className="inline-flex h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-full text-[color:var(--app-danger)] transition hover:bg-[color:var(--app-danger-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-danger)] disabled:opacity-50"
              aria-label={isId ? 'Hapus rekaman' : 'Discard recording'}
              title={isId ? 'Hapus rekaman' : 'Discard recording'}
            >
              <Trash2 className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={disabled || submitting}
              className="inline-flex h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-full bg-[color:var(--app-accent)] text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={isId ? 'Kirim pesan suara' : 'Send voice message'}
              title={isId ? 'Kirim pesan suara' : 'Send voice message'}
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
        {submitError ? (
          <p
            role="alert"
            className="mt-1 text-xs text-[color:var(--app-danger)]"
          >
            {submitError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-14 w-full items-center gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-2 py-1.5 shadow-sm ${className}`}
    >
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
          recorder.status === 'recording'
            ? 'animate-pulse bg-[color:var(--app-danger)]'
            : 'bg-[color:var(--app-text-soft)]'
        }`}
        aria-hidden="true"
      />
      <span
        className="min-w-0 flex-1 text-sm font-semibold text-[color:var(--app-text)]"
        role="status"
        aria-live="polite"
      >
        {recorder.status === 'requesting-permission'
          ? isId
            ? 'Meminta izin mikrofon...'
            : 'Requesting microphone access...'
          : recorder.status === 'processing'
            ? isId
              ? 'Menyiapkan rekaman...'
              : 'Preparing recording...'
            : recorder.status === 'paused'
              ? isId
                ? 'Rekaman dijeda'
                : 'Recording paused'
              : isId
                ? 'Merekam pesan suara'
                : 'Recording voice message'}
      </span>
      <span className="shrink-0 text-sm font-medium tabular-nums text-[color:var(--app-text-soft)]">
        {formatVoiceNoteDuration(recorder.durationMs)}
      </span>

      <button
        type="button"
        onClick={discard}
        className="inline-flex h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-full text-[color:var(--app-danger)] transition hover:bg-[color:var(--app-danger-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-danger)] disabled:opacity-50"
        aria-label={isId ? 'Batalkan rekaman' : 'Cancel recording'}
        title={isId ? 'Batalkan rekaman' : 'Cancel recording'}
      >
        <Trash2 className="h-5 w-5" aria-hidden="true" />
      </button>

      {recorder.status === 'recording' ? (
        <button
          type="button"
          onClick={recorder.pause}
          className="inline-flex h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-full text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
          aria-label={isId ? 'Jeda rekaman' : 'Pause recording'}
          title={isId ? 'Jeda rekaman' : 'Pause recording'}
        >
          <Pause className="h-5 w-5" aria-hidden="true" />
        </button>
      ) : recorder.status === 'paused' ? (
        <button
          type="button"
          onClick={recorder.resume}
          className="inline-flex h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-full text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]"
          aria-label={isId ? 'Lanjutkan rekaman' : 'Resume recording'}
          title={isId ? 'Lanjutkan rekaman' : 'Resume recording'}
        >
          <Play className="h-5 w-5" aria-hidden="true" />
        </button>
      ) : (
        <Loader2
          className="mx-3 h-5 w-5 animate-spin text-[color:var(--app-accent)]"
          aria-hidden="true"
        />
      )}

      {recorder.status === 'recording' || recorder.status === 'paused' ? (
        <button
          type="button"
          onClick={recorder.stop}
          className="inline-flex h-11 min-h-11 w-11 min-w-11 items-center justify-center rounded-full bg-[color:var(--app-accent)] text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2"
          aria-label={isId ? 'Selesai merekam' : 'Finish recording'}
          title={isId ? 'Selesai merekam' : 'Finish recording'}
        >
          <Square className="h-4 w-4 fill-current" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
