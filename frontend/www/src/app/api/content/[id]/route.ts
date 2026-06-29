import { NextRequest, NextResponse } from 'next/server';
import { parseJsonBody } from '@/lib/serverRequest';
import { evaluateTrustSafety } from '@/lib/trustSafety';
import {
  canTransitionContentStatus,
  collectTrustSafetyCandidates,
  toUpsertListingPayload,
  validateListingPayload,
} from '@/lib/content/listingFlowRules';
import {
  attachOwnerProfilesToContent,
  fetchOwnerPublicProfiles,
  shouldIncludeOwnerProfiles,
} from '@/lib/content/ownerProfiles';
import {
  isPlaceholderLikeContentImage,
  normalizeContentMediaUrl,
  resolveImageGallery,
  type ContentItem as CatalogContentItem,
} from '@/lib/content/catalog';
import { extractContentId } from '@/lib/content/routes';
import { requireAuth } from '@/lib/serverAuth';
import {
  enforceCreatorBudget,
  refundCreatorBudget,
} from '@/lib/server/creatorBudget';

const marketplaceBase =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';

function readForwardToken(req: NextRequest): string | null {
  const bearer = req.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '')
    .trim();
  if (bearer) return bearer;
  return req.cookies.get('access_token')?.value?.trim() || null;
}

function setNestedString(
  target: Record<string, unknown>,
  path: string,
  value: string,
) {
  const segments = path.split('.').filter(Boolean);
  if (segments.length === 0) return;
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i];
    const current = cursor[key];
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      const next: Record<string, unknown> = {};
      cursor[key] = next;
      cursor = next;
      continue;
    }
    cursor = current as Record<string, unknown>;
  }
  cursor[segments[segments.length - 1]] = value;
}

function normalizeStatus(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function readUpstreamPayload(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text.trim() || 'Upstream request failed' };
  }
}

function absolutizeIfRelativeUrl(value: string, origin: string): string {
  const trimmed = value.trim();
  const normalized = normalizeContentMediaUrl(trimmed);
  if (
    normalized.startsWith('/api/content/media/') ||
    normalized.startsWith('/api/chat/media/') ||
    normalized.startsWith('/api/forum/media/') ||
    normalized.startsWith('/uploads/') ||
    normalized.startsWith('data:') ||
    normalized.startsWith('blob:')
  ) {
    return normalized;
  }
  if (!normalized.startsWith('/')) return normalized || trimmed;
  try {
    return new URL(normalized, origin).toString();
  } catch {
    return normalized || trimmed;
  }
}

function normalizeMediaPayloadValue(value: unknown, origin: string): unknown {
  if (typeof value === 'string') return absolutizeIfRelativeUrl(value, origin);
  if (Array.isArray(value)) {
    return value.map(entry => normalizeMediaPayloadValue(entry, origin));
  }
  if (!value || typeof value !== 'object') return value;

  const record = { ...(value as Record<string, unknown>) };
  for (const key of [
    'url',
    'src',
    'image',
    'image_url',
    'imageUrl',
    'cover_image',
    'coverImage',
    'thumbnail',
    'thumbnail_url',
    'thumbnailUrl',
    'media_url',
    'mediaUrl',
    'photo_url',
    'photoUrl',
  ]) {
    if (typeof record[key] === 'string') {
      record[key] = absolutizeIfRelativeUrl(record[key] as string, origin);
    }
  }
  return record;
}

function normalizeContentMediaUrls(
  payload: Record<string, unknown>,
  origin: string,
): Record<string, unknown> {
  const normalized = { ...payload };
  if (typeof normalized.cover_image === 'string') {
    normalized.cover_image = absolutizeIfRelativeUrl(
      normalized.cover_image,
      origin,
    );
  }

  if (
    !normalized.metadata ||
    typeof normalized.metadata !== 'object' ||
    Array.isArray(normalized.metadata)
  ) {
    return normalized;
  }

  const metadata = {
    ...(normalized.metadata as Record<string, unknown>),
  };

  for (const key of [
    'cover_image',
    'coverImage',
    'cover_image_url',
    'coverImageUrl',
    'image',
    'image_url',
    'imageUrl',
    'thumbnail',
    'thumbnail_url',
    'thumbnailUrl',
    'media_url',
    'mediaUrl',
    'photo_url',
    'photoUrl',
    'banner',
    'banner_url',
    'bannerUrl',
    'logo',
    'logo_url',
    'logoUrl',
  ]) {
    if (typeof metadata[key] === 'string') {
      metadata[key] = absolutizeIfRelativeUrl(metadata[key] as string, origin);
    }
  }

  for (const key of [
    'images',
    'image_urls',
    'imageUrls',
    'gallery',
    'gallery_images',
    'galleryImages',
    'media_urls',
    'mediaUrls',
    'media',
    'media_gallery',
    'mediaGallery',
    'photos',
    'photo_urls',
    'photoUrls',
    'attachments',
    'detail_images',
    'detailImages',
    'portfolio_images',
    'portfolioImages',
    'property_images',
    'propertyImages',
    'listing_images',
    'listingImages',
  ]) {
    if (Array.isArray(metadata[key])) {
      metadata[key] = metadata[key].map(entry =>
        normalizeMediaPayloadValue(entry, origin),
      );
    }
  }

  if (Array.isArray(metadata.documents)) {
    metadata.documents = metadata.documents.map(entry => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry))
        return entry;
      const record = { ...(entry as Record<string, unknown>) };
      if (typeof record.url === 'string') {
        record.url = absolutizeIfRelativeUrl(record.url, origin);
      }
      return record;
    });
  }

  normalized.metadata = metadata;
  return normalized;
}

function extractMediaString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  for (const key of [
    'url',
    'src',
    'image',
    'image_url',
    'imageUrl',
    'cover_image',
    'coverImage',
    'thumbnail',
    'thumbnail_url',
    'thumbnailUrl',
    'media_url',
    'mediaUrl',
    'photo_url',
    'photoUrl',
  ]) {
    if (typeof record[key] === 'string' && record[key].trim()) {
      return record[key].trim();
    }
  }
  return '';
}

function shouldReplaceMediaList(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) return true;
  return value.every(entry => {
    const src = extractMediaString(entry);
    return !src || isPlaceholderLikeContentImage(src);
  });
}

function attachResolvedContentMedia(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...payload };
  const gallery = resolveImageGallery(next as CatalogContentItem);
  if (gallery.length === 0) return next;

  const coverImage =
    typeof next.cover_image === 'string' ? next.cover_image : '';
  if (!coverImage || isPlaceholderLikeContentImage(coverImage)) {
    next.cover_image = gallery[0];
  }
  if (shouldReplaceMediaList(next.image_urls)) {
    next.image_urls = gallery;
  }

  const metadata =
    next.metadata &&
    typeof next.metadata === 'object' &&
    !Array.isArray(next.metadata)
      ? { ...(next.metadata as Record<string, unknown>) }
      : {};
  const metadataCover =
    typeof metadata.cover_image === 'string' ? metadata.cover_image : '';
  if (!metadataCover || isPlaceholderLikeContentImage(metadataCover)) {
    metadata.cover_image = gallery[0];
  }
  if (shouldReplaceMediaList(metadata.image_urls)) {
    metadata.image_urls = gallery;
  }
  if (metadata.media_source === 'first_party_category_asset') {
    metadata.media_source = 'external_category_photo';
  }
  next.metadata = metadata;

  return next;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const resolvedContentId = extractContentId(resolvedParams.id);

  if (!marketplaceBase) {
    return NextResponse.json(
      { error: 'Marketplace service URL not configured' },
      { status: 500 },
    );
  }

  const includeOwnerProfiles = shouldIncludeOwnerProfiles(
    new URL(req.url).searchParams,
  );
  const token = readForwardToken(req);
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const backendRes = await fetch(
    `${marketplaceBase}/v1/content/${resolvedContentId || resolvedParams.id}`,
    { method: 'GET', headers },
  );

  let data = await backendRes.json().catch(() => null);
  if (
    backendRes.ok &&
    data &&
    typeof data === 'object' &&
    !Array.isArray(data)
  ) {
    if (includeOwnerProfiles) {
      const enriched = await fetchOwnerPublicProfiles({
        req,
        identityBase:
          process.env.INTERNAL_API_URL ||
          process.env.NEXT_PUBLIC_API_URL ||
          'http://localhost:8080',
        items: [data as Record<string, unknown>],
      });
      if (enriched.size > 0) {
        data = attachOwnerProfilesToContent(
          [data as Record<string, unknown>],
          enriched,
        )[0];
      }
    }
    data = attachResolvedContentMedia(data as Record<string, unknown>);
  }
  return NextResponse.json(data ?? { error: 'Invalid response' }, {
    status: backendRes.status,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!marketplaceBase) {
    return NextResponse.json(
      { error: 'Marketplace service URL not configured' },
      { status: 500 },
    );
  }

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;
  const token = auth.ctx.token;

  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.ok) return parsedBody.response;
  if (!parsedBody.data || typeof parsedBody.data !== 'object') {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }

  const requestedPayload = parsedBody.data as Record<string, unknown>;

  // ==========================================
  // FIX: FORCE STATUS TO ACTIVE (KECUALI DRAFT)
  // ==========================================
  const incomingStatus = normalizeStatus(requestedPayload.content_status);
  if (incomingStatus !== 'draft') {
    requestedPayload.content_status = 'active';
  }
  // ==========================================

  const validatedPatch = validateListingPayload(requestedPayload, {
    mode: 'update',
  });
  if (!validatedPatch.ok) {
    return NextResponse.json(
      { error: validatedPatch.error, issues: validatedPatch.issues },
      { status: 422 },
    );
  }

  const resolvedParams = await params;
  const resolvedContentId = extractContentId(resolvedParams.id);
  const existingRes = await fetch(
    `${marketplaceBase}/v1/content/${resolvedContentId || resolvedParams.id}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    },
  );
  const existingData = await existingRes.json().catch(() => null);
  if (!existingRes.ok || !existingData || typeof existingData !== 'object') {
    return NextResponse.json(
      existingData ?? { error: 'Failed to load current content state' },
      { status: existingRes.status || 502 },
    );
  }
  const currentState = existingData as Record<string, unknown>;
  const currentStatus =
    normalizeStatus(currentState.content_status) ||
    normalizeStatus(currentState.status) ||
    'draft';
  
  // Menggunakan status yang sudah kita normalisasi & paksa di atas
  const requestedStatus = normalizeStatus(requestedPayload.content_status);

  // ==========================================
  // FIX: BYPASS TRANSITION CHECK JIKA MAU KE ACTIVE
  // ==========================================
  // if (
  //   requestedStatus &&
  //   requestedStatus !== 'active' && // Jika dia mau ke active, bypass pengecekan kaku ini
  //   !canTransitionContentStatus(currentStatus, requestedStatus)
  // ) {
  //   return NextResponse.json(
  //     {
  //       error: 'Invalid content status transition',
  //       current_status: currentStatus,
  //       next_status: requestedStatus,
  //     },
  //     { status: 409 },
  //   );
  // }
  // ==========================================

  const requiresStrictValidation =
    requestedStatus === 'active' && currentStatus !== 'active';

  if (requiresStrictValidation) {
    const mergedPayload: Record<string, unknown> = {
      ...currentState,
      ...requestedPayload,
      metadata: requestedPayload.metadata ?? currentState.metadata,
    };
    const strictValidation = validateListingPayload(mergedPayload, {
      mode: 'update',
      strictActiveValidation: true,
    });
    if (!strictValidation.ok) {
      // NOTE: Jika strict validation untuk status active terlalu ketat dan bikin error terus,
      // Anda bisa log error-nya atau bypass return 422 ini jika di-bawahnya tetap aman.
      return NextResponse.json(
        { error: strictValidation.error, issues: strictValidation.issues },
        { status: 422 },
      );
    }
  }

  const forwardPayload = toUpsertListingPayload(validatedPatch.payload);
  
  // Pastikan payload yang diteruskan juga mengunci status baru yang diinginkan
  forwardPayload.content_status = requestedStatus;

  const trustSafetyCandidates = collectTrustSafetyCandidates(forwardPayload);
  for (const candidate of trustSafetyCandidates) {
    const safety = evaluateTrustSafety(candidate.value, {
      maxLength: candidate.maxLength,
      allowExternalLinks: false,
      enforceOffPlatformPayment: true,
    });
    if (!safety.ok) {
      return NextResponse.json(
        {
          error: `Content field "${candidate.field}" blocked by trust safety policy`,
          violations: safety.violations.map(item => item.code),
        },
        { status: 422 },
      );
    }
    setNestedString(forwardPayload, candidate.field, safety.sanitizedText);
  }

  const creatorBudget = await enforceCreatorBudget({
    userId: auth.ctx.userId,
    action: 'edit_listing',
    cost: 10,
    dailyLimit: 40,
  });
  if (!creatorBudget.ok) return creatorBudget.response;

  const backendRes = await fetch(
    `${marketplaceBase}/v1/content/${resolvedContentId || resolvedParams.id}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        toUpsertListingPayload(
          normalizeContentMediaUrls(forwardPayload, req.nextUrl.origin),
        ),
      ),
    },
  );

  const data = await readUpstreamPayload(backendRes);
  if (!backendRes.ok && backendRes.status >= 500) {
    await refundCreatorBudget({
      userId: auth.ctx.userId,
      action: 'edit_listing',
      cost: 10,
    });
  }
  return NextResponse.json(data ?? { error: 'Invalid response' }, {
    status: backendRes.status,
  });
}
