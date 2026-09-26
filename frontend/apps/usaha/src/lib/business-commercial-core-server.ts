import 'server-only';

import { readAccessToken } from '@/lib/auth-session';
import { fetchInternal } from '@/lib/server-fetch';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL || 'http://marketplace_service:8081';

type JsonRecord = Record<string, unknown>;

export type CommercialParty = {
  id: string;
  organization_id: string;
  business_id: string;
  party_kind: 'customer' | 'supplier' | 'both' | 'other' | string;
  display_name: string;
  legal_name: string | null;
  phone: string | null;
  email: string | null;
  tax_identifier: string | null;
  address: string | null;
  note: string;
  status: 'active' | 'archived' | string;
  version: number;
  created_at: string;
  updated_at: string;
};

export type CommercialReceivable = {
  sale_id: string;
  business_id: string;
  organization_id: string;
  party_id: string | null;
  document_number: string;
  currency: string;
  occurred_on: string;
  original_amount: number;
  paid_amount: number;
  outstanding_amount: number;
};

export type CommercialPayable = {
  purchase_id: string;
  business_id: string;
  organization_id: string;
  party_id: string | null;
  document_number: string;
  currency: string;
  occurred_on: string;
  original_amount: number;
  paid_amount: number;
  outstanding_amount: number;
};

export class CommercialCoreHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code || `Commercial Core request failed (${status})`);
    this.name = 'CommercialCoreHttpError';
    this.status = status;
    this.code = code || 'commercial_core_request_failed';
  }
}

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function data(payload: unknown) {
  const root = record(payload) ?? {};
  return record(root.data) ?? root;
}

async function requestCommercial(pathname: string, init: RequestInit = {}) {
  const token = await readAccessToken();
  if (!token) throw new CommercialCoreHttpError(401, 'auth_required');

  const response = await fetchInternal(`${MARKETPLACE_URL}${pathname}`, {
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
    throw new CommercialCoreHttpError(
      response.status,
      typeof body?.error === 'string'
        ? body.error
        : 'commercial_core_request_failed',
    );
  }

  return payload;
}

function path(businessId: string, suffix: string) {
  return `/v1/businesses/${encodeURIComponent(businessId)}${suffix}`;
}

export async function listCommercialParties(
  businessId: string,
  includeArchived = false,
): Promise<CommercialParty[]> {
  const query = includeArchived ? '?include_archived=true' : '';
  const payload = await requestCommercial(path(businessId, `/parties${query}`));
  const items = data(payload).items;
  return Array.isArray(items) ? (items as CommercialParty[]) : [];
}

export async function createCommercialParty(
  businessId: string,
  idempotencyKey: string,
  input: Record<string, unknown>,
) {
  const payload = await requestCommercial(path(businessId, '/parties'), {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
  return (data(payload).party as CommercialParty | undefined) ?? null;
}

export async function updateCommercialParty(
  businessId: string,
  partyId: string,
  input: Record<string, unknown>,
) {
  const payload = await requestCommercial(
    path(businessId, `/parties/${encodeURIComponent(partyId)}`),
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
  return (data(payload).party as CommercialParty | undefined) ?? null;
}

export async function archiveCommercialParty(
  businessId: string,
  partyId: string,
  input: Record<string, unknown>,
) {
  const payload = await requestCommercial(
    path(
      businessId,
      `/parties/${encodeURIComponent(partyId)}/archive`,
    ),
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return (data(payload).party as CommercialParty | undefined) ?? null;
}

export async function listCommercialReceivables(
  businessId: string,
): Promise<CommercialReceivable[]> {
  const payload = await requestCommercial(path(businessId, '/receivables'));
  const items = data(payload).items;
  return Array.isArray(items) ? (items as CommercialReceivable[]) : [];
}

export async function listCommercialPayables(
  businessId: string,
): Promise<CommercialPayable[]> {
  const payload = await requestCommercial(path(businessId, '/payables'));
  const items = data(payload).items;
  return Array.isArray(items) ? (items as CommercialPayable[]) : [];
}
