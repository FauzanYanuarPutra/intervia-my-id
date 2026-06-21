import { NextRequest, NextResponse } from 'next/server';
import { proxyCommunityBackend } from '@/lib/community/backendProxy';
import {
  collectUploadFiles,
  readUploadToken,
  storeValidatedUploads,
  uploadErrorResponse,
  uploadSuccessResponse,
} from '@/lib/server/uploadFiles';
import { MEDIA_UPLOAD_RAW_MAX_BYTES } from '@/lib/media/uploadStandard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

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
  if (proxied.status < 500) {
    const payload = await proxied.clone().json().catch(() => null);
    const errorMessage =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as Record<string, unknown>).error || '')
        : '';
    const shouldFallbackToLocal =
      proxied.status === 400 &&
      /invalid media payload|invalid multipart upload|no valid media uploaded/i.test(
        errorMessage,
      );
    if (!shouldFallbackToLocal) {
      return proxied;
    }
  }
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
      maxBytes: MEDIA_UPLOAD_RAW_MAX_BYTES,
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
