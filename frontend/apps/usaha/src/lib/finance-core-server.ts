import 'server-only';

import { readAccessToken } from '@/lib/auth-session';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL || 'http://marketplace_service:8081';

type JsonRecord = Record<string, unknown>;

export class FinanceCoreHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code || `Finance core request failed (${status})`);
    this.name = 'FinanceCoreHttpError';
    this.status = status;
    this.code = code || 'finance_core_request_failed';
  }
}

export type FinanceCoreHistoryEntry = {
  id: string;
  business_id: string;
  organization_id: string;
  entry_type: string;
  account_key: string;
  amount: number;
  occurred_on: string;
  note: string;
  channel_key: string | null;
  source_type: string | null;
  source_id: string | null;
  created_by_user_id: string;
  effect_multiplier: 1 | -1;
  reversal_of_entry_id: string | null;
  corrects_entry_id: string | null;
  correction_reason: string | null;
  allocation_bucket: string | null;
  corrected: boolean;
  replacement_entry_id: string | null;
  corrected_by_user_id: string | null;
  corrected_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FinanceCoreAllocationBalance = {
  bucket: 'owner' | 'team' | 'reinvest' | 'operations' | 'reserve';
  balance: number;
};

export type FinanceCoreSummary = {
  accounts: Array<{ account_key: string; balance: number }>;
  allocations: FinanceCoreAllocationBalance[];
  liquid_cash: number;
  receivable: number;
  payable: number;
  sale_revenue: number;
  other_income: number;
  operating_expenses: number;
  inventory_purchases: number;
  owner_capital: number;
  owner_draw: number;
  cash_movement: number;
  allocated_total: number;
  unallocated_cash: number;
};

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

async function requestFinanceCore(
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const token = await readAccessToken();
  if (!token) throw new FinanceCoreHttpError(401, 'auth_required');
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
    const code = typeof body?.error === 'string' ? body.error : 'finance_core_request_failed';
    throw new FinanceCoreHttpError(response.status, code);
  }
  return payload;
}

function path(businessId: string, suffix: string) {
  return `/v1/businesses/${encodeURIComponent(businessId)}/finance-core${suffix}`;
}

function data(payload: unknown) {
  const root = record(payload) ?? {};
  return record(root.data) ?? root;
}

export async function getFinanceCoreSummary(
  businessId: string,
): Promise<FinanceCoreSummary> {
  const payload = await requestFinanceCore(path(businessId, '/summary'));
  const value = data(payload).summary;
  if (!value || typeof value !== 'object') {
    throw new FinanceCoreHttpError(502, 'invalid_finance_summary_response');
  }
  return value as FinanceCoreSummary;
}

export async function listFinanceCoreEntries(
  businessId: string,
): Promise<FinanceCoreHistoryEntry[]> {
  const payload = await requestFinanceCore(path(businessId, '/entries'));
  const items = data(payload).items;
  return Array.isArray(items) ? (items as FinanceCoreHistoryEntry[]) : [];
}

export async function createFinanceCoreEntry(
  businessId: string,
  idempotencyKey: string,
  input: Record<string, unknown>,
) {
  return requestFinanceCore(path(businessId, '/entries'), {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
}

export async function correctFinanceCoreEntry(
  businessId: string,
  entryId: string,
  idempotencyKey: string,
  input: Record<string, unknown>,
) {
  return requestFinanceCore(
    path(businessId, `/entries/${encodeURIComponent(entryId)}/correct`),
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(input),
    },
  );
}

export async function getFinanceCoreAllocations(
  businessId: string,
): Promise<FinanceCoreAllocationBalance[]> {
  const payload = await requestFinanceCore(path(businessId, '/allocations'));
  const items = data(payload).items;
  return Array.isArray(items) ? (items as FinanceCoreAllocationBalance[]) : [];
}

export async function moveFinanceCoreAllocation(
  businessId: string,
  idempotencyKey: string,
  input: Record<string, unknown>,
) {
  return requestFinanceCore(path(businessId, '/allocations/move'), {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
}
