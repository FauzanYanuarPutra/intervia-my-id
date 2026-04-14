import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { isMinIOConfigured, uploadToMinIO } from '@/lib/minio';

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB per image
const MAX_FILES = 10;

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/bmp',
  'image/avif',
]);

const ALLOWED_IMAGE_EXT = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.heic',
  '.heif',
  '.bmp',
  '.avif',
]);

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function isAllowedImage(file: File): boolean {
  const ext = path.extname(file.name || '').toLowerCase();
  if (ALLOWED_IMAGE_TYPES.has(file.type)) return true;
  if (ALLOWED_IMAGE_EXT.has(ext)) return true;
  return file.type.startsWith('image/');
}

function collectImageFiles(form: FormData): File[] {
  const preferredKeys = [
    'images',
    'image',
    'file',
    'files',
    'avatar',
    'photo',
    'profile_image',
    'profile_avatar',
    'cover',
    'cover_image',
    'profile_cover',
    'banner',
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
    const files = collectImageFiles(form);

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No images provided' },
        { status: 400 },
      );
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES} images allowed` },
        { status: 400 },
      );
    }

    const uploadedUrls: string[] = [];

    for (const file of files) {
      if (!(file instanceof File)) continue;

      // Validate file type
      if (!isAllowedImage(file)) {
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_BYTES) {
        continue;
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      let publicUrl: string;

      if (isMinIOConfigured()) {
        const ext = path.extname(file.name || '')?.toLowerCase() || '.jpg';
        const filename = `content-${Date.now()}-${randomUUID()}${ext}`;
        // Upload ke MinIO dengan path content/
        const { url } = await uploadToMinIO(
          'content',
          buffer,
          file.type,
          filename,
        );
        publicUrl = url;
      } else {
        const ext = path.extname(file.name || '')?.toLowerCase() || '.jpg';
        const filename = `content-${Date.now()}-${randomUUID()}-${safeName(path.basename(file.name || 'image', ext))}${ext}`;
        const uploadDir = path.join(
          process.cwd(),
          'public',
          'uploads',
          'content',
        );
        await mkdir(uploadDir, { recursive: true });
        await writeFile(path.join(uploadDir, filename), buffer);
        publicUrl = `/uploads/content/${encodeURIComponent(filename)}`;
      }

      uploadedUrls.push(publicUrl);
    }

    if (uploadedUrls.length === 0) {
      return NextResponse.json(
        { error: 'No valid images uploaded' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        urls: uploadedUrls,
        count: uploadedUrls.length,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[UPLOAD_IMAGES_ERROR]', error);
    return NextResponse.json(
      {
        error: 'Upload failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
