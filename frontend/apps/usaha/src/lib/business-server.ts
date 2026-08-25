import 'server-only';

import { readAccessToken } from '@/lib/auth-session';
import { permissionMap } from '@/lib/portal-data';
import {
  buildBusinessGoogleMapsUrl,
  buildPublicStorefrontUrl,
} from '@/lib/portal-links';
import type {
  BusinessLocation,
  BusinessRecord,
  PortalRole,
  ProductRecord,
  ReservationRecord,
  TeamMember,
} from '@/lib/portal-types';

const IDENTITY_URL =
  process.env.INTERNAL_API_URL ||
  process.env.INTERNAL_IDENTITY_URL ||
  'http://identity_service:8080';
const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL || 'http://marketplace_service:8081';

export type PortalAccount = {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl?: string;
};

export type WorkspaceOrganization = {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string | null;
  currentUserRole: string;
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function nullableNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Number(parsed) : null;
}

function boolValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function arrayValue<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function nestedRecord(payload: unknown): JsonRecord {
  const root = record(payload) ?? {};
  const data = record(root.data);
  return data ?? root;
}

function listPayload(payload: unknown): JsonRecord[] {
  if (Array.isArray(payload)) return payload.filter(record) as JsonRecord[];
  const root = record(payload) ?? {};
  for (const source of [root, record(root.data)]) {
    if (!source) continue;
    for (const key of ['items', 'stores', 'results', 'organizations']) {
      const value = source[key];
      if (Array.isArray(value)) return value.filter(record) as JsonRecord[];
    }
  }
  return [];
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
}

async function requestJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  const text = await response.text();
  let payload: unknown = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: text || 'Invalid JSON response' };
  }
  if (!response.ok) {
    const body = record(payload);
    throw new Error(
      stringValue(body?.error) ||
        stringValue(body?.message) ||
        `Upstream request failed (${response.status})`,
    );
  }
  return payload;
}

function parseActor(payload: unknown): PortalAccount | null {
  const root = record(payload) ?? {};
  const data = record(root.data);
  const user =
    record(root.user) ?? record(data?.user) ?? data ?? root;
  const id = stringValue(user.id ?? user.user_id ?? user.sub);
  if (!id) return null;
  const metadata = record(user.metadata) ?? {};
  return {
    id,
    name:
      stringValue(user.full_name ?? user.name ?? metadata.full_name ?? user.username) ||
      'Pengguna Lajukan',
    email: stringValue(user.email),
    phone: stringValue(user.phone),
    avatarUrl: stringValue(user.avatar_url ?? metadata.avatar_url) || undefined,
  };
}

export async function getAuthenticatedActor(): Promise<PortalAccount | null> {
  const token = await readAccessToken();
  if (!token) return null;
  try {
    const payload = await requestJson(`${IDENTITY_URL}/auth/me`, {
      headers: authHeaders(token),
    });
    return parseActor(payload);
  } catch {
    return null;
  }
}

export async function requireAuthenticatedActor() {
  const token = await readAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');
  const payload = await requestJson(`${IDENTITY_URL}/auth/me`, {
    headers: authHeaders(token),
  });
  const account = parseActor(payload);
  if (!account) throw new Error('AUTH_REQUIRED');
  return { token, account };
}

export async function listWorkspaceOrganizations(
  token?: string,
): Promise<WorkspaceOrganization[]> {
  const resolvedToken = token ?? (await readAccessToken());
  if (!resolvedToken) return [];
  const payload = await requestJson(`${IDENTITY_URL}/organizations`, {
    headers: authHeaders(resolvedToken),
  });
  return listPayload(payload)
    .map(item => ({
      id: stringValue(item.id),
      name: stringValue(item.name),
      slug: stringValue(item.slug),
      ownerUserId: stringValue(item.owner_user_id) || null,
      currentUserRole: stringValue(item.current_user_role) || 'viewer',
    }))
    .filter(item => item.id && item.name);
}

function normalizeRole(value: string, isOwner: boolean): PortalRole {
  if (isOwner || value === 'owner') return 'owner';
  if (['admin', 'manager'].includes(value)) return 'manager';
  if (['cashier', 'staff', 'operator'].includes(value)) return 'cashier';
  return 'viewer';
}

function metadataOf(store: JsonRecord): JsonRecord {
  return record(store.metadata) ?? {};
}

function parseLocations(store: JsonRecord): BusinessLocation[] {
  const metadata = metadataOf(store);
  const configured = arrayValue<JsonRecord>(metadata.locations)
    .map(item => ({
      id: stringValue(item.id),
      name: stringValue(item.name) || 'Lokasi usaha',
      locationType:
        stringValue(item.locationType ?? item.location_type) === 'service_area'
          ? 'service_area'
          : stringValue(item.locationType ?? item.location_type) === 'online'
            ? 'online'
            : 'physical',
      address: stringValue(item.address),
      city: stringValue(item.city),
      province: stringValue(item.province),
      district: stringValue(item.district),
      postalCode: stringValue(item.postalCode ?? item.postal_code),
      latitude: nullableNumber(item.latitude ?? item.lat),
      longitude: nullableNumber(item.longitude ?? item.lng),
      phone: stringValue(item.phone),
      whatsapp: stringValue(item.whatsapp),
      timezone: stringValue(item.timezone) || 'Asia/Jakarta',
      businessHours: record(item.businessHours ?? item.business_hours) ?? {},
      status: stringValue(item.status) || 'active',
      isPrimary: boolValue(item.isPrimary ?? item.is_primary),
      publicVisibility: boolValue(
        item.publicVisibility ?? item.public_visibility,
        true,
      ),
    }))
    .filter(item => item.id);

  if (configured.length > 0) return configured;

  const address = stringValue(store.address);
  const city = stringValue(store.city);
  if (!address && !city) return [];
  return [
    {
      id: `primary-${stringValue(store.id)}`,
      name: 'Lokasi utama',
      locationType: 'physical',
      address,
      city,
      province: '',
      district: '',
      postalCode: '',
      latitude: nullableNumber(store.lat),
      longitude: nullableNumber(store.lng),
      phone: stringValue(store.phone),
      whatsapp: stringValue(store.phone),
      timezone: 'Asia/Jakarta',
      businessHours: {},
      status: 'active',
      isPrimary: true,
      publicVisibility: true,
    },
  ];
}

function mapStore(
  store: JsonRecord,
  actor: PortalAccount,
  organizations: WorkspaceOrganization[],
): BusinessRecord {
  const metadata = metadataOf(store);
  const organizationId =
    stringValue(store.organization_id) ||
    stringValue(metadata.organization_id ?? metadata.organizationId);
  const organization = organizations.find(item => item.id === organizationId);
  const ownerUserId = stringValue(store.owner_user_id);
  const role = normalizeRole(
    organization?.currentUserRole ?? '',
    ownerUserId === actor.id || organization?.ownerUserId === actor.id,
  );
  const latitude = nullableNumber(store.lat);
  const longitude = nullableNumber(store.lng);
  const name = stringValue(store.name) || 'Usaha tanpa nama';
  const address = stringValue(store.address);
  const city = stringValue(store.city);
  const locationQuery =
    stringValue(metadata.locationQuery ?? metadata.location_query) ||
    [name, address, city].filter(Boolean).join(', ');
  const products = arrayValue<ProductRecord>(metadata.products);
  const reservations = arrayValue<ReservationRecord>(metadata.reservations);
  const teamMembers = arrayValue<TeamMember>(metadata.teamMembers ?? metadata.team_members);
  const locations = parseLocations(store);

  return {
    id: stringValue(store.id),
    slug: stringValue(store.slug),
    name,
    currentRole: role,
    organizationId: organizationId || null,
    city,
    address,
    latitude,
    longitude,
    locationQuery,
    googleMapsUrl: buildBusinessGoogleMapsUrl({
      name,
      address,
      city,
      locationQuery,
      latitude,
      longitude,
    }),
    category: stringValue(metadata.category) || 'Usaha umum',
    phone: stringValue(store.phone),
    description: stringValue(store.description),
    schedule: stringValue(metadata.schedule) || 'Belum diatur',
    infoComplete: Boolean(name && city && stringValue(store.phone)),
    productsCount: products.length,
    ownedProductsCount: products.filter(item => item.sourceType !== 'consignment').length,
    consignmentProductsCount: products.filter(item => item.sourceType === 'consignment').length,
    lowStockProductsCount: products.filter(item => item.stockHealth === 'tipis' || item.stockHealth === 'habis').length,
    stockCheckCount: products.filter(item => item.stockHealth === 'perlu-cocokkan').length,
    isOpen: boolValue(metadata.isOpen ?? metadata.is_open, boolValue(store.is_active)),
    buyerPageReady: boolValue(metadata.buyerPageReady ?? metadata.buyer_page_ready, products.length > 0),
    activeOrders: Number(metadata.activeOrders ?? metadata.active_orders ?? 0) || 0,
    reservationsCount: reservations.length,
    teamMembers,
    invites: arrayValue(metadata.invites),
    products,
    orders: arrayValue(metadata.orders),
    reservations,
    locations,
    permissions: permissionMap[role],
    publicUrl: buildPublicStorefrontUrl(stringValue(store.slug)),
    securityEvents: arrayValue(metadata.securityEvents ?? metadata.security_events),
  };
}

async function listMarketplaceStores(options: {
  ownerUserId?: string;
  token?: string;
} = {}): Promise<JsonRecord[]> {
  const params = new URLSearchParams({ limit: '500' });
  if (options.ownerUserId) params.set('owner_user_id', options.ownerUserId);
  const payload = await requestJson(
    `${MARKETPLACE_URL}/v1/umkm/stores?${params.toString()}`,
    {
      headers: options.token
        ? authHeaders(options.token)
        : { Accept: 'application/json' },
    },
  );
  return listPayload(payload);
}

export async function listBusinessesForCurrentActor(): Promise<BusinessRecord[]> {
  const { token, account } = await requireAuthenticatedActor();
  const organizations = await listWorkspaceOrganizations(token);
  const organizationIds = new Set(organizations.map(item => item.id));
  const [ownedStores, organizationCandidates] = await Promise.all([
    listMarketplaceStores({ ownerUserId: account.id, token }),
    organizations.length > 0
      ? listMarketplaceStores({ token })
      : Promise.resolve([] as JsonRecord[]),
  ]);
  const stores = Array.from(
    new Map(
      [...ownedStores, ...organizationCandidates]
        .filter(store => stringValue(store.id))
        .map(store => [stringValue(store.id), store]),
    ).values(),
  );
  return stores
    .filter(store => {
      if (stringValue(store.owner_user_id) === account.id) return true;
      const metadata = metadataOf(store);
      const organizationId =
        stringValue(store.organization_id) ||
        stringValue(metadata.organization_id ?? metadata.organizationId);
      return organizationId ? organizationIds.has(organizationId) : false;
    })
    .map(store => mapStore(store, account, organizations));
}

export async function getBusinessForCurrentActor(
  businessId: string,
): Promise<BusinessRecord | null> {
  const businesses = await listBusinessesForCurrentActor();
  return businesses.find(item => item.id === businessId || item.slug === businessId) ?? null;
}

export async function createBusiness(input: {
  name: string;
  category: string;
  city: string;
  address: string;
  phone: string;
  locationQuery: string;
  latitude: number;
  longitude: number;
}) {
  const { token, account } = await requireAuthenticatedActor();
  const organizationPayload = await requestJson(`${IDENTITY_URL}/organizations`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: input.name }),
  });
  const organizationRoot = nestedRecord(organizationPayload);
  const organization = record(organizationRoot.organization) ?? organizationRoot;
  const organizationId = stringValue(organization.id);
  if (!organizationId) throw new Error('Organization tidak berhasil dibuat.');

  const primaryLocation: BusinessLocation = {
    id: `pending-primary-${Date.now()}`,
    name: 'Lokasi utama',
    locationType: 'physical',
    address: input.address,
    city: input.city,
    province: '',
    district: '',
    postalCode: '',
    latitude: input.latitude,
    longitude: input.longitude,
    phone: input.phone,
    whatsapp: input.phone,
    timezone: 'Asia/Jakarta',
    businessHours: {},
    status: 'active',
    isPrimary: true,
    publicVisibility: true,
  };

  const payload = await requestJson(`${MARKETPLACE_URL}/v1/umkm/stores`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      owner_user_id: account.id,
      name: input.name,
      description: '',
      city: input.city,
      address: input.address,
      lat: input.latitude,
      lng: input.longitude,
      phone: input.phone,
      is_active: true,
      online_order_enabled: true,
      offline_order_enabled: true,
      metadata: {
        organization_id: organizationId,
        category: input.category,
        locationQuery: input.locationQuery,
        schedule: 'Belum diatur',
        locations: [primaryLocation],
      },
    }),
  });
  const root = nestedRecord(payload);
  const store = record(root.store) ?? root;
  const businessId = stringValue(store.id);
  if (!businessId) throw new Error('Usaha tidak berhasil dibuat di Marketplace.');
  return { businessId, organizationId, name: input.name };
}

export async function updateBusiness(
  businessId: string,
  input: {
    name?: string;
    category?: string;
    city?: string;
    address?: string;
    phone?: string;
    description?: string;
    schedule?: string;
    locationQuery?: string;
    latitude?: number | null;
    longitude?: number | null;
    metadataPatch?: JsonRecord;
  },
): Promise<BusinessRecord> {
  const { token } = await requireAuthenticatedActor();
  const current = await getBusinessForCurrentActor(businessId);
  if (!current) throw new Error('Usaha tidak ditemukan atau akses ditolak.');
  const stores = await listMarketplaceStores({ token });
  const rawStore = stores.find(item => stringValue(item.id) === current.id);
  if (!rawStore) throw new Error('Data usaha tidak ditemukan.');
  const metadata = {
    ...metadataOf(rawStore),
    ...(input.metadataPatch ?? {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.schedule !== undefined ? { schedule: input.schedule } : {}),
    ...(input.locationQuery !== undefined ? { locationQuery: input.locationQuery } : {}),
  };

  await requestJson(`${MARKETPLACE_URL}/v1/umkm/stores/${encodeURIComponent(current.id)}`, {
    method: 'PUT',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.latitude !== undefined && input.latitude !== null ? { lat: input.latitude } : {}),
      ...(input.longitude !== undefined && input.longitude !== null ? { lng: input.longitude } : {}),
      metadata,
    }),
  });

  const updated = await getBusinessForCurrentActor(current.id);
  if (!updated) throw new Error('Usaha sudah disimpan tetapi gagal dimuat ulang.');
  return updated;
}

export async function replaceBusinessLocations(
  businessId: string,
  locations: BusinessLocation[],
) {
  const primary = locations.find(item => item.isPrimary) ?? locations[0];
  return updateBusiness(businessId, {
    ...(primary
      ? {
          city: primary.city,
          address: primary.address,
          phone: primary.phone,
          latitude: primary.latitude,
          longitude: primary.longitude,
          locationQuery: [primary.name, primary.address, primary.city].filter(Boolean).join(', '),
        }
      : {}),
    metadataPatch: { locations },
  });
}
