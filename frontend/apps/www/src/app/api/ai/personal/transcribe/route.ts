import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

import { VOICE_NOTE_UPLOAD_MAX_BYTES } from '@/lib/media/uploadStandard';
import { normalizeVoiceNoteMime } from '@/lib/media/voiceNote';
import { safeErrorCode } from '@/lib/server/safeLog';
import { guardUploadRequest } from '@/lib/server/uploadGuard';
import {
  collectUploadFiles,
  hasExpectedFileSignature,
  validateUploadCandidate,
} from '@/lib/server/uploadFiles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const GROQ_TRANSCRIPTION_MODEL =
  process.env.GROQ_TRANSCRIPTION_MODEL || 'whisper-large-v3-turbo';
const OPENAI_TRANSCRIPTION_MODEL =
  process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe';
const MAX_REQUEST_BYTES = VOICE_NOTE_UPLOAD_MAX_BYTES + 256 * 1024;
const MAX_TRANSCRIPT_CHARS = 6_000;
// Leave headroom inside the 60-second route limit for auth, multipart parsing,
// validation, and serializing the final response.
const TRANSCRIPTION_BUDGET_MS = 52_000;
const MAX_PROVIDER_TIMEOUT_MS = 40_000;
const AUDIO_MIME = new Set([
  'application/ogg',
  'audio/m4a',
  'audio/mp4',
  'audio/ogg',
  'audio/webm',
  'audio/x-m4a',
]);
const AUDIO_EXTENSIONS = new Set(['.m4a', '.ogg', '.webm']);

type TranscriptionProvider = {
  endpoint: string;
  apiKey: string;
  model: string;
};

function requestTooLarge(req: NextRequest) {
  const rawLength = req.headers.get('content-length');
  if (!rawLength) return false;
  const length = Number(rawLength);
  return Number.isFinite(length) && length > MAX_REQUEST_BYTES;
}

function getProviders(): TranscriptionProvider[] {
  const providers: TranscriptionProvider[] = [];
  if (GROQ_API_KEY) {
    providers.push({
      endpoint: 'https://api.groq.com/openai/v1/audio/transcriptions',
      apiKey: GROQ_API_KEY,
      model: GROQ_TRANSCRIPTION_MODEL,
    });
  }
  if (OPENAI_API_KEY) {
    providers.push({
      endpoint: 'https://api.openai.com/v1/audio/transcriptions',
      apiKey: OPENAI_API_KEY,
      model: OPENAI_TRANSCRIPTION_MODEL,
    });
  }
  return providers;
}

function safeTranscript(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.replace(/\u0000/g, '').trim().slice(0, MAX_TRANSCRIPT_CHARS);
}

async function transcribeWithProvider(
  provider: TranscriptionProvider,
  file: File,
  language: 'id' | 'en',
  timeoutMs: number,
) {
  const form = new FormData();
  form.set('file', file, file.name);
  form.set('model', provider.model);
  form.set('language', language);
  form.set('response_format', 'json');
  form.set('temperature', '0');

  const response = await fetch(provider.endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${provider.apiKey}` },
    body: form,
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    if (response.body) {
      await response.body.cancel().catch(() => undefined);
    }
    console.warn('[PERSONAL_AI_TRANSCRIPTION_PROVIDER_ERROR]', {
      provider: new URL(provider.endpoint).hostname,
      status: response.status,
    });
    return '';
  }
  const payload = (await response.json().catch(() => null)) as {
    text?: unknown;
  } | null;
  return safeTranscript(payload?.text);
}

export async function POST(req: NextRequest) {
  const routeStartedAt = Date.now();
  const guard = await guardUploadRequest(req, 'personal-ai-transcription');
  if (!guard.ok) return guard.response;

  if (requestTooLarge(req)) {
    return NextResponse.json(
      { error: 'Rekaman terlalu besar.' },
      { status: 413 },
    );
  }

  try {
    const files = collectUploadFiles(await req.formData(), ['file', 'audio']);
    if (files.length !== 1) {
      return NextResponse.json(
        { error: 'Kirim satu rekaman suara.' },
        { status: 400 },
      );
    }

    const file = files[0]!;
    const extension = path.extname(file.name || '').toLowerCase();
    const mime = normalizeVoiceNoteMime(file.type);
    const validationError = validateUploadCandidate(file, {
      accept: 'media',
      maxBytes: VOICE_NOTE_UPLOAD_MAX_BYTES,
      maxBytesByType: { audio: VOICE_NOTE_UPLOAD_MAX_BYTES },
    });
    if (
      validationError ||
      !AUDIO_EXTENSIONS.has(extension) ||
      !AUDIO_MIME.has(mime)
    ) {
      return NextResponse.json(
        { error: 'Format rekaman tidak didukung.' },
        { status: validationError?.includes('large') ? 413 : 415 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!hasExpectedFileSignature(buffer, extension)) {
      return NextResponse.json(
        { error: 'Isi rekaman tidak sesuai dengan format file.' },
        { status: 415 },
      );
    }

    const providers = getProviders();
    if (providers.length === 0) {
      return NextResponse.json(
        { error: 'Transkripsi suara belum tersedia.' },
        { status: 503 },
      );
    }

    const language =
      req.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'id';
    const providerDeadline = routeStartedAt + TRANSCRIPTION_BUDGET_MS;
    for (const [index, provider] of providers.entries()) {
      const remainingMs = providerDeadline - Date.now();
      const providersLeft = providers.length - index;
      const timeoutMs = Math.min(
        MAX_PROVIDER_TIMEOUT_MS,
        Math.floor(remainingMs / providersLeft),
      );
      if (timeoutMs < 1_000) break;
      try {
        const transcript = await transcribeWithProvider(
          provider,
          file,
          language,
          timeoutMs,
        );
        if (transcript) {
          return NextResponse.json({ data: { text: transcript } });
        }
      } catch (error) {
        console.warn('[PERSONAL_AI_TRANSCRIPTION_PROVIDER_ERROR]', {
          provider: new URL(provider.endpoint).hostname,
          error: safeErrorCode(error),
        });
      }
    }

    return NextResponse.json(
      { error: 'Rekaman belum bisa diubah menjadi teks. Coba lagi.' },
      { status: 502 },
    );
  } catch (error) {
    console.error('[PERSONAL_AI_TRANSCRIPTION_ERROR]', {
      error: safeErrorCode(error),
    });
    return NextResponse.json(
      { error: 'Transkripsi suara gagal. Coba lagi.' },
      { status: 500 },
    );
  }
}
