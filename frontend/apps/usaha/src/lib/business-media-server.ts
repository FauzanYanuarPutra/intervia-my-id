import 'server-only';

import type { BusinessImageValue } from '@/lib/media-crop';

const COMMUNITY_URL =
  process.env.COMMUNITY_SERVICE_URL ||
  process.env.INTERNAL_COMMUNITY_URL ||
  'http://community_service:8082';
const MAX_CROPPED_IMAGE_BYTES = 6 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/webp', 'image/jpeg', 'image/png']);

type ImageDimensions = { width: number; height: number };

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

function asciiAt(bytes: Uint8Array, offset: number, value: string): boolean {
  if (offset < 0 || offset + value.length > bytes.length) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (bytes[offset + index] !== value.charCodeAt(index)) return false;
  }
  return true;
}

function uint16Be(bytes: Uint8Array, offset: number): number | null {
  if (offset + 2 > bytes.length) return null;
  return bytes[offset] * 256 + bytes[offset + 1];
}

function uint16Le(bytes: Uint8Array, offset: number): number | null {
  if (offset + 2 > bytes.length) return null;
  return bytes[offset] + bytes[offset + 1] * 256;
}

function uint24Le(bytes: Uint8Array, offset: number): number | null {
  if (offset + 3 > bytes.length) return null;
  return bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65_536;
}

function uint32Be(bytes: Uint8Array, offset: number): number | null {
  if (offset + 4 > bytes.length) return null;
  return (
    bytes[offset] * 16_777_216 +
    bytes[offset + 1] * 65_536 +
    bytes[offset + 2] * 256 +
    bytes[offset + 3]
  );
}

function positiveDimensions(width: number | null, height: number | null): ImageDimensions | null {
  if (!width || !height || width <= 0 || height <= 0) return null;
  return { width, height };
}

function readPngDimensions(bytes: Uint8Array): ImageDimensions | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (
    bytes.length < 24 ||
    !signature.every((value, index) => bytes[index] === value) ||
    !asciiAt(bytes, 12, 'IHDR')
  ) {
    return null;
  }
  return positiveDimensions(uint32Be(bytes, 16), uint32Be(bytes, 20));
}

function readWebpDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 25 || !asciiAt(bytes, 0, 'RIFF') || !asciiAt(bytes, 8, 'WEBP')) {
    return null;
  }

  if (asciiAt(bytes, 12, 'VP8X')) {
    if (bytes.length < 30) return null;
    const width = uint24Le(bytes, 24);
    const height = uint24Le(bytes, 27);
    return positiveDimensions(
      width === null ? null : width + 1,
      height === null ? null : height + 1,
    );
  }

  if (asciiAt(bytes, 12, 'VP8 ')) {
    if (
      bytes.length < 30 ||
      bytes[23] !== 0x9d ||
      bytes[24] !== 0x01 ||
      bytes[25] !== 0x2a
    ) {
      return null;
    }
    const rawWidth = uint16Le(bytes, 26);
    const rawHeight = uint16Le(bytes, 28);
    return positiveDimensions(
      rawWidth === null ? null : rawWidth & 0x3fff,
      rawHeight === null ? null : rawHeight & 0x3fff,
    );
  }

  if (asciiAt(bytes, 12, 'VP8L')) {
    if (bytes.length < 25 || bytes[20] !== 0x2f) return null;
    const width = 1 + bytes[21] + ((bytes[22] & 0x3f) << 8);
    const height =
      1 +
      ((bytes[22] & 0xc0) >> 6) +
      (bytes[23] << 2) +
      ((bytes[24] & 0x0f) << 10);
    return positiveDimensions(width, height);
  }

  return null;
}

function isJpegSofMarker(marker: number): boolean {
  return [
    0xc0,
    0xc1,
    0xc2,
    0xc3,
    0xc5,
    0xc6,
    0xc7,
    0xc9,
    0xca,
    0xcb,
    0xcd,
    0xce,
    0xcf,
  ].includes(marker);
}

function readJpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset < bytes.length) {
    while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return null;

    const marker = bytes[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;

    const segmentLength = uint16Be(bytes, offset);
    if (segmentLength === null || segmentLength < 2 || offset + segmentLength > bytes.length) {
      return null;
    }

    if (isJpegSofMarker(marker)) {
      if (segmentLength < 7) return null;
      return positiveDimensions(
        uint16Be(bytes, offset + 5),
        uint16Be(bytes, offset + 3),
      );
    }

    offset += segmentLength;
  }

  return null;
}

export function readBusinessImageDimensions(
  bytes: Uint8Array,
  mimeType: string,
): ImageDimensions | null {
  const normalizedMime = mimeType.trim().toLowerCase();
  if (normalizedMime === 'image/png') return readPngDimensions(bytes);
  if (normalizedMime === 'image/webp') return readWebpDimensions(bytes);
  if (normalizedMime === 'image/jpeg') return readJpegDimensions(bytes);
  return null;
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

  let actualDimensions: ImageDimensions | null = null;
  try {
    actualDimensions = readBusinessImageDimensions(
      new Uint8Array(await file.arrayBuffer()),
      file.type,
    );
  } catch {
    actualDimensions = null;
  }
  if (
    !actualDimensions ||
    actualDimensions.width !== dimensions.width ||
    actualDimensions.height !== dimensions.height
  ) {
    throw new BusinessMediaUploadError(
      400,
      `Dimensi hasil crop harus tepat ${dimensions.width}×${dimensions.height}px.`,
    );
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
    width: actualDimensions.width,
    height: actualDimensions.height,
  };
}
