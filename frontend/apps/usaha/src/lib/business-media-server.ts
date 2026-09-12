import 'server-only';

import type { BusinessImageValue } from '@/lib/media-crop';

const COMMUNITY_URL =
  process.env.COMMUNITY_SERVICE_URL ||
  process.env.INTERNAL_COMMUNITY_URL ||
  'http://community_service:8082';
const MAX_CROPPED_IMAGE_BYTES = 6 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/webp', 'image/jpeg', 'image/png']);

export class BusinessMediaUploadError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'BusinessMediaUploadError';
    this.status = status;
  }
}

export function isInternalBusinessMediaUrl(value: string): boolean {
  return /^\/api\/forum\/media\/[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(value);
}

export async function uploadCroppedBusinessImage(
  file: File,
  token: string,
  dimensions: { width: number; height: number },
): Promise<BusinessImageValue> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_CROPPED_IMAGE_BYTES) {
    throw new BusinessMediaUploadError(400, 'Foto harus JPG, PNG, atau WebP dan maksimal 6 MB.');
  }
  if (
    !Number.isInteger(dimensions.width) ||
    !Number.isInteger(dimensions.height) ||
    dimensions.width < 320 ||
    dimensions.height < 320 ||
    dimensions.width > 4096 ||
    dimensions.height > 4096
  ) {
    throw new BusinessMediaUploadError(400, 'Ukuran hasil crop tidak valid.');
  }

  const body = new FormData();
  body.append('media', file, file.name);
  let response: Response;
  try {
    response = await fetch(`${COMMUNITY_URL}/v1/forum/upload-media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new BusinessMediaUploadError(503, 'Penyimpanan foto sedang tidak tersedia.');
  }

  const payload = (await response.json().catch(() => ({}))) as { urls?: unknown; error?: unknown };
  if (!response.ok) {
    const message = typeof payload.error === 'string' ? payload.error : 'Upload foto gagal.';
    throw new BusinessMediaUploadError(response.status, message);
  }
  const url = Array.isArray(payload.urls) && typeof payload.urls[0] === 'string'
    ? payload.urls[0].trim()
    : '';
  if (!isInternalBusinessMediaUrl(url)) {
    throw new BusinessMediaUploadError(502, 'Lokasi foto dari penyimpanan tidak valid.');
  }

  return {
    url,
    mimeType: file.type,
    width: dimensions.width,
    height: dimensions.height,
  };
}
