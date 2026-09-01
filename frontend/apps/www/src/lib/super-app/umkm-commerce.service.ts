import crypto from 'node:crypto';
import { buildUmkmStorefrontPath } from '@/lib/umkmSurface';
import {
  getUsahaPortalUmkmStoreById,
  isUsahaPortalStore,
} from '@/lib/server/usahaPortalSync';
import {
  DEFAULT_ONLINE_SERVICE_FEE_CENTS,
  DEFAULT_TAX_BPS,
} from './umkm-commerce.constants';
import {
  normalizeUmkmProductMetadata,
  buildUmkmOrderComposition,
} from './umkm-fulfillment';
import {
  findActiveQrTokenRecord,
  findOpenOrderRecordForTable,
  findOrderRecordById,
  findReservationRecordById,
  findResolvableQrTokenRecord,
  findStoreMemberRecordById,
  findStoreMemberRecordByActor,
  findStoreRecordById,
  findTableRecordById,
  findTableRecordByStoreAndCode,
  hasOpenOrderForTable,
  hasProductSlug,
  hasStoreSlug,
  insertOrderItemRecords,
  insertOrderRecord,
  insertProductRecord,
  insertQrTokenRecord,
  insertReservationRecord,
  insertStoreMemberRecord,
  insertStoreRecord,
  insertTableRecord,
  listReservationRecordsByStore,
  listOrderItemRecordsByOrderId,
  listOrderRecordsByStore,
  listProductRecords,
  listQrTokenRecords,
  listStoreMemberRecords,
  listStoreMemberRecordsByActor,
  listStoreRecords,
  listTableRecords,
  resetUmkmCommerceRepository,
} from './umkm-commerce.repository';
import type {
  CheckoutUmkmOrderInput,
  ConfirmUmkmOrderBillInput,
  CreateUmkmStoreMemberInput,
  CreateUmkmOrderInput,
  CreateUmkmProductInput,
  CreateUmkmReservationInput,
  CreateUmkmStoreInput,
  EnsureUmkmQrTokenInput,
  ListUmkmStoreMembersOptions,
  ListUmkmReservationsOptions,
  ListUmkmOrdersOptions,
  ListUmkmProductsOptions,
  ListUmkmStoresOptions,
  MoveUmkmOrderTableInput,
  ResolveUmkmQrTokenResult,
  UmkmOrder,
  UmkmOrderBundle,
  UmkmOrderItem,
  UmkmOrderMutation,
  UmkmPaymentMethod,
  UmkmPaymentStatus,
  UmkmPaymentStage,
  UmkmPaymentTiming,
  UmkmPublishService,
  UmkmProduct,
  UmkmQrToken,
  UmkmReservation,
  UmkmReservationStatus,
  UmkmStoreMember,
  UmkmStoreMemberRole,
  UmkmStore,
  UmkmTable,
  UpsertUmkmTablesInput,
  UpdateUmkmOrderStatusInput,
  UpdateUmkmReservationStatusInput,
  UpdateUmkmStoreMemberInput,
} from './umkm-commerce.types';
import {
  cloneOrder,
  cloneOrderItem,
  cloneProduct,
  cloneQrToken,
  cloneReservation,
  cloneStoreMember,
  cloneStore,
  cloneTable,
  normInt,
  normJson,
  normMoney,
  normText,
  nowIso,
  randomToken,
  slugify,
  withTime,
} from './umkm-commerce.utils';
import { getPermissionsForUmkmRole } from './umkm-authorization';
import {
  inferPublishServicesFromUmkmBusiness,
  normalizeUmkmBusinessCategory,
} from './umkm-taxonomy';

const PUBLISH_SERVICES: UmkmPublishService[] = ['food', 'mart'];
const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';

type MarketplaceStoreListResponse = {
  data?: {
    items?: UmkmStore[];
    count?: number;
  };
  error?: string;
};

type MarketplaceStoreResponse = {
  data?: {
    store?: UmkmStore;
  };
  error?: string;
};

type MarketplaceProductListResponse = {
  data?: {
    store?: UmkmStore;
    items?: UmkmProduct[];
    count?: number;
  };
  error?: string;
};

type MarketplaceProductResponse = {
  data?: {
    product?: UmkmProduct;
  };
  error?: string;
};

function cacheRuntimeStore(store: UmkmStore): void {
  const existing = findStoreRecordById(store.id);
  if (existing) {
    Object.assign(existing, cloneStore(store));
    return;
  }
  insertStoreRecord(cloneStore(store));
}

function cacheRuntimeProduct(product: UmkmProduct): void {
  const existing = listProductRecords({
    storeId: product.store_id,
    includeUnavailable: true,
    limit: 5000,
  }).find(item => item.id === product.id);
  if (existing) {
    Object.assign(existing, cloneProduct(product));
    return;
  }
  insertProductRecord(cloneProduct(product));
}

type MarketplaceReadResult<T> =
  | { kind: 'found'; payload: T }
  | { kind: 'not_found' };

async function fetchMarketplaceReadJson<T>(
  path: string,
): Promise<MarketplaceReadResult<T>> {
  let response: Response;
  try {
    response = await fetch(`${MARKETPLACE_URL}${path}`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });
  } catch {
    throw new Error('marketplace_read_unavailable');
  }

  if (!response.ok) {
    if (response.status === 404) return { kind: 'not_found' };
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(payload.error || 'marketplace_read_unavailable');
  }

  const payload = (await response.json().catch(() => undefined)) as
    | T
    | undefined;
  if (payload === undefined) {
    throw new Error('marketplace_invalid_response');
  }
  return { kind: 'found', payload };
}

async function fetchMarketplaceWriteJson<T>(
  path: string,
  init: RequestInit,
): Promise<T | undefined> {
  try {
    const response = await fetch(`${MARKETPLACE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
      cache: 'no-store',
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      data?: T;
    };

    if (!response.ok) {
      throw new Error(payload.error || 'Marketplace request failed');
    }

    return payload.data;
  } catch (error) {
    if (error instanceof Error && error.message !== 'fetch failed') throw error;
    throw new Error('marketplace_persistence_unavailable');
  }
}

async function fetchMarketplaceStoreList(
  options?: ListUmkmStoresOptions,
): Promise<UmkmStore[]> {
  const params = new URLSearchParams();
  if (options?.query?.trim()) params.set('q', options.query.trim());
  if (options?.city?.trim()) params.set('city', options.city.trim());
  if (options?.slug?.trim()) params.set('slug', options.slug.trim());
  if (options?.ownerUserId?.trim()) params.set('owner_user_id', options.ownerUserId.trim());
  if (options?.activeOnly !== undefined) params.set('active_only', String(options.activeOnly));
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.bounds) {
    params.set('min_lat', String(options.bounds.minLat));
    params.set('max_lat', String(options.bounds.maxLat));
    params.set('min_lng', String(options.bounds.minLng));
    params.set('max_lng', String(options.bounds.maxLng));
  }
  if (options?.viewer) {
    params.set('viewer_lat', String(options.viewer.lat));
    params.set('viewer_lng', String(options.viewer.lng));
  }

  const suffix = params.toString() ? `?${params.toString()}` : '';
  const result = await fetchMarketplaceReadJson<MarketplaceStoreListResponse>(
    `/v1/umkm/stores${suffix}`,
  );
  if (result.kind === 'not_found') {
    throw new Error('marketplace_read_unavailable');
  }
  const items = result.payload?.data?.items;
  if (!Array.isArray(items)) {
    throw new Error('marketplace_invalid_response');
  }

  return items.map(cloneStore);
}

async function fetchMarketplaceStoreByRef(
  storeRef: string,
): Promise<UmkmStore | null> {
  const result = await fetchMarketplaceReadJson<MarketplaceStoreResponse>(
    `/v1/umkm/stores/${encodeURIComponent(storeRef)}`,
  );
  if (result.kind === 'not_found') return null;

  const store = result.payload?.data?.store;
  if (!store) {
    throw new Error('marketplace_invalid_response');
  }

  cacheRuntimeStore(store);
  return cloneStore(store);
}

async function fetchMarketplaceProducts(
  options: ListUmkmProductsOptions,
): Promise<UmkmProduct[]> {
  const params = new URLSearchParams();
  if (options.channel) params.set('channel', options.channel);
  if (options.includeUnavailable) params.set('include_unavailable', 'true');
  if (options.limit) params.set('limit', String(options.limit));

  const suffix = params.toString() ? `?${params.toString()}` : '';
  const result = await fetchMarketplaceReadJson<MarketplaceProductListResponse>(
    `/v1/umkm/stores/${encodeURIComponent(options.storeId)}/products${suffix}`,
  );
  if (result.kind === 'not_found') return [];

  const items = result.payload?.data?.items;
  if (!Array.isArray(items)) {
    throw new Error('marketplace_invalid_response');
  }

  items.forEach(cacheRuntimeProduct);
  return items.map(cloneProduct);
}

function normalizePaymentMethod(
  value: unknown,
  fallback: UmkmPaymentMethod,
): UmkmPaymentMethod {
  if (value === 'wallet' || value === 'bank_transfer' || value === 'cash') {
    return value;
  }
  return fallback;
}

function buildPaymentFlow(input: {
  channel: 'online' | 'offline';
  paymentMethod?: UmkmPaymentMethod;
  paymentTiming?: UmkmPaymentTiming;
}): {
  method: UmkmPaymentMethod;
  stage: UmkmPaymentStage;
  prepay_required: boolean;
  confirmation_required: boolean;
  timing: UmkmPaymentTiming;
  bill_sent_at: string;
  confirmed_at: string | null;
  paid_at: string | null;
} {
  const fallback: UmkmPaymentMethod = input.channel === 'offline' ? 'cash' : 'bank_transfer';
  const timing: UmkmPaymentTiming =
    input.channel === 'offline' && input.paymentTiming === 'postpay' ? 'postpay' : 'prepay';
  const normalizedMethod = normalizePaymentMethod(input.paymentMethod, fallback);
  const method: UmkmPaymentMethod = timing === 'postpay' ? 'cash' : normalizedMethod;
  const prepay_required = timing === 'prepay';
  const stage: UmkmPaymentStage = prepay_required
    ? method === 'cash'
      ? 'awaiting_confirmation'
      : 'awaiting_prepayment'
    : 'awaiting_confirmation';
  const now = nowIso();
  return {
    method,
    stage,
    prepay_required,
    confirmation_required: method === 'cash',
    timing,
    bill_sent_at: now,
    confirmed_at: null,
    paid_at: null,
  };
}

function normalizePublishServices(value: unknown): UmkmPublishService[] {
  const tokens = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\s]+/)
      : [];

  return tokens
    .map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : ''))
    .filter((item): item is UmkmPublishService => PUBLISH_SERVICES.includes(item as UmkmPublishService));
}

function inferPublishServicesFromBusinessType(value: string | null): UmkmPublishService[] {
  return inferPublishServicesFromUmkmBusiness(value);
}

function normalizeMemberEmail(value: unknown): string | null {
  const normalized = normText(value)?.toLowerCase() || null;
  return normalized;
}

function buildOrderBundle(order: UmkmOrder, mutation?: UmkmOrderMutation): UmkmOrderBundle {
  return {
    order: cloneOrder(order),
    items: listOrderItemRecordsByOrderId(order.id).map(cloneOrderItem),
    mutation,
  };
}

function computeOrderTax(subtotal: number, discount: number, taxBps: number): number {
  return Math.round((Math.max(0, subtotal - discount) * taxBps) / 10_000);
}

function recomputeOrderTotals(order: UmkmOrder, store: UmkmStore): void {
  const taxBps = normInt(store.metadata.tax_bps || DEFAULT_TAX_BPS, 0, 3000);
  order.tax_cents = computeOrderTax(order.subtotal_cents, order.discount_cents, taxBps);
  order.total_cents = Math.max(
    0,
    order.subtotal_cents -
      order.discount_cents +
      order.service_fee_cents +
      order.shipping_fee_cents +
      order.tax_cents,
  );
}

async function releaseTable(tableId: string): Promise<void> {
  if (hasOpenOrderForTable(tableId)) return;

  const table = findTableRecordById(tableId);
  if (table && table.status !== 'disabled') {
    table.status = 'available';
    table.updated_at = nowIso();
  }
}

function reservationBlocksSlot(status: UmkmReservationStatus): boolean {
  return status === 'pending' || status === 'confirmed' || status === 'seated';
}

function parseReservationDateTime(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Reservation time is invalid');
  }
  return parsed;
}

function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA.getTime() < endB.getTime() && startB.getTime() < endA.getTime();
}

function findReservationConflict(input: {
  storeId: string;
  tableId: string;
  reservedFor: Date;
  durationMinutes: number;
  excludeReservationId?: string;
}): UmkmReservation | undefined {
  const reservationEnd = new Date(input.reservedFor.getTime() + input.durationMinutes * 60_000);
  return listReservationRecordsByStore({
    storeId: input.storeId,
    limit: 500,
  }).find((reservation) => {
    if (reservation.id === input.excludeReservationId) return false;
    if (reservation.table_id !== input.tableId) return false;
    if (!reservationBlocksSlot(reservation.status)) return false;

    const currentStart = parseReservationDateTime(reservation.reserved_for);
    const currentEnd = new Date(currentStart.getTime() + reservation.duration_minutes * 60_000);
    return rangesOverlap(input.reservedFor, reservationEnd, currentStart, currentEnd);
  });
}

export function __resetUmkmCommerceRuntime(): void {
  resetUmkmCommerceRepository();
}

export async function listUmkmStores(options?: ListUmkmStoresOptions): Promise<UmkmStore[]> {
  return fetchMarketplaceStoreList(options);
}

export async function listUmkmStoresForActor(input: {
  actorUserId: string;
  actorEmail?: string | null;
  query?: string;
  city?: string;
  slug?: string;
  limit?: number;
}): Promise<Array<UmkmStore & { access_role: UmkmStoreMemberRole; access_via: 'owner' | 'member' | 'admin' }>> {
  const normalizedEmail = normalizeMemberEmail(input.actorEmail);
  const ownedStores = listStoreRecords({
    query: input.query,
    city: input.city,
    slug: input.slug,
    ownerUserId: input.actorUserId,
    activeOnly: false,
    limit: input.limit || 100,
  });

  const membershipMap = new Map(
    listStoreMemberRecordsByActor({
      userId: input.actorUserId,
      email: normalizedEmail,
    }).map((member) => [member.store_id, member]),
  );

  const memberStores = listStoreRecords({
    query: input.query,
    city: input.city,
    slug: input.slug,
    activeOnly: false,
    limit: Math.max((input.limit || 100) * 2, 100),
  }).filter(
    (store) => store.owner_user_id !== input.actorUserId && membershipMap.has(store.id),
  );

  const combined = [...ownedStores, ...memberStores].reduce<
    Array<UmkmStore & { access_role: UmkmStoreMemberRole; access_via: 'owner' | 'member' | 'admin' }>
  >((acc, store) => {
    if (acc.some((item) => item.id === store.id)) return acc;
    if (store.owner_user_id === input.actorUserId) {
      acc.push({ ...cloneStore(store), access_role: 'owner', access_via: 'owner' });
      return acc;
    }

    const member = membershipMap.get(store.id);
    if (member) {
      acc.push({ ...cloneStore(store), access_role: member.role, access_via: 'member' });
    }
    return acc;
  }, []);

  return combined
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
    .slice(0, normInt(input.limit ?? 80, 1, 500));
}

export async function getUmkmStoreById(storeId: string): Promise<UmkmStore | null> {
  return fetchMarketplaceStoreByRef(storeId);
}

export async function getUmkmStoreBySlug(slug: string): Promise<UmkmStore | null> {
  return fetchMarketplaceStoreByRef(slug);
}

export async function createUmkmStore(input: CreateUmkmStoreInput): Promise<UmkmStore> {
  const backendStore = await fetchMarketplaceWriteJson<{ store?: UmkmStore }>(
    '/v1/umkm/stores',
    {
      method: 'POST',
      body: JSON.stringify({
        owner_user_id: input.ownerUserId,
        name: input.name,
        slug: input.slug,
        description: input.description,
        city: input.city,
        address: input.address,
        lat: input.lat,
        lng: input.lng,
        phone: input.phone,
        online_order_enabled: input.onlineOrderEnabled,
        offline_order_enabled: input.offlineOrderEnabled,
        metadata: input.metadata,
      }),
    },
  );
  if (backendStore?.store) {
    cacheRuntimeStore(backendStore.store);
    return cloneStore(backendStore.store);
  }

  const name = normText(input.name);
  if (!name) throw new Error('Store name is required');

  const address = normText(input.address);
  if (!address) throw new Error('Store address is required');

  const city = normText(input.city) || 'Jakarta';
  const baseSlug = slugify(input.slug || name) || `umkm-${randomToken(4).toLowerCase()}`;
  let slug = baseSlug;
  let attempt = 2;

  while (hasStoreSlug(slug)) {
    slug = `${baseSlug}-${attempt}`;
    attempt += 1;
  }

  const timestamp = nowIso();
  const store: UmkmStore = {
    id: crypto.randomUUID(),
    owner_user_id: input.ownerUserId,
    name,
    slug,
    description: normText(input.description),
    city,
    address,
    lat: Number(input.lat),
    lng: Number(input.lng),
    phone: normText(input.phone),
    is_active: true,
    online_order_enabled: input.onlineOrderEnabled !== false,
    offline_order_enabled: input.offlineOrderEnabled !== false,
    metadata: { recommended_qr: 'online', tax_bps: DEFAULT_TAX_BPS, ...normJson(input.metadata) },
    created_at: timestamp,
    updated_at: timestamp,
  };

  const onlineQr = withTime({
    id: crypto.randomUUID(),
    store_id: store.id,
    table_id: null,
    mode: 'online' as const,
    token: `UMKM-ONLINE-${slug.toUpperCase().replace(/-/g, '')}-${randomToken(6)}`,
    is_active: true,
    metadata: { label: 'Online Storefront QR' },
    expires_at: null,
    table_code: null,
  }) as UmkmQrToken;

  insertStoreRecord(store);
  insertQrTokenRecord(onlineQr);
  insertStoreMemberRecord(
    withTime({
      id: crypto.randomUUID(),
      store_id: store.id,
      user_id: input.ownerUserId,
      email: normalizeMemberEmail((input.metadata || {}).owner_email),
      name: `${store.name} Owner`,
      role: 'owner',
      status: 'active',
      permissions: getPermissionsForUmkmRole('owner'),
      notes: 'Auto-created owner access',
      metadata: { source: 'store-create' },
    }) as UmkmStoreMember,
  );
  return cloneStore(store);
}

export async function listUmkmProducts(options: ListUmkmProductsOptions): Promise<UmkmProduct[]> {
  return fetchMarketplaceProducts(options);
}

export async function listUmkmStoreMembers(
  options: ListUmkmStoreMembersOptions,
): Promise<UmkmStoreMember[]> {
  return listStoreMemberRecords(options).map(cloneStoreMember);
}

export async function getUmkmStoreMemberById(memberId: string): Promise<UmkmStoreMember | null> {
  const member = findStoreMemberRecordById(memberId);
  return member ? cloneStoreMember(member) : null;
}

export async function createUmkmStoreMember(
  input: CreateUmkmStoreMemberInput,
): Promise<UmkmStoreMember> {
  const store = findStoreRecordById(input.storeId);
  if (!store) throw new Error('Store not found');

  const name = normText(input.name);
  if (!name) throw new Error('Member name is required');

  const role = (input.role || 'ops') as UmkmStoreMemberRole;
  const email = normalizeMemberEmail(input.email);
  const userId = normText(input.userId);

  if (!email && !userId) {
    throw new Error('Member email or user_id is required');
  }

  const existing = findStoreMemberRecordByActor({
    storeId: input.storeId,
    userId,
    email,
  });

  if (existing) {
    existing.name = name;
    existing.role = role;
    existing.status = input.status || 'active';
    existing.permissions = getPermissionsForUmkmRole(role);
    existing.email = email;
    existing.user_id = userId;
    existing.notes = normText(input.notes);
    existing.metadata = { ...normJson(existing.metadata), ...normJson(input.metadata) };
    existing.updated_at = nowIso();
    return cloneStoreMember(existing);
  }

  const member = withTime({
    id: crypto.randomUUID(),
    store_id: input.storeId,
    user_id: userId,
    email,
    name,
    role,
    status: input.status || 'active',
    permissions: getPermissionsForUmkmRole(role),
    notes: normText(input.notes),
    metadata: normJson(input.metadata),
  }) as UmkmStoreMember;

  insertStoreMemberRecord(member);
  return cloneStoreMember(member);
}

export async function updateUmkmStoreMember(
  input: UpdateUmkmStoreMemberInput,
): Promise<UmkmStoreMember> {
  const member = findStoreMemberRecordById(input.memberId);
  if (!member) throw new Error('Store member not found');

  if (member.role === 'owner' && input.status === 'disabled') {
    throw new Error('Owner access cannot be disabled');
  }

  if (input.userId !== undefined) member.user_id = normText(input.userId);
  if (input.email !== undefined) member.email = normalizeMemberEmail(input.email);
  if (input.name !== undefined) {
    const normalizedName = normText(input.name);
    if (!normalizedName) throw new Error('Member name is required');
    member.name = normalizedName;
  }
  if (input.role) {
    member.role = input.role;
    member.permissions = getPermissionsForUmkmRole(input.role);
  }
  if (input.status) {
    member.status = input.status;
  }
  if (input.notes !== undefined) {
    member.notes = normText(input.notes);
  }
  if (input.metadataPatch) {
    member.metadata = { ...normJson(member.metadata), ...normJson(input.metadataPatch) };
  }
  member.updated_at = nowIso();
  return cloneStoreMember(member);
}

export async function createUmkmProduct(input: CreateUmkmProductInput): Promise<UmkmProduct> {
  const backendProduct = await fetchMarketplaceWriteJson<{ product?: UmkmProduct }>(
    `/v1/umkm/stores/${encodeURIComponent(input.storeId)}/products`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        slug: input.slug,
        description: input.description,
        category: input.category,
        price_cents: input.priceCents,
        stock_qty: input.stockQty,
        is_available: input.isAvailable,
        image_url: input.imageUrl,
        metadata: input.metadata,
      }),
    },
  );
  if (backendProduct?.product) {
    cacheRuntimeProduct(backendProduct.product);
    return cloneProduct(backendProduct.product);
  }

  const name = normText(input.name);
  if (!name) throw new Error('Product name is required');

  const price = normMoney(input.priceCents);
  if (price <= 0) throw new Error('Product price must be greater than 0');

  const baseSlug = slugify(input.slug || name) || `item-${randomToken(4).toLowerCase()}`;
  let slug = baseSlug;
  let attempt = 2;

  while (hasProductSlug(input.storeId, slug)) {
    slug = `${baseSlug}-${attempt}`;
    attempt += 1;
  }

  const product = withTime({
    id: crypto.randomUUID(),
    store_id: input.storeId,
    name,
    slug,
    description: normText(input.description),
    category: normText(input.category) || 'general_merchandise',
    price_cents: price,
    stock_qty: normInt(input.stockQty ?? 0, 0, 1_000_000),
    is_available: input.isAvailable !== false,
    image_url: normText(input.imageUrl),
    metadata: normalizeUmkmProductMetadata({
      channel: ['online', 'offline'],
      ...normJson(input.metadata),
    }),
  }) as UmkmProduct;

  insertProductRecord(product);
  return cloneProduct(product);
}

export async function listUmkmTables(storeId: string): Promise<UmkmTable[]> {
  const items = listTableRecords(storeId).map(cloneTable);
  if (items.length > 0) {
    return items;
  }

  const portalStore = await getUsahaPortalUmkmStoreById(storeId);
  if (isUsahaPortalStore(portalStore)) {
    return [];
  }

  return items;
}

export async function upsertUmkmTables(input: UpsertUmkmTablesInput): Promise<UmkmTable[]> {
  const timestamp = nowIso();

  for (const row of input.tables || []) {
    const tableCode = normText(row.table_code)?.toUpperCase();
    if (!tableCode) continue;

    const existing = findTableRecordByStoreAndCode(input.storeId, tableCode);
    if (existing) {
      existing.capacity = normInt(row.capacity ?? existing.capacity, 1, 40);
      existing.status = row.status || existing.status;
      existing.metadata = { ...normJson(existing.metadata), ...normJson(row.metadata) };
      existing.updated_at = timestamp;
      continue;
    }

    insertTableRecord({
      id: crypto.randomUUID(),
      store_id: input.storeId,
      table_code: tableCode,
      capacity: normInt(row.capacity ?? 2, 1, 40),
      status: row.status || 'available',
      metadata: normJson(row.metadata),
      created_at: timestamp,
      updated_at: timestamp,
    });
  }

  return listUmkmTables(input.storeId);
}

export async function listUmkmQrTokens(storeId: string): Promise<UmkmQrToken[]> {
  return listQrTokenRecords(storeId).map(cloneQrToken);
}

export async function ensureUmkmQrToken(input: EnsureUmkmQrTokenInput): Promise<UmkmQrToken> {
  const table =
    input.mode === 'offline'
      ? findTableRecordById(input.tableId || '')
      : undefined;

  if (input.mode === 'offline') {
    if (!table || table.store_id !== input.storeId) {
      throw new Error('table_id is required for offline QR');
    }
  }

  const existing = findActiveQrTokenRecord({
    storeId: input.storeId,
    mode: input.mode,
    tableId: input.mode === 'offline' ? table?.id : null,
  });
  if (existing && !input.forceNew) return cloneQrToken(existing);

  const store = findStoreRecordById(input.storeId);
  if (!store) throw new Error('Store not found');

  const token =
    input.mode === 'offline'
      ? `UMKM-OFFLINE-${slugify(store.name).toUpperCase().replace(/-/g, '')}-${table!.table_code}-${randomToken(4)}`
      : `UMKM-ONLINE-${slugify(store.name).toUpperCase().replace(/-/g, '')}-${randomToken(4)}`;

  const qrToken = withTime({
    id: crypto.randomUUID(),
    store_id: input.storeId,
    table_id: input.mode === 'offline' ? table!.id : null,
    mode: input.mode,
    token,
    is_active: true,
    metadata: {
      label: input.mode === 'offline' ? `Table QR ${table!.table_code}` : 'Online Storefront QR',
    },
    expires_at: null,
    table_code: input.mode === 'offline' ? table!.table_code : null,
  }) as UmkmQrToken;

  insertQrTokenRecord(qrToken);
  return cloneQrToken(qrToken);
}

export async function resolveUmkmQrToken(token: string): Promise<ResolveUmkmQrTokenResult | null> {
  const qrToken = findResolvableQrTokenRecord(token);
  if (!qrToken) return null;

  const store = findStoreRecordById(qrToken.store_id);
  if (!store) return null;

  const table = qrToken.table_id ? findTableRecordById(qrToken.table_id) || null : null;
  const storefrontPath = buildUmkmStorefrontPath(store.slug);
  const redirectPath =
    qrToken.mode === 'offline' && table
      ? `${storefrontPath}?mode=offline&table_id=${table.id}&table_code=${encodeURIComponent(table.table_code)}&scan=1`
      : `${storefrontPath}?mode=online`;

  return {
    token: cloneQrToken(qrToken),
    store: cloneStore(store),
    table: table ? cloneTable(table) : null,
    redirect_path: redirectPath,
  };
}

export async function getUmkmReservationById(reservationId: string): Promise<UmkmReservation | null> {
  const reservation = findReservationRecordById(reservationId);
  return reservation ? cloneReservation(reservation) : null;
}

export async function listUmkmReservationsByStore(
  input: ListUmkmReservationsOptions,
): Promise<UmkmReservation[]> {
  return listReservationRecordsByStore(input).map(cloneReservation);
}

export async function createUmkmReservation(
  input: CreateUmkmReservationInput,
): Promise<UmkmReservation> {
  const store = findStoreRecordById(input.storeId);
  if (!store || !store.is_active) throw new Error('Store not found or inactive');
  if (!store.offline_order_enabled) {
    throw new Error('Table reservation is disabled for this store');
  }

  const customerName = normText(input.customerName);
  if (!customerName || customerName.length < 2) {
    throw new Error('Customer name is required');
  }
  const customerPhone = normText(input.customerPhone);
  if (!customerPhone || customerPhone.length < 6) {
    throw new Error('Customer phone is required');
  }

  const guestCount = normInt(input.guestCount, 1, 40);
  const durationMinutes = normInt(input.durationMinutes ?? 90, 30, 240);
  const reservedFor = parseReservationDateTime(input.reservedFor);
  if (reservedFor.getTime() < Date.now() - 5 * 60_000) {
    throw new Error('Reservation time must be now or later');
  }

  const tables = listTableRecords(store.id)
    .filter((table) => table.status !== 'disabled')
    .sort((left, right) =>
      left.capacity === right.capacity
        ? left.table_code.localeCompare(right.table_code)
        : left.capacity - right.capacity,
    );

  const explicitTable =
    (input.tableId
      ? findTableRecordById(input.tableId)
      : input.tableCode
        ? findTableRecordByStoreAndCode(store.id, input.tableCode)
        : undefined) || null;

  if (explicitTable && explicitTable.store_id !== store.id) {
    throw new Error('Selected table does not belong to this store');
  }
  if (explicitTable && explicitTable.status === 'disabled') {
    throw new Error('Selected table is disabled');
  }
  if (explicitTable && explicitTable.capacity < guestCount) {
    throw new Error(`Table ${explicitTable.table_code} only fits ${explicitTable.capacity} guests`);
  }

  const candidateTables = explicitTable
    ? [explicitTable]
    : tables.filter((table) => table.capacity >= guestCount);

  if (candidateTables.length === 0) {
    throw new Error('No table matches the requested guest count');
  }

  const selectedTable =
    candidateTables.find(
      (table) =>
        !findReservationConflict({
          storeId: store.id,
          tableId: table.id,
          reservedFor,
          durationMinutes,
        }),
    ) || null;

  if (!selectedTable) {
    throw new Error('No table is available for the requested reservation slot');
  }

  const timestamp = nowIso();
  const reservation: UmkmReservation = {
    id: crypto.randomUUID(),
    reservation_code: `RSV-${selectedTable.table_code}-${randomToken(4)}`,
    store_id: store.id,
    table_id: selectedTable.id,
    table_code: selectedTable.table_code,
    status: 'pending',
    customer_name: customerName,
    customer_phone: customerPhone,
    guest_count: guestCount,
    reserved_for: reservedFor.toISOString(),
    duration_minutes: durationMinutes,
    notes: normText(input.notes),
    metadata: {
      ...normJson(input.metadata),
      assigned_capacity: selectedTable.capacity,
    },
    created_at: timestamp,
    updated_at: timestamp,
  };

  insertReservationRecord(reservation);
  return cloneReservation(reservation);
}

export async function createUmkmOrder(input: CreateUmkmOrderInput): Promise<UmkmOrderBundle> {
  const store = findStoreRecordById(input.storeId);
  if (!store || !store.is_active) throw new Error('Store not found or inactive');

  if (input.channel === 'online' && !store.online_order_enabled) {
    throw new Error('Online order is disabled');
  }
  if (input.channel === 'offline' && !store.offline_order_enabled) {
    throw new Error('Offline order is disabled');
  }

  const products = listProductRecords({
    storeId: store.id,
    channel: input.channel,
    includeUnavailable: false,
    limit: 500,
  });
  const productMap = new Map(products.map((product) => [product.id, product]));
  const orderItems: UmkmOrderItem[] = [];
  const selectedProducts = [] as Array<{
    id: string;
    name: string;
    price_cents: number;
    metadata: Record<string, unknown>;
    quantity: number;
  }>;
  let subtotalCents = 0;

  for (const item of input.items || []) {
    const product = productMap.get(item.product_id);
    if (!product) throw new Error(`Product unavailable: ${item.product_id}`);

    const quantity = normInt(item.quantity, 1, 200);
    if (product.stock_qty > 0 && quantity > product.stock_qty) {
      throw new Error(`Stock not enough for ${product.name}`);
    }

    const lineTotalCents = product.price_cents * quantity;
    subtotalCents += lineTotalCents;
    selectedProducts.push({
      id: product.id,
      name: product.name,
      price_cents: product.price_cents,
      metadata: normJson(product.metadata),
      quantity,
    });
    orderItems.push({
      id: crypto.randomUUID(),
      order_id: '',
      product_id: product.id,
      product_name: product.name,
      quantity,
      unit_price_cents: product.price_cents,
      line_total_cents: lineTotalCents,
      notes: normText(item.notes),
      metadata: {},
      created_at: nowIso(),
    });
  }

  if (orderItems.length === 0) throw new Error('Order must include items');

  const composition = buildUmkmOrderComposition(selectedProducts);
  const requestedFulfillmentMode =
    input.channel === 'offline'
      ? 'dine_in'
      : input.fulfillmentMode || composition.default_mode;
  const fulfillmentMode =
    input.channel === 'offline'
      ? 'dine_in'
      : requestedFulfillmentMode === 'digital' ||
          requestedFulfillmentMode === 'pickup' ||
          requestedFulfillmentMode === 'courier'
        ? requestedFulfillmentMode
        : composition.default_mode;

  if (input.channel === 'online') {
    if (composition.available_modes.length === 0) {
      throw new Error('Selected items do not have a valid fulfillment mode');
    }
    if (
      fulfillmentMode !== 'digital' &&
      fulfillmentMode !== 'pickup' &&
      fulfillmentMode !== 'courier'
    ) {
      throw new Error('Invalid fulfillment mode');
    }
    if (!composition.available_modes.includes(fulfillmentMode)) {
      throw new Error(`Selected items do not support fulfillment mode: ${fulfillmentMode}`);
    }
  }

  const table =
    input.channel === 'offline'
      ? (input.tableId
          ? findTableRecordById(input.tableId)
          : input.tableCode
            ? findTableRecordByStoreAndCode(input.storeId, input.tableCode)
            : undefined) || null
      : null;

  const shouldMergeIntoOpenOfflineOrder =
    input.channel === 'offline' && input.mergeIntoOpenOfflineOrder !== false;
  const existingOpenTableOrder =
    table && shouldMergeIntoOpenOfflineOrder ? findOpenOrderRecordForTable(table.id) : undefined;

  if (input.channel === 'offline') {
    if (!table || table.store_id !== store.id) throw new Error('Offline order requires valid table');
    if (table.status === 'disabled') throw new Error('Table is disabled');
    if (!existingOpenTableOrder && hasOpenOrderForTable(table.id)) {
      throw new Error(`Table ${table.table_code} is occupied`);
    }
  }

  const discountCents = 0;
  const serviceFeeCents =
    input.channel === 'online'
      ? normMoney(store.metadata.online_service_fee_cents || DEFAULT_ONLINE_SERVICE_FEE_CENTS)
      : 0;
  const shippingFeeCents =
    input.channel === 'online' && fulfillmentMode === 'courier'
      ? normMoney(input.shippingFeeCents)
      : 0;
  const taxBps = normInt(store.metadata.tax_bps || DEFAULT_TAX_BPS, 0, 3000);
  const taxCents = computeOrderTax(subtotalCents, discountCents, taxBps);
  const totalCents = Math.max(
    0,
    subtotalCents - discountCents + serviceFeeCents + shippingFeeCents + taxCents,
  );
  const timestamp = nowIso();
  const paymentFlow = buildPaymentFlow({
    channel: input.channel,
    paymentMethod: input.paymentMethod,
    paymentTiming: input.paymentTiming,
  });

  if (existingOpenTableOrder) {
    if (!existingOpenTableOrder.payment_method || !existingOpenTableOrder.payment_stage) {
      existingOpenTableOrder.payment_method = paymentFlow.method;
      existingOpenTableOrder.payment_stage = paymentFlow.stage;
      existingOpenTableOrder.metadata = {
        ...normJson(existingOpenTableOrder.metadata),
        payment_flow: paymentFlow,
      };
    }
    orderItems.forEach((item) => {
      item.order_id = existingOpenTableOrder.id;
      item.metadata = {
        ...normJson(item.metadata),
        appended_to_existing_order: true,
      };
    });
    insertOrderItemRecords(orderItems);

    existingOpenTableOrder.subtotal_cents += subtotalCents;
    existingOpenTableOrder.discount_cents += discountCents;
    existingOpenTableOrder.shipping_fee_cents =
      normMoney(existingOpenTableOrder.shipping_fee_cents) + shippingFeeCents;
    existingOpenTableOrder.customer_name =
      existingOpenTableOrder.customer_name || normText(input.customerName);
    existingOpenTableOrder.customer_phone =
      existingOpenTableOrder.customer_phone || normText(input.customerPhone);
    existingOpenTableOrder.notes = existingOpenTableOrder.notes || normText(input.notes);
    existingOpenTableOrder.updated_at = timestamp;
    existingOpenTableOrder.metadata = {
      ...normJson(existingOpenTableOrder.metadata),
      ...normJson(input.metadata),
      fulfillment_mode: existingOpenTableOrder.fulfillment_mode,
      append_events: [
        ...(Array.isArray(existingOpenTableOrder.metadata.append_events)
          ? (existingOpenTableOrder.metadata.append_events as unknown[])
          : []),
        {
          appended_at: timestamp,
          item_count: orderItems.length,
          subtotal_cents: subtotalCents,
          customer_name: normText(input.customerName),
          notes: normText(input.notes),
        },
      ],
    };
    recomputeOrderTotals(existingOpenTableOrder, store);

    if (table) {
      table.status = 'occupied';
      table.updated_at = timestamp;
    }

    return buildOrderBundle(existingOpenTableOrder, 'merged');
  }

  const orderId = crypto.randomUUID();
  const order: UmkmOrder = {
    id: orderId,
    store_id: store.id,
    channel: input.channel,
    table_id: table?.id || null,
    table_code: table?.table_code || null,
    status: 'pending',
    payment_status: 'unpaid',
    payment_method: paymentFlow.method,
    payment_stage: paymentFlow.stage,
    fulfillment_mode: fulfillmentMode,
    customer_name: normText(input.customerName),
    customer_phone: normText(input.customerPhone),
    notes: normText(input.notes),
    subtotal_cents: subtotalCents,
    discount_cents: discountCents,
    service_fee_cents: serviceFeeCents,
    shipping_fee_cents: shippingFeeCents,
    tax_cents: taxCents,
    total_cents: totalCents,
    checked_out_at: null,
    metadata: {
      ...normJson(input.metadata),
      fulfillment_mode: fulfillmentMode,
      order_composition: composition,
      payment_flow: paymentFlow,
    },
    created_at: timestamp,
    updated_at: timestamp,
  };

  orderItems.forEach((item) => {
    item.order_id = orderId;
  });

  insertOrderRecord(order);
  insertOrderItemRecords(orderItems);

  if (table) {
    table.status = 'occupied';
    table.updated_at = timestamp;
  }

  return buildOrderBundle(order, 'created');
}

export async function updateUmkmReservationStatus(
  input: UpdateUmkmReservationStatusInput,
): Promise<UmkmReservation> {
  const reservation = findReservationRecordById(input.reservationId);
  if (!reservation) throw new Error('Reservation not found');
  if (reservation.status === 'cancelled' || reservation.status === 'completed') {
    throw new Error('Closed reservation cannot be changed');
  }

  reservation.status = input.status;
  reservation.updated_at = nowIso();
  reservation.metadata = {
    ...normJson(reservation.metadata),
    ...normJson(input.metadataPatch),
  };

  const table = reservation.table_id ? findTableRecordById(reservation.table_id) : null;
  if (table && table.status !== 'disabled') {
    if (input.status === 'seated') {
      table.status = 'occupied';
      table.updated_at = reservation.updated_at;
    }
    if (
      (input.status === 'cancelled' || input.status === 'completed') &&
      !hasOpenOrderForTable(table.id)
    ) {
      table.status = 'available';
      table.updated_at = reservation.updated_at;
    }
  }

  return cloneReservation(reservation);
}

export async function getUmkmOrderById(orderId: string): Promise<UmkmOrderBundle | null> {
  const order = findOrderRecordById(orderId);
  return order ? buildOrderBundle(order) : null;
}

export async function listUmkmOrdersByStore(input: ListUmkmOrdersOptions): Promise<UmkmOrder[]> {
  return listOrderRecordsByStore(input).map(cloneOrder);
}

export async function checkoutUmkmOrder(input: CheckoutUmkmOrderInput): Promise<UmkmOrderBundle> {
  const order = findOrderRecordById(input.orderId);
  if (!order) throw new Error('Order not found');
  if (order.payment_stage === 'awaiting_confirmation') {
    throw new Error('Bill confirmation is required before payment');
  }

  const now = nowIso();
  const paidAt = order.checked_out_at || now;
  const method = input.paymentMethod || order.payment_method || 'cash';
  const currentMeta = normJson(order.metadata);
  const existingFlow =
    typeof currentMeta.payment_flow === 'object' && currentMeta.payment_flow
      ? (currentMeta.payment_flow as Record<string, unknown>)
      : {};

  order.payment_status = 'paid';
  order.payment_method = method;
  order.payment_stage = 'paid';
  order.checked_out_at = paidAt;
  order.updated_at = now;
  order.metadata = {
    ...currentMeta,
    payment: {
      paid_at: paidAt,
      method,
      ...normJson(input.paymentMetadata),
    },
    payment_flow: {
      ...existingFlow,
      method,
      stage: 'paid',
      paid_at: paidAt,
    },
  };

  if (order.status === 'served') {
    order.status = 'paid';
    if (order.table_id) await releaseTable(order.table_id);
  }
  return buildOrderBundle(order, 'updated');
}

export async function updateUmkmOrderPaymentCheckout(input: {
  orderId: string;
  paymentMethod?: UmkmPaymentMethod;
  paymentStatus?: UmkmPaymentStatus;
  paymentStage?: UmkmPaymentStage;
  metadataPatch?: Record<string, unknown>;
}): Promise<UmkmOrderBundle> {
  const order = findOrderRecordById(input.orderId);
  if (!order) throw new Error('Order not found');

  const now = nowIso();
  const currentMeta = normJson(order.metadata);
  const existingFlow =
    typeof currentMeta.payment_flow === 'object' && currentMeta.payment_flow
      ? (currentMeta.payment_flow as Record<string, unknown>)
      : {};

  if (input.paymentMethod) {
    order.payment_method = input.paymentMethod;
  }
  if (input.paymentStatus) {
    order.payment_status = input.paymentStatus;
  }
  if (input.paymentStage) {
    order.payment_stage = input.paymentStage;
  }

  order.updated_at = now;
  order.metadata = {
    ...currentMeta,
    ...normJson(input.metadataPatch),
    payment_flow: {
      ...existingFlow,
      ...(input.paymentMethod ? { method: input.paymentMethod } : {}),
      ...(input.paymentStage ? { stage: input.paymentStage } : {}),
    },
  };

  return buildOrderBundle(order, 'updated');
}

export async function confirmUmkmOrderBill(
  input: ConfirmUmkmOrderBillInput,
): Promise<UmkmOrderBundle> {
  const order = findOrderRecordById(input.orderId);
  if (!order) throw new Error('Order not found');
  if (order.payment_status === 'paid') {
    throw new Error('Paid order cannot be confirmed');
  }
  if (order.payment_stage !== 'awaiting_confirmation') {
    throw new Error('Order does not require bill confirmation');
  }

  const confirmedAt = nowIso();
  const currentMeta = normJson(order.metadata);
  const existingFlow =
    typeof currentMeta.payment_flow === 'object' && currentMeta.payment_flow
      ? (currentMeta.payment_flow as Record<string, unknown>)
      : {};

  order.payment_stage = 'awaiting_prepayment';
  order.updated_at = confirmedAt;
  order.metadata = {
    ...currentMeta,
    ...normJson(input.metadataPatch),
    payment_flow: {
      ...existingFlow,
      stage: 'awaiting_prepayment',
      confirmed_at: confirmedAt,
    },
  };

  return buildOrderBundle(order, 'updated');
}

export async function updateUmkmOrderStatus(
  input: UpdateUmkmOrderStatusInput,
): Promise<UmkmOrderBundle> {
  if (input.status === 'paid') {
    return checkoutUmkmOrder({
      orderId: input.orderId,
      paymentMetadata: input.metadataPatch,
    });
  }

  const order = findOrderRecordById(input.orderId);
  if (!order) throw new Error('Order not found');
  if (order.status === 'paid' || order.status === 'cancelled') {
    throw new Error('Closed order cannot be changed');
  }
  if (input.status === 'preparing' || input.status === 'served') {
    const meta = normJson(order.metadata);
    const flow =
      typeof meta.payment_flow === 'object' && meta.payment_flow
        ? (meta.payment_flow as Record<string, unknown>)
        : {};
    const prepayRequired = flow.prepay_required !== false;
    if (prepayRequired && order.payment_status !== 'paid') {
      throw new Error('Payment must be completed before processing the order');
    }
  }

  order.status = input.status;
  order.updated_at = nowIso();
  order.metadata = {
    ...normJson(order.metadata),
    ...normJson(input.metadataPatch),
  };

  if (input.status === 'cancelled' && order.table_id) {
    await releaseTable(order.table_id);
  }

  return buildOrderBundle(order, 'updated');
}

export async function moveUmkmOrderTable(input: MoveUmkmOrderTableInput): Promise<UmkmOrderBundle> {
  const order = findOrderRecordById(input.orderId);
  if (!order) throw new Error('Order not found');
  if (order.channel !== 'offline') throw new Error('Only offline orders can move table');
  if (order.payment_status === 'paid' || order.status === 'cancelled') {
    throw new Error('Closed order cannot move table');
  }

  const toTable = findTableRecordById(input.toTableId);
  if (!toTable || toTable.store_id !== order.store_id) {
    throw new Error('Target table not found');
  }
  if (toTable.status === 'disabled') throw new Error('Target table is disabled');
  if (order.table_id === toTable.id) return buildOrderBundle(order);
  if (hasOpenOrderForTable(toTable.id, order.id)) {
    throw new Error(`Table ${toTable.table_code} is occupied`);
  }

  const fromTableId = order.table_id;
  order.table_id = toTable.id;
  order.table_code = toTable.table_code;
  order.updated_at = nowIso();

  const moves = Array.isArray(order.metadata.table_moves)
    ? [...(order.metadata.table_moves as unknown[])]
    : [];
  moves.push({
    from_table_id: fromTableId,
    to_table_id: toTable.id,
    moved_at: order.updated_at,
  });
  order.metadata = {
    ...normJson(order.metadata),
    table_moves: moves,
  };

  toTable.status = 'occupied';
  toTable.updated_at = order.updated_at;

  if (fromTableId) await releaseTable(fromTableId);
  return buildOrderBundle(order, 'updated');
}

export function getStoreRecommendedQr(store: UmkmStore): 'online' | 'offline' | null {
  const value = normText(store.metadata.recommended_qr)?.toLowerCase();
  return value === 'online' || value === 'offline' ? value : null;
}

export function getUmkmPublishServices(store: UmkmStore): UmkmPublishService[] {
  const metadata = normJson(store.metadata);
  const hasDirectServices =
    Object.prototype.hasOwnProperty.call(metadata, 'publish_services') ||
    Object.prototype.hasOwnProperty.call(metadata, 'publish_service') ||
    Object.prototype.hasOwnProperty.call(metadata, 'services');
  const direct = normalizePublishServices(
    metadata.publish_services ?? metadata.publish_service ?? metadata.services,
  );
  if (hasDirectServices) return direct;

  const toggles: UmkmPublishService[] = [];
  if (metadata.publish_food === true) toggles.push('food');
  if (metadata.publish_mart === true) toggles.push('mart');
  if (
    Object.prototype.hasOwnProperty.call(metadata, 'publish_food') ||
    Object.prototype.hasOwnProperty.call(metadata, 'publish_mart')
  ) {
    return toggles;
  }

  const businessType =
    normalizeUmkmBusinessCategory(metadata.umkm_category) ||
    normText(metadata.business_type) ||
    normText(metadata.store_type) ||
    normText(metadata.segment);
  return inferPublishServicesFromBusinessType(businessType);
}

export function checkUmkmStorePublishReady(
  store: UmkmStore,
  service: UmkmPublishService,
): { ok: boolean; missing: string[] } {
  const metadata = normJson(store.metadata);
  const legalType = (normText(metadata.legal_type) || 'individual').toLowerCase();

  const missing: string[] = [];
  if (metadata.outlet_active !== true) missing.push('Status outlet aktif');

  const ownerEmail = normText(metadata.owner_email);
  if (!ownerEmail) missing.push('Email pemilik');

  const ownerPhone = normText(metadata.owner_phone);
  if (!ownerPhone) missing.push('Nomor HP pemilik');

  if (!normText(store.address)) missing.push('Alamat outlet');

  const outletPhone = normText(metadata.outlet_phone) || normText(store.phone);
  if (!outletPhone) missing.push('Telepon outlet');

  const ktpNumber = normText(metadata.ktp_number);
  const ktpUrl = normText(metadata.ktp_url);
  if (!ktpNumber || !ktpUrl) missing.push('KTP pemilik + foto');

  const bankName = normText(metadata.bank_name);
  const bankAccountName = normText(metadata.bank_account_name);
  const bankAccountNumber = normText(metadata.bank_account_number);
  if (!bankName || !bankAccountName || !bankAccountNumber) missing.push('Rekening bank');

  if (legalType === 'company' || legalType === 'corporate') {
    const npwpNumber = normText(metadata.npwp_number);
    const npwpUrl = normText(metadata.npwp_url);
    if (!npwpNumber || !npwpUrl) missing.push('NPWP perusahaan');

    const licenseUrl = normText(metadata.business_license_url);
    if (!licenseUrl) missing.push('NIB/SIUP/izin usaha');

    const deedUrl = normText(metadata.deed_url);
    if (!deedUrl) missing.push('Akta pendirian/perubahan');

    const directorIdUrl = normText(metadata.director_id_url);
    if (!directorIdUrl) missing.push('KTP direksi/penanggung jawab');
  }

  if (service === 'food') {
    if (!normText(metadata.store_photo_url)) missing.push('Foto outlet');
    if (!normText(metadata.menu_photo_url)) missing.push('Foto menu');
  }

  if (service === 'mart') {
    if (!normText(metadata.store_photo_url)) missing.push('Foto outlet');
  }

  return {
    ok: missing.length === 0,
    missing,
  };
}

export async function updateUmkmStoreMetadata(input: {
  storeId: string;
  metadataPatch?: Record<string, unknown> | null;
  name?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  description?: string | null;
  lat?: number | null;
  lng?: number | null;
  onlineOrderEnabled?: boolean;
  offlineOrderEnabled?: boolean;
}): Promise<UmkmStore> {
  const backendStore = await fetchMarketplaceWriteJson<{ store?: UmkmStore }>(
    `/v1/umkm/stores/${encodeURIComponent(input.storeId)}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        name: input.name,
        city: input.city,
        address: input.address,
        phone: input.phone,
        description: input.description,
        lat: input.lat,
        lng: input.lng,
        online_order_enabled: input.onlineOrderEnabled,
        offline_order_enabled: input.offlineOrderEnabled,
        metadata: input.metadataPatch,
      }),
    },
  );
  if (backendStore?.store) {
    cacheRuntimeStore(backendStore.store);
    return cloneStore(backendStore.store);
  }

  const store = findStoreRecordById(input.storeId);
  if (!store) throw new Error('Store not found');

  if (typeof input.name === 'string') {
    const nextName = normText(input.name);
    if (nextName) {
      store.name = nextName;
    }
  }
  if (typeof input.city === 'string') {
    const nextCity = normText(input.city);
    if (nextCity) {
      store.city = nextCity;
    }
  }
  if (typeof input.address === 'string') {
    const nextAddress = normText(input.address);
    if (nextAddress) {
      store.address = nextAddress;
    }
  }
  if (typeof input.phone === 'string') {
    store.phone = normText(input.phone);
  }
  if (typeof input.description === 'string') {
    store.description = normText(input.description);
  }
  if (typeof input.lat === 'number' && Number.isFinite(input.lat)) {
    store.lat = input.lat;
  }
  if (typeof input.lng === 'number' && Number.isFinite(input.lng)) {
    store.lng = input.lng;
  }
  if (typeof input.onlineOrderEnabled === 'boolean') {
    store.online_order_enabled = input.onlineOrderEnabled;
  }
  if (typeof input.offlineOrderEnabled === 'boolean') {
    store.offline_order_enabled = input.offlineOrderEnabled;
  }

  if (input.metadataPatch) {
    store.metadata = {
      ...normJson(store.metadata),
      ...normJson(input.metadataPatch),
    };
  }

  store.updated_at = nowIso();
  return cloneStore(store);
}
