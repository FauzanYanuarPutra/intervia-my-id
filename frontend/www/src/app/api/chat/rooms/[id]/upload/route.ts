import { NextRequest, NextResponse } from 'next/server';
import {
  collectUploadFiles,
  readUploadToken,
  storeValidatedUploads,
} from '@/lib/server/uploadFiles';

const APP_ENV = process.env.ENV || process.env.APP_ENV || process.env.NODE_ENV;
const CHAT_URL = process.env.INTERNAL_CHAT_URL || 'http://localhost:4000';
const MAX_FILE_BYTES = 80 * 1024 * 1024;
const CHAT_FILE_KEYS = ['file', 'media', 'attachment'];

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

function safeDecodeRoomId(id: string): string {
  try {
    let decoded = id;
    while (decoded !== decodeURIComponent(decoded)) {
      decoded = decodeURIComponent(decoded);
    }
    return decoded;
  } catch {
    return id;
  }
}

async function canAccessRoom(token: string, roomId: string): Promise<boolean> {
  const encoded = encodeURIComponent(roomId);
  const res = await fetch(
    `${CHAT_URL}/api/v1/rooms/${encoded}/messages?limit=1`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    },
  );
  return res.ok;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await context.params;
  const id = safeDecodeRoomId(rawId);
  try {
    const token = readUploadToken(req);

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowed = await canAccessRoom(token, id);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const files = collectUploadFiles(await req.formData(), CHAT_FILE_KEYS);
    const file = files[0];
    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    if (files.length > 1) {
      return NextResponse.json(
        { error: 'Only one file can be uploaded at a time' },
        { status: 400 },
      );
    }

    const { rejected, uploaded } = await storeValidatedUploads([file], {
      accept: 'media',
      concurrency: 1,
      folder: `chat/${id}`,
      maxBytes: MAX_FILE_BYTES,
      minioTarget: id,
      minioTimeoutMs: 2600,
    });
    const stored = uploaded[0];
    if (!stored) {
      return NextResponse.json(
        { error: rejected[0]?.reason || 'upload failed', rejected },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        data: {
          url: stored.url,
          type: stored.type,
          name: stored.name,
          size: stored.size,
          mime: stored.mime,
          env: APP_ENV,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[CHAT_UPLOAD_ERROR]', error);
    return NextResponse.json({ error: 'upload failed' }, { status: 500 });
  }
}
