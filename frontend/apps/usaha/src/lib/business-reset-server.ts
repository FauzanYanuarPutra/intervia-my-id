import 'server-only';

import { readAccessToken } from '@/lib/auth-session';
import { fetchInternal } from '@/lib/server-fetch';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL || 'http://marketplace_service:8081';

import type {
  BusinessResetBatch,
  BusinessResetPreview,
  BusinessResetRequest,
} from '@/lib/business-reset-types';

export type { BusinessResetBatch, BusinessResetPreview, BusinessResetRequest, BusinessResetScope } from '@/lib/business-reset-types';

export class BusinessResetHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code || 'business_data_reset_request_failed');
    this.name = 'BusinessResetHttpError';
    this.status = status;
    this.code = code || 'business_data_reset_request_failed';
  }
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

async function requestReset(
  businessId: string,
  action: 'preview' | 'apply',
  input: BusinessResetRequest,
  idempotencyKey?: string,
) {
  const token = await readAccessToken();
  if (!token) throw new BusinessResetHttpError(401, 'auth_required');

  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const response = await fetchInternal(
    `${MARKETPLACE_URL}/v1/businesses/${encodeURIComponent(businessId)}/data-reset/${action}`,
    {
      method: 'POST',
      cache: 'no-store',
      headers,
      body: JSON.stringify(input),
    },
  );

  const text = await response.text();
  let payload: unknown = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: text || 'invalid_json_response' };
  }

  if (!response.ok) {
    const body = record(payload);
    throw new BusinessResetHttpError(
      response.status,
      typeof body.error === 'string'
        ? body.error
        : 'business_data_reset_request_failed',
    );
  }

  return record(payload);
}

export async function previewBusinessReset(
  businessId: string,
  input: BusinessResetRequest,
): Promise<BusinessResetPreview> {
  const payload = await requestReset(businessId, 'preview', input);
  const data = record(payload.data);
  return data as unknown as BusinessResetPreview;
}

export async function applyBusinessReset(
  businessId: string,
  input: BusinessResetRequest,
  idempotencyKey: string,
): Promise<BusinessResetBatch> {
  const payload = await requestReset(businessId, 'apply', input, idempotencyKey);
  const data = record(payload.data);
  return data as unknown as BusinessResetBatch;
}
