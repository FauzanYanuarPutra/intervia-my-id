import { NextRequest, NextResponse } from 'next/server';
import {
  collectUploadFiles,
  storeValidatedUploads,
  uploadErrorResponse,
  uploadSuccessResponse,
} from '@/lib/server/uploadFiles';
import { DOCUMENT_UPLOAD_MAX_BYTES } from '@/lib/media/uploadStandard';
import { guardUploadRequest } from '@/lib/server/uploadGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_FILES = 10;
const DOCUMENT_KEYS = [
  'files',
  'file',
  'cv',
  'resume',
  'document',
  'documents',
  'attachment',
  'attachments',
];

export async function POST(req: NextRequest) {
  try {
    const guard = await guardUploadRequest(req, 'content:document');
    if (!guard.ok) return guard.response;

    const files = collectUploadFiles(await req.formData(), DOCUMENT_KEYS);
    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES} files allowed` },
        { status: 400 },
      );
    }

    const { rejected, uploaded } = await storeValidatedUploads(files, {
      accept: 'document',
      concurrency: 3,
      folder: 'content',
      maxBytes: DOCUMENT_UPLOAD_MAX_BYTES,
      minioTarget: 'content',
      requireMinio: true,
      minioTimeoutMs: 20000,
    });

    if (uploaded.length === 0) {
      return NextResponse.json(
        uploadErrorResponse('No valid files uploaded', rejected),
        { status: 400 },
      );
    }

    return NextResponse.json(
      { ...uploadSuccessResponse(uploaded), rejected },
      { status: 200 },
    );
  } catch (error) {
    console.error('[UPLOAD_FILES_ERROR]', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 },
    );
  }
}
