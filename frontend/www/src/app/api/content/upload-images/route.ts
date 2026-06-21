import { NextRequest, NextResponse } from 'next/server';
import {
  collectUploadFiles,
  readUploadToken,
  storeValidatedUploads,
  uploadErrorResponse,
  uploadSuccessResponse,
} from '@/lib/server/uploadFiles';
import { IMAGE_UPLOAD_RAW_MAX_BYTES } from '@/lib/media/uploadStandard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_FILES = 12;
const IMAGE_KEYS = [
  'images',
  'image',
  'file',
  'files',
  'avatar',
  'photo',
  'profile_image',
  'profile_avatar',
  'cover',
  'cover_image',
  'profile_cover',
  'banner',
];

export async function POST(req: NextRequest) {
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
      folder: 'content',
      maxBytes: IMAGE_UPLOAD_RAW_MAX_BYTES,
      minioTarget: 'content',
      minioTimeoutMs: 2200,
    });

    if (uploaded.length === 0) {
      return NextResponse.json(
        uploadErrorResponse('No valid images uploaded', rejected),
        { status: 400 },
      );
    }

    return NextResponse.json(
      { ...uploadSuccessResponse(uploaded), rejected },
      { status: 200 },
    );
  } catch (error) {
    console.error('[UPLOAD_IMAGES_ERROR]', error);
    return NextResponse.json(
      {
        error: 'Upload failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
