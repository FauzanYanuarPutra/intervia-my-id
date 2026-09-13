import 'server-only';

import { readAccessToken } from '@/lib/auth-session';
import { BusinessControlHttpError } from '@/lib/business-control-server';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL || 'http://marketplace_service:8081';

type JsonRecord = Record<string, unknown>;

export type ControlIngredientMovement = {
  id: string;
  organization_id: string;
  business_id: string;
  location_id: string | null;
  ingredient_id: string;
  command_id: string | null;
  movement_type: string;
  quantity_delta: string | number;
  quantity_before: string | number;
  quantity_after: string | number;
  source_type: string | null;
  source_id: string | null;
  note: string;
  created_by_user_id: string;
  created_at: string;
};

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

async function requestIngredientControl(
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
    const code =
      typeof body?.error === 'string'
        ? body.error
        : 'business_ingredient_request_failed';
    throw new BusinessControlHttpError(response.status, code);
  }
  return payload;
}

function businessPath(businessId: string, suffix: string) {
  return `/v1/businesses/${encodeURIComponent(businessId)}${suffix}`;
}

export async function updateControlIngredient(
  businessId: string,
  ingredientId: string,
  input: Record<string, unknown>,
) {
  return requestIngredientControl(
    businessPath(
      businessId,
      `/ingredients/${encodeURIComponent(ingredientId)}`,
    ),
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export async function archiveControlIngredient(
  businessId: string,
  ingredientId: string,
) {
  return requestIngredientControl(
    businessPath(
      businessId,
      `/ingredients/${encodeURIComponent(ingredientId)}/archive`,
    ),
    { method: 'POST' },
  );
}

export async function adjustControlIngredientStock(
  businessId: string,
  locationId: string,
  idempotencyKey: string,
  input: Record<string, unknown>,
) {
  return requestIngredientControl(
    businessPath(
      businessId,
      `/branches/${encodeURIComponent(locationId)}/inventory/mutations`,
    ),
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(input),
    },
  );
}

export async function listControlIngredientMovements(
  businessId: string,
  locationId: string,
  ingredientId: string,
): Promise<ControlIngredientMovement[]> {
  const payload = await requestIngredientControl(
    businessPath(
      businessId,
      `/branches/${encodeURIComponent(locationId)}/ingredients/${encodeURIComponent(ingredientId)}/movements`,
    ),
  );
  const root = record(payload) ?? {};
  const data = record(root.data) ?? root;
  return Array.isArray(data.items)
    ? (data.items as ControlIngredientMovement[])
    : [];
}
