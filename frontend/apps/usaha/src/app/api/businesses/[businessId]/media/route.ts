import { NextResponse } from 'next/server';
import { normalizeBusinessApiError } from '@/lib/business-api-error';
import {
  BusinessMediaUploadError,
  uploadCroppedBusinessImage,
} from '@/lib/business-media-server';
import { getBusinessForCurrentActor, updateBusiness } from '@/lib/business-server';
import { readAccessToken } from '@/lib/auth-session';
import { updateCanonicalProduct } from '@/lib/product-mutation-server';
import { mediaCropPreset, type BusinessMediaKind } from '@/lib/media-crop';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 45;

function isMediaKind(value: FormDataEntryValue | null): value is BusinessMediaKind {
  return value === 'logo' || value === 'banner' || value === 'product';
}

export async function POST(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await context.params;
  try {
    const [business, token] = await Promise.all([
      getBusinessForCurrentActor(businessId),
      readAccessToken(),
    ]);
    if (!business || !token) {
      return NextResponse.json({ error: 'Usaha tidak ditemukan.' }, { status: 404 });
    }

    const form = await request.formData();
    const kind = form.get('kind');
    const file = form.get('file');
    if (!isMediaKind(kind) || !(file instanceof File)) {
      return NextResponse.json({ error: 'File dan jenis foto wajib diisi.' }, { status: 400 });
    }
    const requiredPermission = kind === 'product' ? 'manageProducts' : 'manageInfo';
    if (!business.permissions.includes(requiredPermission)) {
      return NextResponse.json({ error: 'Kamu tidak memiliki akses untuk mengubah foto ini.' }, { status: 403 });
    }

    const preset = mediaCropPreset(kind);
    const media = await uploadCroppedBusinessImage(file, token, preset);
    const productId = typeof form.get('productId') === 'string'
      ? String(form.get('productId')).trim()
      : '';

    if (kind === 'logo') {
      await updateBusiness(business.id, { logo: media });
    } else if (kind === 'banner') {
      await updateBusiness(business.id, { banner: media });
    } else if (productId) {
      await updateCanonicalProduct(business.id, productId, { image: media });
    }

    return NextResponse.json({ ok: true, media });
  } catch (error) {
    if (error instanceof BusinessMediaUploadError) {
      return NextResponse.json(
        { error: error.message, code: 'business_media_upload_failed' },
        { status: error.status },
      );
    }
    const normalized = normalizeBusinessApiError(error, 'Upload foto belum berhasil.');
    return NextResponse.json(
      { error: normalized.message, code: normalized.code },
      { status: normalized.status },
    );
  }
}
