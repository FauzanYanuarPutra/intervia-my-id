import 'server-only';

import { readAccessToken } from '@/lib/auth-session';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL || 'http://marketplace_service:8081';

export type ControlIngredient = {
  id: string;
  business_id: string;
  organization_id: string;
  name: string;
  kind: 'ingredient' | 'packaging' | 'semi_finished' | 'utility' | 'labor';
  purchase_unit: string;
  recipe_unit: string;
  conversion_factor: string | number;
  purchase_price_amount: number;
  purchase_quantity: string | number;
  yield_percent: string | number;
  waste_percent: string | number;
  stock_quantity: string | number;
  minimum_stock: string | number;
  supplier_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ControlRecipeItem = {
  id: string;
  ingredient_id: string;
  ingredient_name: string;
  recipe_unit: string;
  quantity: string | number;
  waste_percent_override: string | number | null;
  position: number;
};

export type ControlRecipe = {
  recipe: {
    id: string;
    business_id: string;
    organization_id: string;
    product_id: string;
    name: string;
    servings: string | number;
    status: string;
    version: number;
    created_at: string;
    updated_at: string;
  };
  items: ControlRecipeItem[];
};

export type ControlChannel = {
  id: string;
  business_id: string;
  organization_id: string;
  channel_key: string;
  display_name: string;
  fee_rate_bps: number;
  fixed_fee_amount: number;
  merchant_promo_amount: number;
  target_margin_bps: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ControlFinanceEntry = {
  id: string;
  business_id: string;
  organization_id: string;
  entry_type: string;
  account_key: string;
  amount: number;
  occurred_on: string;
  note: string;
  channel_key: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
};

type JsonRecord = Record<string, unknown>;

export class BusinessControlHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code || `Business control request failed (${status})`);
    this.name = 'BusinessControlHttpError';
    this.status = status;
    this.code = code || 'business_control_request_failed';
  }
}

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function items<T>(payload: unknown): T[] {
  const root = record(payload) ?? {};
  const data = record(root.data) ?? root;
  return Array.isArray(data.items) ? (data.items as T[]) : [];
}

async function requestControl(
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const token = await readAccessToken();
  if (!token) throw new BusinessControlHttpError(401, 'auth_required');

  const response = await fetch(`${MARKETPLACE_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let payload: unknown = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: text || 'invalid_json_response' };
  }

  if (!response.ok) {
    const body = record(payload);
    const code = typeof body?.error === 'string' ? body.error : 'business_control_request_failed';
    throw new BusinessControlHttpError(response.status, code);
  }
  return payload;
}

function businessPath(businessId: string, suffix: string) {
  return `/v1/businesses/${encodeURIComponent(businessId)}${suffix}`;
}

export async function listControlIngredients(businessId: string) {
  return items<ControlIngredient>(
    await requestControl(businessPath(businessId, '/ingredients')),
  );
}

export async function createControlIngredient(
  businessId: string,
  input: Record<string, unknown>,
) {
  return requestControl(businessPath(businessId, '/ingredients'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getControlRecipe(
  businessId: string,
  productId: string,
): Promise<ControlRecipe | null> {
  try {
    const payload = await requestControl(
      businessPath(
        businessId,
        `/products/${encodeURIComponent(productId)}/recipe`,
      ),
    );
    const root = record(payload) ?? {};
    const data = record(root.data) ?? root;
    return (data.recipe as ControlRecipe | undefined) ?? null;
  } catch (error) {
    if (error instanceof BusinessControlHttpError && error.status === 404) return null;
    throw error;
  }
}

export async function replaceControlRecipe(
  businessId: string,
  productId: string,
  input: Record<string, unknown>,
) {
  return requestControl(
    businessPath(
      businessId,
      `/products/${encodeURIComponent(productId)}/recipe`,
    ),
    { method: 'PUT', body: JSON.stringify(input) },
  );
}

export async function listControlChannels(businessId: string) {
  return items<ControlChannel>(
    await requestControl(businessPath(businessId, '/channels')),
  );
}

export async function upsertControlChannel(
  businessId: string,
  channelKey: string,
  input: Record<string, unknown>,
) {
  return requestControl(
    businessPath(businessId, `/channels/${encodeURIComponent(channelKey)}`),
    { method: 'PUT', body: JSON.stringify(input) },
  );
}

export async function listControlFinanceEntries(businessId: string) {
  return items<ControlFinanceEntry>(
    await requestControl(businessPath(businessId, '/finance-entries')),
  );
}

export async function createControlFinanceEntry(
  businessId: string,
  input: Record<string, unknown>,
) {
  return requestControl(businessPath(businessId, '/finance-entries'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
