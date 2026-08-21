import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const CONTENT_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'content');
const CONTENT_PLACEHOLDER = path.join(
  process.cwd(),
  'public',
  'images',
  'placeholders',
  'content-default.svg',
);

const IMAGE_CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
};

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function sanitizeSegments(segments: string[]): string[] {
  return segments
    .map((segment) => path.basename(decodeSegment(segment)))
    .filter(Boolean);
}

function contentTypeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

function isImageFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return Boolean(IMAGE_CONTENT_TYPES[ext]);
}

function missingResponse(): NextResponse {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const params = await context.params;
  const safeSegments = sanitizeSegments(Array.isArray(params.path) ? params.path : []);
  if (safeSegments.length === 0) {
    return missingResponse();
  }

  const filename = safeSegments[safeSegments.length - 1];
  const localPath = path.join(CONTENT_UPLOAD_DIR, ...safeSegments);

  try {
    const body = await readFile(localPath);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentTypeFromFilename(filename),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    if (!isImageFile(filename)) {
      return missingResponse();
    }

    try {
      const placeholder = await readFile(CONTENT_PLACEHOLDER);
      return new NextResponse(placeholder, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
        },
      });
    } catch {
      return missingResponse();
    }
  }
}
