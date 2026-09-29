import { NextRequest, NextResponse } from 'next/server';
import {
  collectUploadFiles,
  storeValidatedUploads,
} from '@/lib/server/uploadFiles';
import { IMAGE_UPLOAD_RAW_MAX_BYTES } from '@/lib/media/uploadStandard';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';

async function readStoreId(params: Promise<{ storeId: string }>) {
  const { storeId } = await params;
  return storeId.trim();
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const security = await enforceAuthRouteSecurity(req, {
    routeKey: 'super-app-umkm-store-media-contribution',
    ipLimit: 30,
    deviceLimit: 24,
    windowSeconds: 3600,
  });
  if (!security.ok) return security.response;

  const rl = await enforceRateLimit({
    key: `superapp:umkm:store-media-contribution:${auth.ctx.userId}:${security.ip}`,
    limit: 20,
    windowSeconds: 3600,
    message: 'Terlalu banyak upload foto. Coba lagi nanti.',
  });
  if (!rl.ok) return rl.response;

  const storeId = await readStoreId(params);
  if (!storeId || storeId.length > 100) {
    return NextResponse.json({ error: 'Store tidak valid.' }, { status: 400 });
  }

  try {
    const form = await req.formData();
    const files = collectUploadFiles(form, ['file', 'files', 'media']);
    if (files.length !== 1) {
      return NextResponse.json(
        { error: 'Pilih tepat satu foto atau video.' },
        { status: 400 },
      );
    }

    const captionRaw = form.get('caption');
    const caption =
      typeof captionRaw === 'string' ? captionRaw.trim().slice(0, 500) : '';

    const result = await storeValidatedUploads(files, {
      accept: 'media',
      concurrency: 1,
      folder: `umkm/stores/${storeId}/contributions`,
      maxBytes: IMAGE_UPLOAD_RAW_MAX_BYTES,
      minioTarget: `umkm/${storeId}/contributions`,
      requireMinio: false,
      minioTimeoutMs: 30000,
    });

    const uploaded = result.uploaded.find(
      item => item.type === 'image' || item.type === 'video',
    );
    if (!uploaded?.url) {
      return NextResponse.json(
        { error: result.rejected[0]?.reason || 'Foto/video tidak berhasil diproses.' },
        { status: 400 },
      );
    }

    const upstream = await fetch(
      `${MARKETPLACE_URL}/v1/umkm/stores/${encodeURIComponent(storeId)}/media/contributions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.ctx.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          media_url: uploaded.url,
          media_type: uploaded.type,
          caption: caption || undefined,
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      },
    );

    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      return NextResponse.json(
        { error: payload.error || 'Kontribusi foto belum berhasil disimpan.' },
        { status: upstream.status },
      );
    }

    return NextResponse.json(
      {
        ...payload,
        uploaded_url: uploaded.url,
        rejected: result.rejected,
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[UMKM_STORE_MEDIA_CONTRIBUTION_ERROR]', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Upload kontribusi media gagal.',
      },
      { status: 500 },
    );
  }
}
