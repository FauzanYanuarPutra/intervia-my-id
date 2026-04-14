import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { isMinIOConfigured, uploadToMinIO } from '@/lib/minio';

const APP_ENV = process.env.ENV || process.env.APP_ENV || process.env.NODE_ENV;
const CHAT_URL = process.env.INTERNAL_CHAT_URL || 'http://localhost:4000';
const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/bmp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/webm',
  'audio/wav',
  'audio/aac',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.aac': 'audio/aac',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.bmp': 'image/bmp',
};

function inferType(mime: string): 'image' | 'video' | 'audio' | 'file' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'file';
}

function mimeFromFile(file: File): string {
  if (file.type && file.type.trim() !== '') return file.type;
  const ext = path.extname(file.name || '').toLowerCase();
  return EXT_TO_MIME[ext] || 'application/octet-stream';
}

function isAllowedMime(mime: string): boolean {
  if (ALLOWED_MIME.has(mime)) return true;
  if (mime.startsWith('image/')) return true;
  if (mime.startsWith('video/')) return true;
  if (mime.startsWith('audio/')) return true;
  return false;
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

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
  const res = await fetch(`${CHAT_URL}/api/v1/rooms/${encoded}/messages?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  return res.ok;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await context.params;
  const id = safeDecodeRoomId(rawId);
  try {
    const token =
      req.headers.get('authorization')?.replace('Bearer ', '') ||
      req.cookies.get('access_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowed = await canAccessRoom(token, id);
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    const mime = mimeFromFile(file);
    if (!isAllowedMime(mime)) {
      return NextResponse.json({ error: 'file type is not allowed' }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'file too large (max 15MB)' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let publicUrl: string;

    if (isMinIOConfigured()) {
      const { url } = await uploadToMinIO(id, buffer, mime, file.name || 'upload');
      publicUrl = url;
    } else {
      const ext = path.extname(file.name || '')?.toLowerCase() || '';
      const filename = `${Date.now()}-${randomUUID()}-${safeName(path.basename(file.name || 'upload', ext))}${ext || '.bin'}`;
      const safeRoom = safeName(id);
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'chat', safeRoom);
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, filename), buffer);
      publicUrl = `/api/chat/media/local/uploads/chat/${encodeURIComponent(safeRoom)}/${encodeURIComponent(filename)}`;
    }

    return NextResponse.json(
      {
        data: {
          url: publicUrl,
          type: inferType(mime),
          name: file.name,
          size: file.size,
          mime: mime,
          env: APP_ENV,
        },
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: 'upload failed' }, { status: 500 });
  }
}

