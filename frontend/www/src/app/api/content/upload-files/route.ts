import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { isMinIOConfigured, uploadToMinIO } from '@/lib/minio';

const MAX_FILE_BYTES = 30 * 1024 * 1024; // 30MB per document
const MAX_FILES = 8;

const ALLOWED_DOC_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/rtf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/octet-stream',
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/x-zip-compressed',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.txt',
  '.csv',
  '.rtf',
  '.doc',
  '.docx',
  '.odt',
  '.xls',
  '.xlsx',
  '.ods',
  '.ppt',
  '.pptx',
  '.odp',
  '.zip',
  '.rar',
  '.7z',
]);

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function isAllowedDocument(file: File): boolean {
  const ext = path.extname(file.name || '').toLowerCase();
  if (ALLOWED_DOC_TYPES.has(file.type)) return true;
  return ALLOWED_EXTENSIONS.has(ext);
}

function collectDocumentFiles(form: FormData): File[] {
  const preferredKeys = [
    'files',
    'file',
    'cv',
    'resume',
    'document',
    'documents',
    'attachment',
    'attachments',
  ];
  const collected: File[] = [];
  const seen = new Set<string>();

  const pushFile = (value: FormDataEntryValue) => {
    if (!(value instanceof File)) return;
    const signature = `${value.name}:${value.size}:${value.type}`;
    if (seen.has(signature)) return;
    seen.add(signature);
    collected.push(value);
  };

  for (const key of preferredKeys) {
    for (const entry of form.getAll(key)) {
      pushFile(entry);
    }
  }

  for (const [, value] of form.entries()) {
    pushFile(value);
  }

  return collected;
}

export async function POST(req: NextRequest) {
  try {
    const token =
      req.headers.get('authorization')?.replace('Bearer ', '') ||
      req.cookies.get('access_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const form = await req.formData();
    const files = collectDocumentFiles(form);

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Maximum ${MAX_FILES} files allowed` }, { status: 400 });
    }

    const uploadedFiles: Array<{
      name: string;
      url: string;
      size: number;
      mime: string;
    }> = [];

    for (const file of files) {
      if (!(file instanceof File)) continue;
      if (!isAllowedDocument(file)) continue;
      if (file.size > MAX_FILE_BYTES) continue;

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const ext = path.extname(file.name || '')?.toLowerCase() || '.bin';
      const safeBase = safeName(path.basename(file.name || 'document', ext));
      const filename = `content-doc-${Date.now()}-${randomUUID()}-${safeBase}${ext}`;

      let publicUrl: string;

      if (isMinIOConfigured()) {
        const { url } = await uploadToMinIO('content', buffer, file.type || 'application/octet-stream', filename);
        publicUrl = url;
      } else {
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'content');
        await mkdir(uploadDir, { recursive: true });
        await writeFile(path.join(uploadDir, filename), buffer);
        publicUrl = `/uploads/content/${encodeURIComponent(filename)}`;
      }

      uploadedFiles.push({
        name: file.name,
        url: publicUrl,
        size: file.size,
        mime: file.type || 'application/octet-stream',
      });
    }

    if (uploadedFiles.length === 0) {
      return NextResponse.json({ error: 'No valid files uploaded' }, { status: 400 });
    }

    return NextResponse.json(
      {
        files: uploadedFiles,
        urls: uploadedFiles.map((entry) => entry.url),
        count: uploadedFiles.length,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[UPLOAD_FILES_ERROR]', error);
    return NextResponse.json(
      {
        error: 'Upload failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
