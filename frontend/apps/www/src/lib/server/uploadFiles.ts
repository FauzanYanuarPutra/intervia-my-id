import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
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
  maxBytesByType?: Partial<Record<StoredUploadFile['type'], number>>;
  minioTarget: string;
  requireMinio?: boolean;
  minioTimeoutMs?: number;
  concurrency?: number;
};

type ValidateUploadOptions = {
  accept: UploadAccept;
  maxBytes: number;
  maxBytesByType?: Partial<Record<StoredUploadFile['type'], number>>;
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

const IMAGE_EXT = new Set([
  '.avif',
  '.bmp',
  '.gif',
  '.heic',
  '.heif',
  '.jpeg',
  '.jpg',
  '.png',
  '.webp',
]);

const VIDEO_EXT = new Set(['.mov', '.mp4', '.webm']);
const AUDIO_EXT = new Set(['.aac', '.m4a', '.mp3', '.ogg', '.wav']);

const MIME_ALIASES_BY_EXT: Record<string, Set<string>> = {
  '.aac': new Set(['audio/aac', 'audio/x-aac']),
  '.csv': new Set(['text/csv', 'application/csv']),
  '.heic': new Set(['image/heic', 'image/heif']),
  '.heif': new Set(['image/heif', 'image/heic']),
  '.jpg': new Set(['image/jpeg', 'image/pjpeg']),
  '.jpeg': new Set(['image/jpeg', 'image/pjpeg']),
  '.m4a': new Set(['audio/m4a', 'audio/mp4', 'audio/x-m4a']),
  '.ogg': new Set(['application/ogg', 'audio/ogg']),
  '.rar': new Set(['application/x-rar-compressed', 'application/vnd.rar']),
  '.rtf': new Set(['application/rtf', 'text/rtf']),
  '.wav': new Set(['audio/wav', 'audio/x-wav']),
  '.webm': new Set(['audio/webm', 'video/webm']),
  '.zip': new Set(['application/zip', 'application/x-zip-compressed']),
};

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
  const mime = inferUploadMime(file);
  const storedType = inferStoredFileType(mime, file.name);
  const typeLimit = options.maxBytesByType?.[storedType];
  const maxBytes =
    typeof typeLimit === 'number' && Number.isFinite(typeLimit) && typeLimit > 0
      ? Math.min(options.maxBytes, typeLimit)
      : options.maxBytes;
  if (file.size > maxBytes) {
    return `file too large (max ${formatBytes(maxBytes)})`;
  }
  if (!isAllowedUpload(file, options.accept)) {
    return 'file type is not allowed';
  }
  return '';
}

function isAllowedUpload(file: File, accept: UploadAccept): boolean {
  const mime = inferUploadMime(file).toLowerCase();
  const ext = path.extname(file.name || '').toLowerCase();
  if (!ext || !MIME_BY_EXT[ext] || !mimeMatchesExtension(mime, ext)) {
    return false;
  }
  if (accept === 'image') return IMAGE_EXT.has(ext);
  if (accept === 'document') return DOCUMENT_EXT.has(ext);
  if (accept === 'media') {
    return (
      IMAGE_EXT.has(ext) ||
      VIDEO_EXT.has(ext) ||
      AUDIO_EXT.has(ext) ||
      DOCUMENT_EXT.has(ext)
    );
  }
  return true;
}

function mimeMatchesExtension(mime: string, ext: string): boolean {
  const normalizedMime =
    mime.split(';', 1)[0]?.trim().toLowerCase() || mime.toLowerCase();
  if (normalizedMime === 'application/octet-stream') return true;
  const aliases = MIME_ALIASES_BY_EXT[ext];
  if (aliases) return aliases.has(normalizedMime);
  return MIME_BY_EXT[ext] === normalizedMime;
}

async function storeUploadFile(file: File, options: StoreUploadOptions) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = inferUploadMime(file);
  const ext = path.extname(file.name || '').toLowerCase();
  if (!hasExpectedFileSignature(buffer, ext)) {
    throw new Error('file content does not match its extension');
  }
  const filename = buildUploadFilename(file);
  const minioUrl = await tryMinioUpload(file, buffer, mime, filename, options);
  const url = minioUrl || (await writeLocalUpload(buffer, filename, options));
  return {
    name: file.name || filename,
    url,
    size: file.size,
    mime,
    type: inferStoredFileType(mime, file.name),
  } satisfies StoredUploadFile;
}

export function hasExpectedFileSignature(buffer: Buffer, ext: string): boolean {
  if (ext === '.jpg' || ext === '.jpeg') {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }
  if (ext === '.png') {
    return buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (ext === '.gif') {
    const header = buffer.subarray(0, 6).toString('ascii');
    return header === 'GIF87a' || header === 'GIF89a';
  }
  if (ext === '.webp') {
    return (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  if (ext === '.bmp') return buffer.subarray(0, 2).toString('ascii') === 'BM';
  if (ext === '.pdf')
    return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (ext === '.avif' || ext === '.heic' || ext === '.heif') {
    return buffer.subarray(4, 12).toString('ascii').includes('ftyp');
  }
  if (ext === '.webm') {
    return buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  }
  if (ext === '.ogg') {
    return buffer.subarray(0, 4).toString('ascii') === 'OggS';
  }
  if (ext === '.m4a') {
    return buffer.subarray(4, 8).toString('ascii') === 'ftyp';
  }
  return true;
}

async function tryMinioUpload(
  file: File,
  buffer: Buffer,
  mime: string,
  filename: string,
  options: StoreUploadOptions,
) {
  if (!isMinIOConfigured()) {
    if (options.requireMinio) {
      throw new Error('storage is not configured');
    }
    return '';
  }
  try {
    const { url } = await withTimeout(
      uploadToMinIO(options.minioTarget, buffer, mime, filename || file.name),
      options.minioTimeoutMs || 15000,
    );
    return url;
  } catch (error) {
    console.error('[UPLOAD_MINIO_FALLBACK]', error);
    if (options.requireMinio) {
      throw new Error('storage upload failed');
    }
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

function inferStoredFileType(
  mime: string,
  filename = '',
): StoredUploadFile['type'] {
  const normalizedMime =
    mime.split(';', 1)[0]?.trim().toLowerCase() || mime.toLowerCase();
  if (normalizedMime.startsWith('image/')) return 'image';
  if (normalizedMime.startsWith('video/')) return 'video';
  if (
    normalizedMime.startsWith('audio/') ||
    normalizedMime === 'application/ogg'
  ) {
    return 'audio';
  }
  if (normalizedMime === 'application/octet-stream') {
    const ext = path.extname(filename).toLowerCase();
    if (IMAGE_EXT.has(ext)) return 'image';
    if (VIDEO_EXT.has(ext)) return 'video';
    if (AUDIO_EXT.has(ext)) return 'audio';
  }
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
