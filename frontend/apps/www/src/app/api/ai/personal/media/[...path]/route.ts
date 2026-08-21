import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'node:buffer';
import { requireAuth } from '@/lib/serverAuth';

const endpoint = process.env.MINIO_ENDPOINT;
const accessKey = process.env.MINIO_ACCESS_KEY ?? process.env.MINIO_USER;
const secretKey = process.env.MINIO_SECRET_KEY ?? process.env.MINIO_PASS;
const configuredBucket = process.env.MINIO_BUCKET ?? 'laju-chat';

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
    return '';
  }
}

function safeUserKey(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function isSafeObjectKey(key: string): boolean {
  const segments = key.split('/').filter(Boolean);
  return (
    segments.length === 3 &&
    segments[0] === 'personal-ai' &&
    segments.every(
      segment =>
        segment !== '.' &&
        segment !== '..' &&
        !segment.includes('\\') &&
        SAFE_KEY_SEGMENT.test(segment),
    )
  );
}

function contentTypeForPath(filePath: string, fallback?: string): string {
  if (fallback && fallback !== 'application/octet-stream') return fallback;
  const cleanPath = filePath.split(/[?#]/, 1)[0]?.toLowerCase() ?? '';
  if (cleanPath.endsWith('.jpg') || cleanPath.endsWith('.jpeg')) return 'image/jpeg';
  if (cleanPath.endsWith('.png')) return 'image/png';
  if (cleanPath.endsWith('.webp')) return 'image/webp';
  if (cleanPath.endsWith('.gif')) return 'image/gif';
  if (cleanPath.endsWith('.avif')) return 'image/avif';
  if (cleanPath.endsWith('.mp4')) return 'video/mp4';
  if (cleanPath.endsWith('.webm')) return 'video/webm';
  if (cleanPath.endsWith('.mov')) return 'video/quicktime';
  if (cleanPath.endsWith('.mp3')) return 'audio/mpeg';
  if (cleanPath.endsWith('.ogg')) return 'audio/ogg';
  if (cleanPath.endsWith('.wav')) return 'audio/wav';
  if (cleanPath.endsWith('.pdf')) return 'application/pdf';
  if (cleanPath.endsWith('.txt')) return 'text/plain; charset=utf-8';
  return fallback ?? 'application/octet-stream';
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

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const { path: pathSegments } = await context.params;
  if (!pathSegments || pathSegments.length !== 4) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const bucket = decodeSafe(pathSegments[0]);
  const keySegments = pathSegments.slice(1).map(decodeSafe);
  const key = keySegments.join('/');
  const ownerKey = keySegments[1] || '';

  if (
    bucket !== configuredBucket ||
    !SAFE_BUCKET.test(bucket) ||
    !isSafeObjectKey(key) ||
    ownerKey !== safeUserKey(auth.ctx.userId)
  ) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const client = getClient();
  if (!client) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });
  }

  try {
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
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
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (!isMissingObjectError(error)) {
      console.error('[PERSONAL_AI_MEDIA_GET_ERROR]', error);
      return NextResponse.json({ error: 'Storage unavailable' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
