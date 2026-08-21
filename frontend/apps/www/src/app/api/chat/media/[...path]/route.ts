/**
 * Proxy media from MinIO. URL: /api/chat/media/{bucket}/chat/{roomId}/{uuid}.ext
 */
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { requireAuth } from '@/lib/serverAuth';

const endpoint = process.env.MINIO_ENDPOINT;
const accessKey = process.env.MINIO_ACCESS_KEY ?? process.env.MINIO_USER;
const secretKey = process.env.MINIO_SECRET_KEY ?? process.env.MINIO_PASS;
const configuredBucket = process.env.MINIO_BUCKET ?? 'laju-chat';
const CHAT_URL = process.env.INTERNAL_CHAT_URL || 'http://localhost:4000';
const SAFE_BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const SAFE_KEY_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}$/;

function getClient(): S3Client | null {
  if (!endpoint || !accessKey || !secretKey) return null;
  return new S3Client({
    endpoint,
    region: 'us-east-1',
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true,
  });
}

function decodeSafe(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function contentTypeForPath(filePath: string, fallback?: string): string {
  if (fallback && fallback !== 'application/octet-stream') return fallback;
  const cleanPath = filePath.split(/[?#]/, 1)[0]?.toLowerCase() ?? '';
  if (cleanPath.endsWith('.jpg') || cleanPath.endsWith('.jpeg')) return 'image/jpeg';
  if (cleanPath.endsWith('.png')) return 'image/png';
  if (cleanPath.endsWith('.webp')) return 'image/webp';
  if (cleanPath.endsWith('.gif')) return 'image/gif';
  if (cleanPath.endsWith('.avif')) return 'image/avif';
  if (cleanPath.endsWith('.svg')) return 'image/svg+xml';
  if (cleanPath.endsWith('.mp4')) return 'video/mp4';
  if (cleanPath.endsWith('.webm')) return 'video/webm';
  if (cleanPath.endsWith('.mov')) return 'video/quicktime';
  if (cleanPath.endsWith('.mp3')) return 'audio/mpeg';
  if (cleanPath.endsWith('.ogg')) return 'audio/ogg';
  if (cleanPath.endsWith('.wav')) return 'audio/wav';
  return fallback ?? 'application/octet-stream';
}

function isSafeObjectKey(key: string): boolean {
  const segments = key.split('/').filter(Boolean);
  return (
    segments.length >= 3 &&
    segments.every(
      segment =>
        segment !== '.' &&
        segment !== '..' &&
        !segment.includes('\\') &&
        SAFE_KEY_SEGMENT.test(segment),
    )
  );
}

function isMissingObjectError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    value.name === 'NoSuchKey' ||
    value.name === 'NotFound' ||
    value.Code === 'NoSuchKey' ||
    value.$metadata?.httpStatusCode === 404
  );
}

function extractRoomId(pathSegments: string[]): string | null {
  const decoded = pathSegments.map(decodeSafe);

  if (decoded[0] === 'local') {
    // /api/chat/media/local/uploads/chat/{roomId}/{file}
    if (decoded.length >= 5 && decoded[1] === 'uploads' && decoded[2] === 'chat') {
      return decoded[3] || null;
    }
    return null;
  }

  // /api/chat/media/{bucket}/chat/{roomId}/{file}
  const chatIdx = decoded.indexOf('chat');
  if (chatIdx === -1 || decoded.length <= chatIdx + 1) return null;
  return decoded[chatIdx + 1] || null;
}

async function canAccessRoom(token: string, roomId: string): Promise<boolean> {
  const encoded = encodeURIComponent(roomId);
  const res = await fetch(`${CHAT_URL}/api/v1/rooms/${encoded}/messages?limit=1`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });
  return res.ok;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const { token } = auth.ctx;
  const { path: pathSegments } = await context.params;
  if (!pathSegments || pathSegments.length < 2) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const roomId = extractRoomId(pathSegments);
  if (!roomId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const allowed = await canAccessRoom(token, roomId);
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const bucket = decodeSafe(pathSegments[0]);

  // Local filesystem fallback path:
  // /api/chat/media/local/uploads/chat/{room}/{file}
  if (bucket === 'local') {
    const relative = pathSegments.slice(1).map(decodeSafe).join('/');
    const normalized = path.normalize(relative).replace(/^(\.\.(\/|\\|$))+/, '');
    const absolute = path.resolve(process.cwd(), 'public', normalized);
    const expectedRoot = path.resolve(process.cwd(), 'public');
    if (!absolute.startsWith(expectedRoot)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    try {
      const file = await readFile(absolute);
      const contentType = contentTypeForPath(absolute);

      return new NextResponse(file, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': 'inline',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  const client = getClient();
  if (!client) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });
  }

  const key = pathSegments.slice(1).map(decodeSafe).join('/');
  if (
    bucket !== configuredBucket ||
    !SAFE_BUCKET.test(bucket) ||
    !isSafeObjectKey(key)
  ) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const res = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    );

    if (!res.Body) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const bytes = await res.Body.transformToByteArray();
    const contentType = contentTypeForPath(key, res.ContentType);
    const buffer = Buffer.from(bytes);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    if (!isMissingObjectError(error)) {
      console.error('[CHAT_MEDIA_GET_ERROR]', error);
      return NextResponse.json(
        { error: 'Storage unavailable' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
