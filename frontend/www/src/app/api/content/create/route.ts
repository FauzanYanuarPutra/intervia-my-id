import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/serverAuth';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { evaluateTrustSafety } from '@/lib/trustSafety';
import { parseJsonBody } from '@/lib/serverRequest';
import {
  collectTrustSafetyCandidates,
  toUpsertListingPayload,
  validateListingPayload,
} from '@/lib/content/listingFlowRules';
import { normalizeContentMediaUrl } from '@/lib/content/catalog';
import {
  enforceCreatorBudget,
  refundCreatorBudget,
} from '@/lib/server/creatorBudget';
import { listUmkmStoresForActor } from '@/lib/super-app/umkm-commerce';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';
const MAX_LINKED_UMKM_STORES = 12;

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
  for (const key of ['image_urls', 'gallery_images']) {
    if (Array.isArray(normalized[key])) {
      normalized[key] = normalized[key].map(entry =>
        normalizeMediaPayloadValue(entry, origin),
      );
    }
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

function readStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    items.push(trimmed);
    if (items.length >= limit) break;
  }
  return items;
}

function readRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is Record<string, unknown> =>
      Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry),
  );
}

function readStockQty(value: unknown): number | null {
  const number =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.replace(/[^\d]/g, ''))
        : Number.NaN;
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.min(999_999, Math.round(number));
}

function readAvailability(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (
    normalized === 'available' ||
    normalized === 'limited' ||
    normalized === 'out_of_stock' ||
    normalized === 'preorder'
  ) {
    return normalized;
  }
  return 'available';
}

async function normalizeLinkedUmkmMetadata(
  payload: Record<string, unknown>,
  actorUserId: string,
  actorEmail?: string,
): Promise<Record<string, unknown>> {
  const metadata =
    payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
      ? { ...(payload.metadata as Record<string, unknown>) }
      : null;
  if (!metadata) return payload;

  const requestedIds = readStringArray(
    metadata.linked_umkm_store_ids,
    MAX_LINKED_UMKM_STORES,
  );
  if (requestedIds.length === 0) {
    return {
      ...payload,
      metadata: {
        ...metadata,
        linked_umkm_store_ids: undefined,
        linked_umkm_stores: undefined,
        primary_umkm_store_id: undefined,
        umkm_store_inventory: undefined,
        has_branch_specific_inventory: undefined,
      },
    };
  }

  const ownedStores = await listUmkmStoresForActor({
    actorUserId,
    actorEmail,
    limit: 500,
  });
  const ownedById = new Map(ownedStores.map(store => [store.id, store]));
  const allowedIds = requestedIds.filter(id => ownedById.has(id));
  const rawInventory = readRecordArray(metadata.umkm_store_inventory);
  const inventoryByStoreId = new Map(
    rawInventory
      .map(item => {
        const id = typeof item.store_id === 'string' ? item.store_id.trim() : '';
        return id ? ([id, item] as const) : null;
      })
      .filter((item): item is readonly [string, Record<string, unknown>] => Boolean(item)),
  );

  const linkedStores = allowedIds.map(id => {
    const store = ownedById.get(id);
    return {
      id,
      name: store?.name,
      slug: store?.slug,
      city: store?.city,
      address: store?.address,
      latitude: store?.lat,
      longitude: store?.lng,
      phone: store?.phone,
      is_active: store?.is_active,
      online_order_enabled: store?.online_order_enabled,
      offline_order_enabled: store?.offline_order_enabled,
    };
  });
  const inventory = allowedIds.map(id => {
    const store = ownedById.get(id);
    const source = inventoryByStoreId.get(id) || {};
    return {
      store_id: id,
      store_name: store?.name,
      city: store?.city,
      address: store?.address,
      latitude: store?.lat,
      longitude: store?.lng,
      availability_status: readAvailability(source.availability_status),
      stock_qty:
        readAvailability(source.availability_status) === 'out_of_stock'
          ? 0
          : readStockQty(source.stock_qty),
    };
  });

  return {
    ...payload,
    metadata: {
      ...metadata,
      linked_umkm_store_ids: allowedIds,
      primary_umkm_store_id: allowedIds[0],
      linked_umkm_stores: linkedStores,
      umkm_store_inventory: inventory,
      inventory_policy:
        allowedIds.length > 1
          ? 'branch_specific'
          : allowedIds.length === 1
            ? 'single_store'
            : 'global_listing',
      has_branch_specific_inventory: allowedIds.length > 1,
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const ip = getClientIp(req);
    const ipRateLimit = await enforceRateLimit({
      key: `content:create:ip:${ip}`,
      limit: 80,
      windowSeconds: 3600,
    });
    if (!ipRateLimit.ok) return ipRateLimit.response;

    const userRateLimit = await enforceRateLimit({
      key: `content:create:user:${auth.ctx.userId}`,
      limit: 40,
      windowSeconds: 3600,
    });
    if (!userRateLimit.ok) return userRateLimit.response;

    const parsedBody = await parseJsonBody(req);
    if (!parsedBody.ok) return parsedBody.response;

    const validated = validateListingPayload(parsedBody.data, {
      mode: 'create',
    });
    if (!validated.ok) {
      return NextResponse.json(
        { error: validated.error, issues: validated.issues },
        { status: 422 },
      );
    }

    const forwardPayload = await normalizeLinkedUmkmMetadata(
      toUpsertListingPayload(validated.payload),
      auth.ctx.userId,
      auth.ctx.email,
    );
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
      action: 'create_listing',
      cost: 10,
      dailyLimit: 10,
    });
    if (!creatorBudget.ok) return creatorBudget.response;

    const res = await fetch(`${MARKETPLACE_URL}/v1/content`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.ctx.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        toUpsertListingPayload(
          normalizeContentMediaUrls(forwardPayload, req.nextUrl.origin),
        ),
      ),
    });

    const data = await readUpstreamPayload(res);
    if (!res.ok) {
      console.error('[CREATE_CONTENT_ERROR]', res.status, data);
      if (res.status >= 500) {
        await refundCreatorBudget({
          userId: auth.ctx.userId,
          action: 'create_listing',
          cost: 10,
        });
      }
    }
    return NextResponse.json(data ?? { error: 'Invalid response' }, {
      status: res.status,
    });
  } catch (error) {
    console.error('[CREATE_CONTENT_ERROR]', error);
    const message =
      error instanceof Error && 'cause' in error
        ? String((error as Error & { cause?: unknown }).cause)
        : null;
    return NextResponse.json(
      {
        error: 'Internal server error',
        ...(message && { details: message }),
      },
      { status: 500 },
    );
  }
}
