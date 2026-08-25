import type { UmkmStore } from './umkm-commerce.types';

const IDENTITY_URL =
  process.env.INTERNAL_API_URL ||
  process.env.INTERNAL_IDENTITY_URL ||
  'http://identity_service:8080';
const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';

type JsonRecord = Record<string, unknown>;
type FetchLike = typeof fetch;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function listItems(payload: unknown): JsonRecord[] {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  for (const source of [data, root]) {
    for (const key of ['items', 'organizations']) {
      const value = source[key];
      if (Array.isArray(value)) {
        return value
          .map(asRecord)
          .filter(item => Object.keys(item).length > 0);
      }
    }
  }
  return [];
}

async function parseJson(response: Response): Promise<JsonRecord> {
  return asRecord(await response.json().catch(() => ({})));
}

function upstreamError(payload: JsonRecord, fallback: string): string {
  return text(payload.error) || text(payload.message) || fallback;
}

export async function ensureWorkspaceOrganization(input: {
  token: string;
  name: string;
  fetchImpl?: FetchLike;
}): Promise<string> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${input.token}`,
  };

  let listResponse: Response;
  try {
    listResponse = await fetchImpl(`${IDENTITY_URL}/organizations`, {
      headers,
      cache: 'no-store',
    });
  } catch {
    throw new Error('identity_unavailable');
  }

  const listPayload = await parseJson(listResponse);
  if (!listResponse.ok) {
    throw new Error(upstreamError(listPayload, 'identity_unavailable'));
  }

  const organizations = listItems(listPayload)
    .map(item => ({ id: text(item.id), name: text(item.name) }))
    .filter(item => item.id);

  if (organizations.length === 1) return organizations[0].id;
  if (organizations.length > 1) {
    throw new Error('organization_selection_required');
  }

  let createResponse: Response;
  try {
    createResponse = await fetchImpl(`${IDENTITY_URL}/organizations`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: input.name }),
      cache: 'no-store',
    });
  } catch {
    throw new Error('identity_unavailable');
  }

  const createPayload = await parseJson(createResponse);
  if (!createResponse.ok) {
    throw new Error(upstreamError(createPayload, 'identity_unavailable'));
  }

  const data = asRecord(createPayload.data);
  const organization = asRecord(data.organization ?? createPayload.organization ?? data);
  const organizationId = text(organization.id);
  if (!organizationId) throw new Error('identity_invalid_organization_response');
  return organizationId;
}

export async function createDurableMarketplaceStore(input: {
  token: string;
  ownerUserId: string;
  organizationId: string;
  name: string;
  slug?: string;
  description?: string | null;
  city: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string | null;
  onlineOrderEnabled?: boolean;
  offlineOrderEnabled?: boolean;
  metadata?: Record<string, unknown>;
  fetchImpl?: FetchLike;
}): Promise<UmkmStore> {
  const fetchImpl = input.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl(`${MARKETPLACE_URL}/v1/umkm/stores`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.token}`,
      },
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
        is_active: true,
        online_order_enabled: input.onlineOrderEnabled !== false,
        offline_order_enabled: input.offlineOrderEnabled !== false,
        metadata: {
          ...(input.metadata ?? {}),
          organization_id: input.organizationId,
        },
      }),
      cache: 'no-store',
    });
  } catch {
    throw new Error('marketplace_persistence_unavailable');
  }

  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(
      upstreamError(payload, `marketplace_persistence_failed_${response.status}`),
    );
  }

  const data = asRecord(payload.data);
  const store = asRecord(data.store ?? payload.store);
  if (!text(store.id)) throw new Error('marketplace_invalid_store_response');
  return store as unknown as UmkmStore;
}
