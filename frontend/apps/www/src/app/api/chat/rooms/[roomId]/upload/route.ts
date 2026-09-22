import { NextRequest, NextResponse } from 'next/server';
import {
  collectUploadFiles,
  storeValidatedUploads,
  uploadErrorResponse,
  uploadSuccessResponse,
} from '@/lib/server/uploadFiles';
import { guardUploadRequest } from '@/lib/server/uploadGuard';
import {
  DOCUMENT_UPLOAD_MAX_BYTES,
  MEDIA_UPLOAD_RAW_MAX_BYTES,
  VOICE_NOTE_UPLOAD_MAX_BYTES,
} from '@/lib/media/uploadStandard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const INTERNAL_CHAT_URL =
  process.env.INTERNAL_CHAT_URL ||
  process.env.INTERNAL_CHAT_SERVICE_URL ||
  'http://chat_service:4000';

const ROOM_ACCESS_TIMEOUT_MS = 8_000;

async function canAccessRoom(token: string, roomId: string): Promise<{
  ok: boolean;
  status: number;
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ROOM_ACCESS_TIMEOUT_MS);

  try {
    const encodedRoomId = encodeURIComponent(roomId);
    const response = await fetch(
      `${INTERNAL_CHAT_URL}/api/v1/rooms/${encodedRoomId}/messages?limit=1`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
        signal: controller.signal,
      },
    );

    return {
      ok: response.ok,
      status: response.status,
    };
  } catch {
    return { ok: false, status: 503 };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ roomId: string }> },
) {
  try {
    const guard = await guardUploadRequest(req, 'chat:media');
    if (!guard.ok) return guard.response;

    const { roomId: rawRoomId } = await context.params;
    let roomId = rawRoomId?.trim() || '';
    try {
      roomId = decodeURIComponent(roomId);
    } catch {
      // Keep the original segment if it was already decoded.
    }

    if (!roomId || roomId.length > 240) {
      return NextResponse.json(
        { error: 'Invalid chat room.' },
        { status: 400 },
      );
    }

    const roomAccess = await canAccessRoom(guard.auth.token, roomId);
    if (!roomAccess.ok) {
      return NextResponse.json(
        {
          error:
            roomAccess.status === 404
              ? 'Chat room not found or access denied.'
              : 'Chat room is temporarily unavailable.',
        },
        { status: roomAccess.status === 404 ? 404 : 503 },
      );
    }

    const form = await req.formData();
    const files = collectUploadFiles(form, ['file', 'files', 'media', 'attachment']);

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No media file provided.' },
        { status: 400 },
      );
    }

    if (files.length > 1) {
      return NextResponse.json(
        { error: 'Only one media file can be uploaded per request.' },
        { status: 400 },
      );
    }

    const { rejected, uploaded } = await storeValidatedUploads(files, {
      accept: 'media',
      concurrency: 1,
      folder: 'chat',
      maxBytes: MEDIA_UPLOAD_RAW_MAX_BYTES,
      maxBytesByType: {
        audio: VOICE_NOTE_UPLOAD_MAX_BYTES,
        file: DOCUMENT_UPLOAD_MAX_BYTES,
      },
      minioTarget: roomId,
      requireMinio: true,
      minioTimeoutMs: 30_000,
    });

    if (uploaded.length === 0) {
      return NextResponse.json(
        uploadErrorResponse('Media upload failed.', rejected),
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        ...uploadSuccessResponse(uploaded),
        rejected,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    console.error('[CHAT_MEDIA_UPLOAD_ERROR]', error);
    return NextResponse.json(
      { error: 'Media upload failed.' },
      { status: 500 },
    );
  }
}
