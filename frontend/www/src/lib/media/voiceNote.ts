import { VOICE_NOTE_UPLOAD_MAX_BYTES } from './uploadStandard';

export const VOICE_NOTE_MAX_DURATION_MS = 5 * 60 * 1000;
export const VOICE_NOTE_AUDIO_BITS_PER_SECOND = 64_000;

export const VOICE_NOTE_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/webm',
  'audio/ogg',
] as const;

export type VoiceNoteContainer = 'webm' | 'ogg' | 'mp4';

export type VoiceNoteFileErrorCode =
  | 'empty'
  | 'too-large'
  | 'unsupported-format'
  | 'mime-mismatch';

export class VoiceNoteFileError extends Error {
  constructor(public readonly code: VoiceNoteFileErrorCode) {
    super(code);
    this.name = 'VoiceNoteFileError';
  }
}

export function selectVoiceNoteMime(
  isTypeSupported: (mimeType: string) => boolean,
): string {
  return (
    VOICE_NOTE_MIME_CANDIDATES.find(mimeType => isTypeSupported(mimeType)) || ''
  );
}

export function normalizeVoiceNoteMime(mimeType: string): string {
  return mimeType.split(';', 1)[0]?.trim().toLowerCase() || '';
}

export function detectVoiceNoteContainer(
  header: Uint8Array,
): VoiceNoteContainer | null {
  if (
    header.length >= 4 &&
    header[0] === 0x1a &&
    header[1] === 0x45 &&
    header[2] === 0xdf &&
    header[3] === 0xa3
  ) {
    return 'webm';
  }
  if (
    header.length >= 4 &&
    header[0] === 0x4f &&
    header[1] === 0x67 &&
    header[2] === 0x67 &&
    header[3] === 0x53
  ) {
    return 'ogg';
  }
  if (
    header.length >= 8 &&
    header[4] === 0x66 &&
    header[5] === 0x74 &&
    header[6] === 0x79 &&
    header[7] === 0x70
  ) {
    return 'mp4';
  }
  return null;
}

function containerForMime(mimeType: string): VoiceNoteContainer | null {
  const normalized = normalizeVoiceNoteMime(mimeType);
  if (normalized === 'audio/webm') return 'webm';
  if (normalized === 'audio/ogg' || normalized === 'application/ogg') {
    return 'ogg';
  }
  if (
    normalized === 'audio/m4a' ||
    normalized === 'audio/mp4' ||
    normalized === 'audio/x-m4a'
  ) {
    return 'mp4';
  }
  return null;
}

function fileDetails(container: VoiceNoteContainer) {
  if (container === 'ogg') return { extension: 'ogg', mimeType: 'audio/ogg' };
  if (container === 'mp4') return { extension: 'm4a', mimeType: 'audio/mp4' };
  return { extension: 'webm', mimeType: 'audio/webm' };
}

export async function createVoiceNoteFile(
  blob: Blob,
  options: { maxBytes?: number; now?: number } = {},
): Promise<File> {
  const maxBytes = options.maxBytes ?? VOICE_NOTE_UPLOAD_MAX_BYTES;
  if (blob.size <= 0) throw new VoiceNoteFileError('empty');
  if (blob.size > maxBytes) throw new VoiceNoteFileError('too-large');

  const header = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const detectedContainer = detectVoiceNoteContainer(header);
  if (!detectedContainer) {
    throw new VoiceNoteFileError('unsupported-format');
  }

  const declaredContainer = blob.type ? containerForMime(blob.type) : null;
  if (blob.type && !declaredContainer) {
    throw new VoiceNoteFileError('unsupported-format');
  }
  if (declaredContainer && declaredContainer !== detectedContainer) {
    throw new VoiceNoteFileError('mime-mismatch');
  }

  const now = options.now ?? Date.now();
  const { extension, mimeType } = fileDetails(detectedContainer);
  return new File([blob], `voice-note-${now}.${extension}`, {
    type: mimeType,
    lastModified: now,
  });
}

export function formatVoiceNoteDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
