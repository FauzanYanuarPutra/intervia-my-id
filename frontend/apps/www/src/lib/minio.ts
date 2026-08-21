/**
 * MinIO/S3-compatible upload for chat media.
 * Uses unique keys: chat/{roomId}/{uuid}.{ext} — no overwrites.
 */
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const endpoint = process.env.MINIO_ENDPOINT;
const accessKey = process.env.MINIO_ACCESS_KEY ?? process.env.MINIO_USER;
const secretKey = process.env.MINIO_SECRET_KEY ?? process.env.MINIO_PASS;
const bucket = process.env.MINIO_BUCKET ?? 'laju-chat';
const publicUrl = process.env.MINIO_PUBLIC_URL ?? '';

let cachedClient: S3Client | null = null;
let bucketReady: Promise<void> | null = null;

const EXT_BY_MIME: Record<string, string> = {
  'image/avif': '.avif',
  'image/bmp': '.bmp',
  'image/gif': '.gif',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/svg+xml': '.svg',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'audio/aac': '.aac',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'audio/webm': '.webm',
  'application/pdf': '.pdf',
};

function safeRoomKey(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function safeObjectExtension(originalName: string, mime: string): string {
  const byMime = EXT_BY_MIME[mime.toLowerCase()];
  if (byMime) return byMime;
  const ext = path.extname(originalName || '').toLowerCase();
  return /^[a-z0-9.]{2,12}$/.test(ext) ? ext : '.bin';
}

export function isMinIOConfigured(): boolean {
  return Boolean(endpoint && accessKey && secretKey);
}

function getMinioClient(): S3Client {
  if (cachedClient) return cachedClient;
  if (!endpoint || !accessKey || !secretKey) {
    throw new Error('MinIO not configured');
  }
  cachedClient = new S3Client({
    endpoint,
    region: 'us-east-1',
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true,
  });
  return cachedClient;
}

async function ensureBucket(client: S3Client): Promise<void> {
  if (!bucketReady) {
    bucketReady = client
      .send(new HeadBucketCommand({ Bucket: bucket }))
      .then(() => undefined)
      .catch(async () => {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
      });
  }
  try {
    return await bucketReady;
  } catch (error) {
    bucketReady = null;
    throw error;
  }
}

export async function uploadToMinIO(
  roomId: string,
  buffer: Buffer,
  mime: string,
  originalName: string,
): Promise<{ url: string; key: string }> {
  const client = getMinioClient();

  const ext = safeObjectExtension(originalName, mime);
  const personalAiUserId = roomId.startsWith('personal-ai/')
    ? safeRoomKey(roomId.slice('personal-ai/'.length))
    : '';
  // Support content/forum public-ish media, personal AI private media, or chat media.
  const key =
    roomId === 'content'
      ? `content/${randomUUID()}${ext}`
      : roomId === 'forum'
        ? `forum/${randomUUID()}${ext}`
        : personalAiUserId
          ? `personal-ai/${personalAiUserId}/${randomUUID()}${ext}`
          : `chat/${safeRoomKey(roomId)}/${randomUUID()}${ext}`;

  await ensureBucket(client);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mime,
      CacheControl: 'public, max-age=31536000, immutable',
      ContentDisposition: 'inline',
    }),
  );

  // Prefer proxy URL so client fetches via our API (no CORS, MinIO stays internal)
  const url = personalAiUserId
    ? `/api/ai/personal/media/${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`
    : roomId === 'content' || roomId === 'forum'
      ? publicUrl
        ? `${publicUrl.replace(/\/$/, '')}/${bucket}/${key}`
        : `/api/content/media/${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`
      : `/api/chat/media/${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`;

  return { url, key };
}

export async function promotePersonalAiMedia(input: {
  url: string;
  ownerId: string;
  maxBytes?: number;
}): Promise<{ url: string; key: string }> {
  const pathname = input.url.startsWith('/')
    ? input.url
    : (() => {
        try {
          return new URL(input.url).pathname;
        } catch {
          return '';
        }
      })();
  const prefix = '/api/ai/personal/media/';
  const parts = pathname
    .slice(prefix.length)
    .split('/')
    .map(part => {
      try {
        return decodeURIComponent(part);
      } catch {
        return '';
      }
    })
    .filter(Boolean);
  const safeOwner = safeRoomKey(input.ownerId);
  if (
    !pathname.startsWith(prefix) ||
    parts.length !== 4 ||
    parts[0] !== bucket ||
    parts[1] !== 'personal-ai' ||
    parts[2] !== safeOwner ||
    parts.some(part => !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}$/.test(part))
  ) {
    throw new Error('Media is not owned by the authenticated user');
  }

  const client = getMinioClient();
  const sourceKey = parts.slice(1).join('/');
  const object = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: sourceKey }),
  );
  if (!object.Body) throw new Error('Media object was not found');
  const maxBytes = input.maxBytes ?? 15 * 1024 * 1024;
  if (Number(object.ContentLength || 0) > maxBytes) {
    throw new Error('Media is too large to reuse');
  }
  const bytes = await object.Body.transformToByteArray();
  if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) {
    throw new Error('Media is too large to reuse');
  }
  return uploadToMinIO(
    'content',
    Buffer.from(bytes),
    object.ContentType || 'application/octet-stream',
    parts[3],
  );
}
