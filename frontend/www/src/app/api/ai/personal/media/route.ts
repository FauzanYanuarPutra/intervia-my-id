import { NextRequest, NextResponse } from 'next/server';
import { MEDIA_UPLOAD_RAW_MAX_BYTES } from '@/lib/media/uploadStandard';
import { safeErrorCode } from '@/lib/server/safeLog';
import { guardUploadRequest } from '@/lib/server/uploadGuard';
import {
  collectUploadFiles,
  inferUploadMime,
  storeValidatedUploads,
  uploadErrorResponse,
  uploadSuccessResponse,
  type UploadRejection,
} from '@/lib/server/uploadFiles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_FILES = 4;
const PERSONAL_AI_MEDIA_KEYS = [
  'file',
  'files',
  'media',
  'attachment',
  'attachments',
  'image',
  'document',
];

const UNSAFE_INLINE_MIME = new Set([
  'image/svg+xml',
  'text/html',
  'application/xhtml+xml',
  'application/xml',
  'text/xml',
]);

function isUnsafePersonalAiUpload(file: File) {
  const mime = inferUploadMime(file).toLowerCase();
  return UNSAFE_INLINE_MIME.has(mime);
}

export async function POST(req: NextRequest) {
  const guard = await guardUploadRequest(req, 'personal-ai-media');
  if (!guard.ok) return guard.response;

  try {
    const incomingFiles = collectUploadFiles(await req.formData(), PERSONAL_AI_MEDIA_KEYS);
    const rejected: UploadRejection[] = [];
    const files = incomingFiles.filter(file => {
      if (!isUnsafePersonalAiUpload(file)) return true;
      rejected.push({
        name: file.name || 'upload',
        reason: 'file type is not allowed for private AI media',
      });
      return false;
    });
    if (files.length === 0) {
      return NextResponse.json(
        uploadErrorResponse('No valid media uploaded', rejected),
        { status: 400 },
      );
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES} files allowed` },
        { status: 400 },
      );
    }

    const result = await storeValidatedUploads(files, {
      accept: 'media',
      concurrency: 2,
      folder: `personal-ai/${guard.auth.userId}`,
      maxBytes: MEDIA_UPLOAD_RAW_MAX_BYTES,
      minioTarget: `personal-ai/${guard.auth.userId}`,
      requireMinio: true,
      minioTimeoutMs: 20_000,
    });
    rejected.push(...result.rejected);
    const uploaded = result.uploaded;

    if (uploaded.length === 0) {
      return NextResponse.json(
        uploadErrorResponse('No valid media uploaded', rejected),
        { status: 400 },
      );
    }

    return NextResponse.json(
      { ...uploadSuccessResponse(uploaded), rejected },
      { status: 201 },
    );
  } catch (error) {
    console.error('[PERSONAL_AI_MEDIA_UPLOAD_ERROR]', {
      error: safeErrorCode(error),
    });
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
