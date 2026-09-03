import 'server-only';

import { readAccessToken } from '@/lib/auth-session';
import {
  inventoryAdjustmentPayload,
  productUpdatePayload,
} from '@/lib/product-mutation-contract';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL || 'http://marketplace_service:8081';

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function mutate(path: string, body: unknown) {
  const token = await readAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  const response = await fetch(`${MARKETPLACE_URL}${path}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let payload: unknown = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: text || 'invalid_marketplace_response' };
  }

  if (!response.ok) {
    const value = record(payload);
    const error = new Error(
      stringValue(value?.error) || stringValue(value?.message) || 'business_request_failed',
    ) as Error & { status?: number; code?: string };
    error.status = response.status;
    error.code = error.message;
    throw error;
  }

  return payload;
}

export async function updateCanonicalProduct(
  businessId: string,
  productId: string,
  input: Parameters<typeof productUpdatePayload>[0],
) {
  return mutate(
    `/v1/businesses/${encodeURIComponent(businessId)}/products/${encodeURIComponent(productId)}`,
    productUpdatePayload(input),
  );
}

export async function adjustCanonicalInventory(
  businessId: string,
  productId: string,
  input: Parameters<typeof inventoryAdjustmentPayload>[0],
) {
  return mutate(
    `/v1/businesses/${encodeURIComponent(businessId)}/products/${encodeURIComponent(productId)}/inventory`,
    inventoryAdjustmentPayload(input),
  );
}
