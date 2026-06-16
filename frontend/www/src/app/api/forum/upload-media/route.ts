import { NextRequest, NextResponse } from 'next/server';
import { proxyCommunityBackend } from '@/lib/community/backendProxy';
import {
  collectUploadFiles,
  readUploadToken,
  storeValidatedUploads,
  uploadErrorResponse,
  uploadSuccessResponse,
} from '@/lib/server/uploadFiles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const MAX_FILE_BYTES = 120 * 1024 * 1024;
const MAX_FILES = 8;
const MEDIA_KEYS = [
  'media',
  'file',
  'files',
  'image',
  'images',
  'video',
  'audio',
  'attachment',
  'attachments',
];

export async function POST(req: NextRequest) {
  const proxyReq = new NextRequest(req.clone());
  const proxied = await proxyCommunityBackend(
    proxyReq,
    '/v1/forum/upload-media',
    { timeoutMs: 2600 },
  );
  if (proxied.status < 500) return proxied;
  return uploadForumMediaLocally(req);
}

async function uploadForumMediaLocally(req: NextRequest) {
  try {
    if (!readUploadToken(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const files = collectUploadFiles(await req.formData(), MEDIA_KEYS);
    if (files.length === 0) {
      return NextResponse.json({ error: 'No media provided' }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES} media files allowed` },
        { status: 400 },
      );
    }

    const { rejected, uploaded } = await storeValidatedUploads(files, {
      accept: 'media',
      concurrency: 2,
      folder: 'forum',
      maxBytes: MAX_FILE_BYTES,
      minioTarget: 'forum',
      minioTimeoutMs: 2600,
    });

    if (uploaded.length === 0) {
      return NextResponse.json(
        uploadErrorResponse('No valid media uploaded', rejected),
        { status: 400 },
      );
    }

    return NextResponse.json(
      { ...uploadSuccessResponse(uploaded), fallback: 'local', rejected },
      { status: 200 },
    );
  } catch (error) {
    console.error('[FORUM_UPLOAD_MEDIA_FALLBACK_ERROR]', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
