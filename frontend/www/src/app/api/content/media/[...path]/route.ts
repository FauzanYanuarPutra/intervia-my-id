/**
 * Proxy media from MinIO for content images. URL: /api/content/media/{bucket}/content/{uuid}.ext
 */
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'node:buffer';

const endpoint = process.env.MINIO_ENDPOINT;
const accessKey = process.env.MINIO_ACCESS_KEY ?? process.env.MINIO_USER;
const secretKey = process.env.MINIO_SECRET_KEY ?? process.env.MINIO_PASS;

function getClient(): S3Client | null {
  if (!endpoint || !accessKey || !secretKey) return null;
  return new S3Client({
    endpoint,
    region: 'us-east-1',
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true,
  });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await context.params;
  if (!pathSegments || pathSegments.length < 2) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const client = getClient();
  if (!client) {
    // Fallback to local file system
    const bucket = decodeURIComponent(pathSegments[0]);
    const key = pathSegments.slice(1).map(decodeURIComponent).join('/');
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    try {
      const filePath = path.join(process.cwd(), 'public', 'uploads', 'content', path.basename(key));
      const fileBuffer = await fs.readFile(filePath);
      const ext = path.extname(key).toLowerCase();
      const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' 
        : ext === '.png' ? 'image/png'
        : ext === '.webp' ? 'image/webp'
        : ext === '.gif' ? 'image/gif'
        : 'application/octet-stream';
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  const bucket = decodeURIComponent(pathSegments[0]);
  const key = pathSegments.slice(1).map(decodeURIComponent).join('/');

  try {
    const res = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    );

    if (!res.Body) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const bytes = await res.Body.transformToByteArray();
    const contentType = res.ContentType ?? 'application/octet-stream';
    const buffer = Buffer.from(bytes);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
