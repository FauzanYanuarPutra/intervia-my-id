/**
 * Proxy media from MinIO for content images. URL: /api/content/media/{bucket}/content/{uuid}.ext
 */
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'node:buffer';

const endpoint = process.env.MINIO_ENDPOINT;
const accessKey = process.env.MINIO_ACCESS_KEY ?? process.env.MINIO_USER;
const secretKey = process.env.MINIO_SECRET_KEY ?? process.env.MINIO_PASS;
const configuredBucket = process.env.MINIO_BUCKET ?? 'laju-chat';
const appEnv = process.env.APP_ENV || process.env.ENV || process.env.NODE_ENV;

const SAFE_BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const SAFE_KEY_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}$/;

function contentTypeForPath(filePath: string, fallback?: string): string {
  if (fallback && fallback !== 'application/octet-stream') return fallback;
  const cleanPath = filePath.split(/[?#]/, 1)[0]?.toLowerCase() ?? '';
  if (cleanPath.endsWith('.jpg') || cleanPath.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (cleanPath.endsWith('.png')) return 'image/png';
  if (cleanPath.endsWith('.webp')) return 'image/webp';
  if (cleanPath.endsWith('.gif')) return 'image/gif';
  if (cleanPath.endsWith('.avif')) return 'image/avif';
  if (cleanPath.endsWith('.svg')) return 'image/svg+xml';
  if (cleanPath.endsWith('.bmp')) return 'image/bmp';
  if (cleanPath.endsWith('.heic')) return 'image/heic';
  if (cleanPath.endsWith('.heif')) return 'image/heif';
  return fallback ?? 'application/octet-stream';
}

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

function isSafeObjectKey(key: string): boolean {
  const segments = key.split('/').filter(Boolean);
  return (
    segments.length >= 2 &&
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
  const value = error as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  return (
    value.name === 'NoSuchKey' ||
    value.name === 'NotFound' ||
    value.Code === 'NoSuchKey' ||
    value.$metadata?.httpStatusCode === 404
  );
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await context.params;
  if (!pathSegments || pathSegments.length < 2) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const client = getClient();
  if (!client) {
    if (appEnv === 'production') {
      return NextResponse.json(
        { error: 'Storage not configured' },
        { status: 503 },
      );
    }
    // Fallback to local file system
    const key = pathSegments.slice(1).map(decodeSafe).join('/');
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    try {
      const filePath = path.join(process.cwd(), 'public', 'uploads', 'content', path.basename(key));
      const fileBuffer = await fs.readFile(filePath);
      const contentType = contentTypeForPath(key);
      
      return new NextResponse(fileBuffer, {
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

  const bucket = decodeSafe(pathSegments[0]);
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
      console.error('[CONTENT_MEDIA_GET_ERROR]', error);
      return NextResponse.json(
        { error: 'Storage unavailable' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
