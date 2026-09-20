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

const MISSING_CONTENT_MEDIA_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400" role="img" aria-label="Media tidak tersedia"><rect width="640" height="400" fill="#f1f5f9"/><rect x="220" y="120" width="200" height="140" rx="24" fill="#e2e8f0"/><path d="M255 220l45-55 38 42 28-31 42 44" fill="none" stroke="#94a3b8" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><circle cx="330" cy="166" r="12" fill="#94a3b8"/><text x="320" y="305" text-anchor="middle" font-family="system-ui,sans-serif" font-size="24" font-weight="600" fill="#64748b">Media tidak tersedia</text></svg>',
);

function missingContentMediaResponse(headOnly: boolean) {
  const headers = {
    'Content-Type': 'image/svg+xml',
    'Content-Disposition': 'inline',
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    'Content-Length': String(MISSING_CONTENT_MEDIA_SVG.byteLength),
  };
  return new NextResponse(headOnly ? null : MISSING_CONTENT_MEDIA_SVG, {
    status: 200,
    headers,
  });
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

    // Content media can outlive an object during storage migration/cleanup.
    // Keep public cards free of broken-image 404s while preserving the warning
    // for operators; authenticated chat media remains on its protected proxy.
    if (parsed.key.startsWith('content/')) {
      return missingContentMediaResponse(headOnly);
    }
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
