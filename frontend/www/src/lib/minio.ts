/**
 * MinIO/S3-compatible upload for chat media.
 * Uses unique keys: chat/{roomId}/{uuid}.{ext} — no overwrites.
 */
import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const endpoint = process.env.MINIO_ENDPOINT;
const accessKey = process.env.MINIO_ACCESS_KEY ?? process.env.MINIO_USER;
const secretKey = process.env.MINIO_SECRET_KEY ?? process.env.MINIO_PASS;
const bucket = process.env.MINIO_BUCKET ?? 'laju-chat';
const publicUrl = process.env.MINIO_PUBLIC_URL ?? '';

function safeRoomKey(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function isMinIOConfigured(): boolean {
  return Boolean(endpoint && accessKey && secretKey);
}

export async function uploadToMinIO(
  roomId: string,
  buffer: Buffer,
  mime: string,
  originalName: string
): Promise<{ url: string; key: string }> {
  if (!endpoint || !accessKey || !secretKey) {
    throw new Error('MinIO not configured');
  }

  const ext = path.extname(originalName || '').toLowerCase() || '.bin';
  // Support untuk content upload (roomId = 'content') atau chat upload
  const prefix = roomId === 'content' ? 'content' : roomId === 'forum' ? 'forum' : 'chat';
  const key = roomId === 'content'
    ? `content/${randomUUID()}${ext}`
    : roomId === 'forum'
      ? `forum/${randomUUID()}${ext}`
      : `chat/${safeRoomKey(roomId)}/${randomUUID()}${ext}`;

  const client = new S3Client({
    endpoint,
    region: 'us-east-1',
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true,
  });

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mime,
    })
  );

  // Prefer proxy URL so client fetches via our API (no CORS, MinIO stays internal)
  const url = publicUrl
    ? `${publicUrl.replace(/\/$/, '')}/${bucket}/${key}`
    : roomId === 'content'
      ? `/api/content/media/${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`
      : roomId === 'forum'
        ? `/api/content/media/${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`
      : `/api/chat/media/${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`;

  return { url, key };
}
