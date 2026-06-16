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
export const maxDuration = 60;

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 12;
const IMAGE_KEYS = ['images', 'image', 'file', 'files', 'media', 'photo'];

export async function POST(req: NextRequest) {
  const proxyReq = new NextRequest(req.clone());
  const proxied = await proxyCommunityBackend(
    proxyReq,
    '/v1/forum/upload-images',
    { timeoutMs: 2200 },
  );
  if (proxied.status < 500) return proxied;
  return uploadForumImagesLocally(req);
}

async function uploadForumImagesLocally(req: NextRequest) {
  try {
    if (!readUploadToken(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const files = collectUploadFiles(await req.formData(), IMAGE_KEYS);
    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No images provided' },
        { status: 400 },
      );
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES} images allowed` },
        { status: 400 },
      );
    }

    const { rejected, uploaded } = await storeValidatedUploads(files, {
      accept: 'image',
      concurrency: 4,
      folder: 'forum',
      maxBytes: MAX_FILE_BYTES,
      minioTarget: 'forum',
      minioTimeoutMs: 2200,
    });

    if (uploaded.length === 0) {
      return NextResponse.json(
        uploadErrorResponse('No valid images uploaded', rejected),
        { status: 400 },
      );
    }

    return NextResponse.json(
      { ...uploadSuccessResponse(uploaded), fallback: 'local', rejected },
      { status: 200 },
    );
  } catch (error) {
    console.error('[FORUM_UPLOAD_IMAGES_FALLBACK_ERROR]', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
