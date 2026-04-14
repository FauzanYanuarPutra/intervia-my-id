import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { requireAuth } from '@/lib/serverAuth';
import { isMinIOConfigured, uploadToMinIO } from '@/lib/minio';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 6;

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function safeExt(fileName: string): string {
  const ext = path.extname(fileName || '').toLowerCase();
  if (!ext || ext.length > 8) return '.jpg';
  return ext.replace(/[^a-z0-9.]/g, '') || '.jpg';
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return auth.res;
  }

  try {
    const form = await req.formData();
    const files = form.getAll('images') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES} images allowed` },
        { status: 400 },
      );
    }

    const urls: string[] = [];
    for (const file of files) {
      if (!(file instanceof File)) continue;
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) continue;
      if (file.size > MAX_FILE_BYTES) continue;

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const ext = safeExt(file.name);
      let url = '';

      if (isMinIOConfigured()) {
        const filename = `forum-${Date.now()}-${randomUUID()}${ext}`;
        const uploaded = await uploadToMinIO('forum', buffer, file.type, filename);
        url = uploaded.url;
      } else {
        const base = safeName(path.basename(file.name || 'image', ext));
        const filename = `forum-${Date.now()}-${randomUUID()}-${base}${ext}`;
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'forum');
        await mkdir(uploadDir, { recursive: true });
        await writeFile(path.join(uploadDir, filename), buffer);
        url = `/uploads/forum/${encodeURIComponent(filename)}`;
      }

      urls.push(url);
    }

    if (urls.length === 0) {
      return NextResponse.json({ error: 'No valid images uploaded' }, { status: 400 });
    }

    return NextResponse.json({ urls, count: urls.length });
  } catch (error) {
    console.error('[FORUM_UPLOAD_IMAGES_ERROR]', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

