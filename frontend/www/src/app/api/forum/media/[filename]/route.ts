import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { proxyCommunityBackend } from '@/lib/community/backendProxy';

export const runtime = 'nodejs';

const LOCAL_FORUM_UPLOAD_DIR = path.join(
  process.cwd(),
  'public',
  'uploads',
  'forum',
);
const MAX_LOCAL_MEDIA_RANGE_BYTES = 4 * 1024 * 1024;

const CONTENT_TYPES: Record<string, string> = {
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.m4v': 'video/x-m4v',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
};

function safeFilename(value: string) {
  try {
    return path.basename(decodeURIComponent(value));
  } catch {
    return path.basename(value);
  }
}

function contentTypeFor(filename: string) {
  return (
    CONTENT_TYPES[path.extname(filename).toLowerCase()] ||
    'application/octet-stream'
  );
}

function parseRange(value: string | null, totalBytes: number) {
  const raw = value?.trim().replace(/^bytes=/i, '');
  if (!raw || raw.includes(',') || totalBytes <= 0) return null;
  const [startRaw, endRaw] = raw.split('-', 2);
  let start: number;
  let end: number;
  if (!startRaw) {
    const suffix = Math.min(
      Math.max(Number.parseInt(endRaw || '0', 10), 1),
      totalBytes,
    );
    start = totalBytes - suffix;
    end = totalBytes - 1;
  } else {
    start = Number.parseInt(startRaw, 10);
    end = endRaw ? Number.parseInt(endRaw, 10) : totalBytes - 1;
  }
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end < start ||
    start >= totalBytes
  ) {
    return null;
  }
  return {
    start,
    end: Math.min(end, totalBytes - 1, start + MAX_LOCAL_MEDIA_RANGE_BYTES - 1),
  };
}

async function serveLocalForumMedia(req: NextRequest, filename: string) {
  const safe = safeFilename(filename);
  if (!safe || safe !== filename) {
    return NextResponse.json({ error: 'Invalid media path' }, { status: 400 });
  }

  const localPath = path.join(LOCAL_FORUM_UPLOAD_DIR, safe);
  try {
    const info = await stat(localPath);
    const totalBytes = info.size;
    const range = req.headers.get('range');
    const contentType = contentTypeFor(safe);

    if (range) {
      const parsed = parseRange(range, totalBytes);
      if (!parsed) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            'Accept-Ranges': 'bytes',
            'Content-Range': `bytes */${totalBytes}`,
          },
        });
      }
      const body = await readFile(localPath);
      const chunk = body.subarray(parsed.start, parsed.end + 1);
      return new NextResponse(chunk, {
        status: 206,
        headers: {
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Length': String(chunk.byteLength),
          'Content-Range': `bytes ${parsed.start}-${parsed.end}/${totalBytes}`,
          'Content-Type': contentType,
        },
      });
    }

    const body = await readFile(localPath);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': String(totalBytes),
        'Content-Type': contentType,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Media not found' }, { status: 404 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  const proxied = await proxyCommunityBackend(
    req,
    `/v1/forum/media/${encodeURIComponent(filename)}`,
    {
      accept:
        'image/avif,image/webp,image/apng,image/svg+xml,image/*,video/*,*/*;q=0.8',
      cacheControl: 'public, max-age=300, stale-while-revalidate=86400',
    },
  );
  if (proxied.ok || (proxied.status < 500 && proxied.status !== 404)) {
    return proxied;
  }
  return serveLocalForumMedia(req, filename);
}
