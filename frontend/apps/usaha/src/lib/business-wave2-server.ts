import 'server-only';

import { readAccessToken } from '@/lib/auth-session';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL || 'http://marketplace_service:8081';

type JsonRecord = Record<string, unknown>;

export type Wave2FinancePlan = {
  business_id: string;
  organization_id: string;
  owner_payroll_bps: number;
  staff_payroll_bps: number;
  working_capital_bps: number;
  operations_bps: number;
  reserve_bps: number;
  version: number;
};

export type Wave2Obligation = {
  id: string;
  label: string;
  entry_type: string;
  account_key: string;
  amount: number;
  interval_days: number;
  next_due_on: string;
  active: boolean;
  last_paid_at: string | null;
};

export type Wave2CashShift = {
  id: string;
  opening_cash: number;
  opened_at: string;
  expected_cash: number | null;
  actual_cash: number | null;
  variance: number | null;
  closed_at: string | null;
  note: string;
};

export type Wave2YieldObservation = {
  id: string;
  product_id: string | null;
  ingredient_id: string;
  input_quantity: string | number;
  output_units: string | number;
  input_unit: string;
  observed_on: string;
  note: string;
};

export class BusinessWave2HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code || `Wave 2 request failed (${status})`);
    this.name = 'BusinessWave2HttpError';
    this.status = status;
    this.code = code || 'business_wave2_request_failed';
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

async function requestWave2(path: string, init: RequestInit = {}) {
  const token = await readAccessToken();
  if (!token) throw new BusinessWave2HttpError(401, 'auth_required');

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
    throw new BusinessWave2HttpError(
      response.status,
      typeof body?.error === 'string' ? body.error : 'business_wave2_request_failed',
    );
  }
  return payload;
}

function path(businessId: string, suffix: string) {
  return `/v1/businesses/${encodeURIComponent(businessId)}${suffix}`;
}

export async function getWave2FinancePlan(businessId: string) {
  const payload = await requestWave2(path(businessId, '/finance-plan'));
  return (data(payload).plan as Wave2FinancePlan | null | undefined) ?? null;
}

export async function putWave2FinancePlan(
  businessId: string,
  input: Record<string, unknown>,
) {
  const payload = await requestWave2(path(businessId, '/finance-plan'), {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return (data(payload).plan as Wave2FinancePlan | undefined) ?? null;
}

export async function listWave2Obligations(businessId: string) {
  const payload = await requestWave2(path(businessId, '/obligations'));
  const value = data(payload).items;
  return Array.isArray(value) ? (value as Wave2Obligation[]) : [];
}

export async function createWave2Obligation(
  businessId: string,
  input: Record<string, unknown>,
) {
  const payload = await requestWave2(path(businessId, '/obligations'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data(payload).obligation as Wave2Obligation | undefined;
}

export async function payWave2Obligation(
  businessId: string,
  obligationId: string,
  idempotencyKey: string,
  paidOn: string,
) {
  return requestWave2(
    path(
      businessId,
      `/obligations/${encodeURIComponent(obligationId)}/payments`,
    ),
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ paid_on: paidOn }),
    },
  );
}

export async function createWave2Purchase(
  businessId: string,
  idempotencyKey: string,
  input: Record<string, unknown>,
) {
  return requestWave2(path(businessId, '/purchases'), {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  });
}

export async function getCurrentWave2CashShift(businessId: string) {
  const payload = await requestWave2(path(businessId, '/cash-shifts/current'));
  return (data(payload).shift as Wave2CashShift | null | undefined) ?? null;
}

export async function openWave2CashShift(
  businessId: string,
  input: Record<string, unknown>,
) {
  const payload = await requestWave2(path(businessId, '/cash-shifts/open'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return (data(payload).shift as Wave2CashShift | undefined) ?? null;
}

export async function closeWave2CashShift(
  businessId: string,
  shiftId: string,
  input: Record<string, unknown>,
) {
  const payload = await requestWave2(
    path(businessId, `/cash-shifts/${encodeURIComponent(shiftId)}/close`),
    { method: 'POST', body: JSON.stringify(input) },
  );
  return (data(payload).shift as Wave2CashShift | undefined) ?? null;
}

export async function setWave2PrimaryMaterial(
  businessId: string,
  productId: string,
  input: Record<string, unknown>,
) {
  return requestWave2(
    path(
      businessId,
      `/products/${encodeURIComponent(productId)}/primary-material`,
    ),
    { method: 'PUT', body: JSON.stringify(input) },
  );
}

export async function listWave2YieldObservations(businessId: string) {
  const payload = await requestWave2(path(businessId, '/yield-observations'));
  const value = data(payload).items;
  return Array.isArray(value) ? (value as Wave2YieldObservation[]) : [];
}

export async function createWave2YieldObservation(
  businessId: string,
  input: Record<string, unknown>,
) {
  const payload = await requestWave2(path(businessId, '/yield-observations'), {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data(payload).observation as Wave2YieldObservation | undefined;
}
