import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'node:buffer';
import {
  createPublicMediaClient,
  getPublicMediaObject,
  headPublicMediaObject,
  parsePublicMediaPath,
  publicMediaErrorCacheControl,
  type PublicMediaMetadata,
} from '@/lib/server/publicMediaStorage';

const endpoint = process.env.MINIO_ENDPOINT;
const accessKey = process.env.MINIO_ACCESS_KEY ?? process.env.MINIO_USER;
const secretKey = process.env.MINIO_SECRET_KEY ?? process.env.MINIO_PASS;
const configuredBucket = process.env.MINIO_BUCKET ?? 'laju-chat';
const appEnv = process.env.APP_ENV || process.env.ENV || process.env.NODE_ENV;

function errorResponse(message: string, status: 404 | 503) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: { 'Cache-Control': publicMediaErrorCacheControl() },
    },
  );
}

function successHeaders(metadata: PublicMediaMetadata): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': metadata.contentType,
    'Content-Disposition': 'inline',
    'Cache-Control': 'public, max-age=31536000, immutable',
  };
  if (typeof metadata.contentLength === 'number') {
    headers['Content-Length'] = String(metadata.contentLength);
  }
  if (metadata.etag) headers.ETag = metadata.etag;
  if (metadata.lastModified) {
    headers['Last-Modified'] = metadata.lastModified.toUTCString();
  }
  return headers;
}

async function localFallback(key: string, headOnly: boolean) {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  try {
    const filePath = path.join(
      process.cwd(),
      'public',
      'uploads',
      'content',
      path.basename(key),
    );
    const fileBuffer = await fs.readFile(filePath);
    const extension = path.extname(key).toLowerCase();
    const contentType =
      extension === '.jpg' || extension === '.jpeg'
        ? 'image/jpeg'
        : extension === '.png'
          ? 'image/png'
          : extension === '.webp'
            ? 'image/webp'
            : extension === '.gif'
              ? 'image/gif'
              : extension === '.avif'
                ? 'image/avif'
                : 'application/octet-stream';
    const headers = successHeaders({
      contentType,
      contentLength: fileBuffer.byteLength,
    });
    return new NextResponse(headOnly ? null : fileBuffer, { status: 200, headers });
  } catch {
    return errorResponse('Not found', 404);
  }
}

async function handlePublicMedia(
  context: { params: Promise<{ path: string[] }> },
  headOnly: boolean,
) {
  const { path: pathSegments } = await context.params;
  const parsed = parsePublicMediaPath(pathSegments, configuredBucket);
  if (!parsed) return errorResponse('Not found', 404);

  const client = createPublicMediaClient({ endpoint, accessKey, secretKey });
  if (!client) {
    if (appEnv === 'production') {
      return errorResponse('Storage not configured', 503);
    }
    return localFallback(parsed.key, headOnly);
  }

  const result = headOnly
    ? await headPublicMediaObject(client, parsed.bucket, parsed.key)
    : await getPublicMediaObject(client, parsed.bucket, parsed.key);

  if (result.kind === 'missing') {
    console.warn('[CONTENT_MEDIA_MISSING]', {
      bucket: parsed.bucket,
      key: parsed.key,
      method: headOnly ? 'HEAD' : 'GET',
    });
    return errorResponse('Not found', 404);
  }
  if (result.kind === 'unavailable') {
    console.error('[CONTENT_MEDIA_STORAGE_UNAVAILABLE]', {
      bucket: parsed.bucket,
      key: parsed.key,
      method: headOnly ? 'HEAD' : 'GET',
      reason: result.reason,
    });
    return errorResponse('Storage unavailable', 503);
  }

  const headers = successHeaders(result.metadata);
  if (headOnly) return new NextResponse(null, { status: 200, headers });
  if (!result.body) return errorResponse('Not found', 404);
  return new NextResponse(Buffer.from(result.body), { status: 200, headers });
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return handlePublicMedia(context, false);
}

export async function HEAD(
  _req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return handlePublicMedia(context, true);
}
