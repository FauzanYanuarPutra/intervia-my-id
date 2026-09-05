import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { isPublicContentMediaKey } from './publicMediaKey';

const SAFE_BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const SAFE_KEY_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}$/;

export type PublicMediaMetadata = {
  contentType: string;
  contentLength?: number;
  etag?: string;
  lastModified?: Date;
};

export type PublicMediaObjectResult =
  | { kind: 'found'; body?: Uint8Array; metadata: PublicMediaMetadata }
  | { kind: 'missing' }
  | { kind: 'unavailable'; reason: string };

export function publicMediaErrorCacheControl(): string {
  return 'no-store';
}

function decodeSafe(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return '';
  }
}

function isSafeObjectKey(key: string): boolean {
  const segments = key.split('/').filter(Boolean);
  return (
    segments.length >= 2 &&
    segments.every(
      segment =>
        segment !== '.' &&
        segment !== '..' &&
        !segment.includes('\\') &&
        SAFE_KEY_SEGMENT.test(segment),
    )
  );
}

export function parsePublicMediaPath(
  pathSegments: string[] | undefined,
  configuredBucket: string,
): { bucket: string; key: string } | null {
  if (!pathSegments || pathSegments.length < 3) return null;

  const bucket = decodeSafe(pathSegments[0] ?? '');
  const decodedKeySegments = pathSegments.slice(1).map(decodeSafe);
  if (decodedKeySegments.some(segment => !segment)) return null;
  const key = decodedKeySegments.join('/');

  if (
    bucket !== configuredBucket ||
    !SAFE_BUCKET.test(bucket) ||
    !isSafeObjectKey(key) ||
    !isPublicContentMediaKey(key)
  ) {
    return null;
  }

  return { bucket, key };
}

export function isMissingObjectError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as {
    name?: string;
    Code?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    value.name === 'NoSuchKey' ||
    value.name === 'NotFound' ||
    value.Code === 'NoSuchKey' ||
    value.code === 'NoSuchKey' ||
    value.$metadata?.httpStatusCode === 404
  );
}

function contentTypeForPath(filePath: string, fallback?: string): string {
  if (fallback && fallback !== 'application/octet-stream') return fallback;
  const cleanPath = filePath.split(/[?#]/, 1)[0]?.toLowerCase() ?? '';
  if (cleanPath.endsWith('.jpg') || cleanPath.endsWith('.jpeg')) return 'image/jpeg';
  if (cleanPath.endsWith('.png')) return 'image/png';
  if (cleanPath.endsWith('.webp')) return 'image/webp';
  if (cleanPath.endsWith('.gif')) return 'image/gif';
  if (cleanPath.endsWith('.avif')) return 'image/avif';
  if (cleanPath.endsWith('.svg')) return 'image/svg+xml';
  if (cleanPath.endsWith('.bmp')) return 'image/bmp';
  if (cleanPath.endsWith('.heic')) return 'image/heic';
  if (cleanPath.endsWith('.heif')) return 'image/heif';
  return fallback ?? 'application/octet-stream';
}

export function createPublicMediaClient(input: {
  endpoint?: string;
  accessKey?: string;
  secretKey?: string;
}): S3Client | null {
  if (!input.endpoint || !input.accessKey || !input.secretKey) return null;
  return new S3Client({
    endpoint: input.endpoint,
    region: 'us-east-1',
    credentials: {
      accessKeyId: input.accessKey,
      secretAccessKey: input.secretKey,
    },
    forcePathStyle: true,
  });
}

function metadataFor(
  key: string,
  result: {
    ContentType?: string;
    ContentLength?: number;
    ETag?: string;
    LastModified?: Date;
  },
): PublicMediaMetadata {
  return {
    contentType: contentTypeForPath(key, result.ContentType),
    contentLength:
      typeof result.ContentLength === 'number' && Number.isFinite(result.ContentLength)
        ? result.ContentLength
        : undefined,
    etag: result.ETag,
    lastModified: result.LastModified,
  };
}

export async function getPublicMediaObject(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<PublicMediaObjectResult> {
  try {
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!result.Body) return { kind: 'missing' };
    const bytes = await result.Body.transformToByteArray();
    if (bytes.byteLength === 0) return { kind: 'missing' };
    return {
      kind: 'found',
      body: bytes,
      metadata: metadataFor(key, result),
    };
  } catch (error) {
    if (isMissingObjectError(error)) return { kind: 'missing' };
    return {
      kind: 'unavailable',
      reason: error instanceof Error ? error.message : 'storage unavailable',
    };
  }
}

export async function headPublicMediaObject(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<PublicMediaObjectResult> {
  try {
    const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    if (!result.ContentLength || result.ContentLength <= 0) return { kind: 'missing' };
    return {
      kind: 'found',
      metadata: metadataFor(key, result),
    };
  } catch (error) {
    if (isMissingObjectError(error)) return { kind: 'missing' };
    return {
      kind: 'unavailable',
      reason: error instanceof Error ? error.message : 'storage unavailable',
    };
  }
}
