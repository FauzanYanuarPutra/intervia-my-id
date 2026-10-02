import { NextRequest, NextResponse } from 'next/server';
import { collectUploadFiles, storeValidatedUploads, uploadErrorResponse, uploadSuccessResponse } from '@/lib/server/uploadFiles';
import { MEDIA_UPLOAD_RAW_MAX_BYTES, VOICE_NOTE_UPLOAD_MAX_BYTES, DOCUMENT_UPLOAD_MAX_BYTES } from '@/lib/media/uploadStandard';
import { enforceAuthRouteSecurity } from '@/lib/authSecurity';
import { enforceRateLimit } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';
import { getUmkmStoreById, updateUmkmStoreMetadata } from '@/lib/super-app/umkm-commerce';
import { hasUmkmStorePermission } from '@/lib/super-app/umkm-authorization';
import { sanitizeOwnerWritableUmkmMetadata } from '@/lib/super-app/umkm-owner-metadata';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';

function readGalleryMedia(store: Awaited<ReturnType<typeof getUmkmStoreById>>) {
  const metadata = store && store.metadata && typeof store.metadata === 'object' ? store.metadata as Record<string, unknown> : {};
  const value = metadata.gallery_media;
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map(item => item.trim());
}

async function getAuthorizedStore(req: NextRequest, storeId: string) {
  const auth = await requireAuth(req);
  if (!auth.ok) return { response: auth.res, store: null, auth: null };
  const security = await enforceAuthRouteSecurity(req, { routeKey: 'super-app-umkm-store-media', ipLimit: 100, deviceLimit: 80, windowSeconds: 3600 });
  if (!security.ok) return { response: security.response, store: null, auth: null };
  const rl = await enforceRateLimit({ key: `superapp:umkm:store-media:${auth.ctx.userId}:${security.ip}`, limit: 80, windowSeconds: 3600, message: 'Too many store media requests. Please retry later.' });
  if (!rl.ok) return { response: rl.response, store: null, auth: null };
  const store = await getUmkmStoreById(storeId);
  if (!store) return { response: NextResponse.json({ error: 'Store not found' }, { status: 404 }), store: null, auth: null };
  if (!hasUmkmStorePermission({ storeId: store.id, ownerUserId: store.owner_user_id, actorUserId: auth.ctx.userId, actorEmail: auth.ctx.email, roles: auth.ctx.roles, permission: 'store:update' })) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), store: null, auth: null };
  }
  return { response: null, store, auth };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  try {
    const { storeId } = await params;
    if (!storeId || storeId.length > 100) {
      return NextResponse.json({ error: 'Store tidak valid.' }, { status: 400 });
    }

    const upstream = await fetch(
      `${MARKETPLACE_URL}/v1/umkm/stores/${encodeURIComponent(storeId)}/media`,
      {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      },
    );
    const payload = await upstream.json().catch(() => ({}));
    return NextResponse.json(payload, {
      status: upstream.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[UMKM_STORE_MEDIA_PUBLIC_READ_ERROR]', error);
    return NextResponse.json(
      { error: 'Galeri usaha belum tersedia.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  try {
    const { storeId } = await params;
    const guard = await getAuthorizedStore(req, storeId);
    if (guard.response) return guard.response;
    if (!guard.store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    const form = await req.formData();
    const files = collectUploadFiles(form, ['file', 'files', 'media']);
    if (!files.length) return NextResponse.json({ error: 'No media file provided.' }, { status: 400 });
    if (files.length > 12) return NextResponse.json({ error: 'Maximum 12 media files per upload.' }, { status: 400 });
    const result = await storeValidatedUploads(files, {
      accept: 'media',
      concurrency: 3,
      folder: `umkm/stores/${storeId}/gallery`,
      maxBytes: MEDIA_UPLOAD_RAW_MAX_BYTES,
      maxBytesByType: { audio: VOICE_NOTE_UPLOAD_MAX_BYTES, file: DOCUMENT_UPLOAD_MAX_BYTES },
      minioTarget: `umkm/${storeId}/gallery`,
      requireMinio: false,
      minioTimeoutMs: 30000,
    });
    const mediaUrls = result.uploaded.filter(item => item.type === 'image' || item.type === 'video').map(item => item.url).filter(Boolean);
    if (!mediaUrls.length) return NextResponse.json(uploadErrorResponse('Only image/video media can be added to the gallery.', result.rejected), { status: 400 });
    const current = readGalleryMedia(guard.store);
    const merged = Array.from(new Set([...current, ...mediaUrls])).slice(-24);
    const updated = await updateUmkmStoreMetadata({ storeId, metadataPatch: sanitizeOwnerWritableUmkmMetadata({ gallery_media: merged }) || { gallery_media: merged } });
    return NextResponse.json({ ...uploadSuccessResponse(result.uploaded), rejected: result.rejected, gallery_media: readGalleryMedia(updated) }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[UMKM_STORE_MEDIA_UPLOAD_ERROR]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Media upload failed.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  try {
    const { storeId } = await params;
    const guard = await getAuthorizedStore(req, storeId);
    if (guard.response) return guard.response;
    if (!guard.store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    const body = await req.json().catch(() => ({})) as { url?: unknown };
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    if (!url) return NextResponse.json({ error: 'Media URL is required.' }, { status: 400 });
    const current = readGalleryMedia(guard.store);
    const next = current.filter(item => item !== url);
    await updateUmkmStoreMetadata({ storeId, metadataPatch: sanitizeOwnerWritableUmkmMetadata({ gallery_media: next }) || { gallery_media: next } });
    return NextResponse.json({ gallery_media: next }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[UMKM_STORE_MEDIA_DELETE_ERROR]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Media removal failed.' }, { status: 500 });
  }
}