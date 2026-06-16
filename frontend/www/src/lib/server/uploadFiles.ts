import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { isMinIOConfigured, uploadToMinIO } from '@/lib/minio';

export type UploadAccept = 'image' | 'document' | 'media' | 'any';

export type StoredUploadFile = {
  name: string;
  url: string;
  size: number;
  mime: string;
  type: 'image' | 'video' | 'audio' | 'file';
};

export type UploadRejection = {
  name: string;
  reason: string;
};

type StoreUploadOptions = {
  accept: UploadAccept;
  folder: string;
  maxBytes: number;
  minioTarget: string;
  minioTimeoutMs?: number;
  concurrency?: number;
};

type ValidateUploadOptions = {
  accept: UploadAccept;
  maxBytes: number;
};

const MIME_BY_EXT: Record<string, string> = {
  '.7z': 'application/x-7z-compressed',
  '.aac': 'audio/aac',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.csv': 'text/csv',
  '.doc': 'application/msword',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.m4a': 'audio/mp4',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx':
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.rar': 'application/x-rar-compressed',
  '.rtf': 'application/rtf',
  '.txt': 'text/plain',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip',
};

const DOCUMENT_EXT = new Set([
  '.7z',
  '.csv',
  '.doc',
  '.docx',
  '.odp',
  '.ods',
  '.odt',
  '.pdf',
  '.ppt',
  '.pptx',
  '.rar',
  '.rtf',
  '.txt',
  '.xls',
  '.xlsx',
  '.zip',
]);

export function readUploadToken(req: NextRequest): string | null {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return (
    bearer?.trim() || req.cookies.get('access_token')?.value?.trim() || null
  );
}

export function collectUploadFiles(form: FormData, keys: string[]): File[] {
  const collected: File[] = [];
  const seen = new Set<File>();
  const pushFile = (value: FormDataEntryValue) => {
    if (!(value instanceof File)) return;
    if (seen.has(value)) return;
    seen.add(value);
    collected.push(value);
  };
  keys.forEach(key => form.getAll(key).forEach(pushFile));
  for (const [, value] of form.entries()) pushFile(value);
  return collected;
}

export function inferUploadMime(file: File): string {
  if (file.type.trim()) return file.type.trim();
  const ext = path.extname(file.name || '').toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

export function uploadErrorResponse(
  error: string,
  rejected: UploadRejection[],
) {
  return { error, rejected, skipped: rejected };
}

export function uploadSuccessResponse(uploaded: StoredUploadFile[]) {
  return {
    count: uploaded.length,
    data: uploaded[0] || null,
    files: uploaded,
    urls: uploaded.map(file => file.url),
  };
}

export async function storeValidatedUploads(
  files: File[],
  options: StoreUploadOptions,
) {
  const rejected: UploadRejection[] = [];
  const results = await mapWithConcurrency(
    files,
    options.concurrency || 3,
    async file => {
      const validationError = validateUploadFile(file, options);
      if (validationError) {
        rejected.push({ name: file.name || 'upload', reason: validationError });
        return null;
      }
      try {
        return await storeUploadFile(file, options);
      } catch (error) {
        rejected.push({
          name: file.name || 'upload',
          reason: error instanceof Error ? error.message : 'upload failed',
        });
        return null;
      }
    },
  );
  return { rejected, uploaded: results.filter(Boolean) as StoredUploadFile[] };
}

export function validateUploadCandidate(
  file: File,
  options: ValidateUploadOptions,
) {
  return validateUploadFile(file, options);
}

function validateUploadFile(file: File, options: ValidateUploadOptions) {
  if (file.size <= 0) return 'file is empty';
  if (file.size > options.maxBytes) {
    return `file too large (max ${formatBytes(options.maxBytes)})`;
  }
  if (!isAllowedUpload(file, options.accept)) {
    return 'file type is not allowed';
  }
  return '';
}

function isAllowedUpload(file: File, accept: UploadAccept): boolean {
  if (accept === 'any') return true;
  const mime = inferUploadMime(file).toLowerCase();
  const ext = path.extname(file.name || '').toLowerCase();
  if (accept === 'image') return mime.startsWith('image/') || isImageExt(ext);
  if (accept === 'document') return isDocumentUpload(mime, ext);
  return isMediaUpload(mime, ext);
}

function isMediaUpload(mime: string, ext: string): boolean {
  return (
    mime.startsWith('image/') ||
    mime.startsWith('video/') ||
    mime.startsWith('audio/') ||
    isDocumentUpload(mime, ext)
  );
}

function isDocumentUpload(mime: string, ext: string): boolean {
  return (
    DOCUMENT_EXT.has(ext) ||
    mime.startsWith('text/') ||
    (mime === 'application/octet-stream' && DOCUMENT_EXT.has(ext)) ||
    mime.includes('pdf') ||
    mime.includes('document') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation') ||
    mime.includes('zip') ||
    mime.includes('rar')
  );
}

function isImageExt(ext: string): boolean {
  return [
    '.avif',
    '.bmp',
    '.gif',
    '.heic',
    '.heif',
    '.jpeg',
    '.jpg',
    '.png',
    '.webp',
  ].includes(ext);
}

async function storeUploadFile(file: File, options: StoreUploadOptions) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = inferUploadMime(file);
  const filename = buildUploadFilename(file);
  const minioUrl = await tryMinioUpload(file, buffer, mime, filename, options);
  const url = minioUrl || (await writeLocalUpload(buffer, filename, options));
  return {
    name: file.name || filename,
    url,
    size: file.size,
    mime,
    type: inferStoredFileType(mime),
  } satisfies StoredUploadFile;
}

async function tryMinioUpload(
  file: File,
  buffer: Buffer,
  mime: string,
  filename: string,
  options: StoreUploadOptions,
) {
  if (!isMinIOConfigured()) return '';
  try {
    const { url } = await withTimeout(
      uploadToMinIO(options.minioTarget, buffer, mime, filename || file.name),
      options.minioTimeoutMs || 2200,
    );
    return url;
  } catch (error) {
    console.error('[UPLOAD_MINIO_FALLBACK]', error);
    return '';
  }
}

async function writeLocalUpload(
  buffer: Buffer,
  filename: string,
  options: StoreUploadOptions,
) {
  const folder = options.folder.split('/').map(safeSegment).join('/');
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), buffer);
  return `/uploads/${folder.split('/').map(encodeURIComponent).join('/')}/${encodeURIComponent(filename)}`;
}

function buildUploadFilename(file: File): string {
  const ext = path.extname(file.name || '').toLowerCase() || '.bin';
  const base = safeSegment(path.basename(file.name || 'upload', ext));
  return `${Date.now()}-${randomUUID()}-${base}${ext}`;
}

function safeSegment(value: string): string {
  return (value || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 96);
}

function inferStoredFileType(mime: string): StoredUploadFile['type'] {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'file';
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('upload timed out')), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
}

function formatBytes(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)}MB`;
}
