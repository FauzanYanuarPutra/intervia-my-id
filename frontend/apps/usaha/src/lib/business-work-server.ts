import 'server-only';

import { readAccessToken } from '@/lib/auth-session';
import { fetchInternal } from '@/lib/server-fetch';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL || 'http://marketplace_service:8081';

export type BusinessWorkItem = {
  id: string;
  organization_id: string;
  business_id: string;
  location_id: string | null;
  work_type: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  assignee_user_id: string | null;
  created_by_user_id: string;
  due_at: string | null;
  source_type: string | null;
  source_id: string | null;
  metadata: Record<string, unknown>;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export class BusinessWorkHttpError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(code || 'business_work_request_failed');
    this.name = 'BusinessWorkHttpError';
    this.status = status;
    this.code = code || 'business_work_request_failed';
  }
}

type JsonRecord = Record<string, unknown>;
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

async function requestWork(path: string, init: RequestInit = {}) {
  const token = await readAccessToken();
  if (!token) throw new BusinessWorkHttpError(401, 'auth_required');
  const response = await fetchInternal(MARKETPLACE_URL + path, {
    ...init,
    cache: 'no-store',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let payload: unknown = {};
  try { payload = text ? JSON.parse(text) : {}; }
  catch { payload = { error: text || 'invalid_json_response' }; }
  if (!response.ok) {
    const body = record(payload);
    const code = typeof body?.error === 'string' ? body.error : 'business_work_request_failed';
    throw new BusinessWorkHttpError(response.status, code);
  }
  return payload;
}

function businessPath(businessId: string, suffix = '/work') {
  return '/v1/businesses/' + encodeURIComponent(businessId) + suffix;
}

export async function listBusinessWork(businessId: string, options: { status?: string; assigneeUserId?: string } = {}) {
  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (options.assigneeUserId) params.set('assignee_user_id', options.assigneeUserId);
  const suffix = params.toString() ? '/work?' + params.toString() : '/work';
  return items<BusinessWorkItem>(await requestWork(businessPath(businessId, suffix)));
}

export async function createBusinessWork(businessId: string, input: Record<string, unknown>) {
  const payload = await requestWork(businessPath(businessId), { method: 'POST', body: JSON.stringify(input) });
  const root = record(payload) ?? {};
  const data = record(root.data) ?? root;
  return data.work as BusinessWorkItem;
}

export async function updateBusinessWork(businessId: string, workId: string, input: Record<string, unknown>) {
  const payload = await requestWork(businessPath(businessId, '/work/' + encodeURIComponent(workId)), { method: 'PATCH', body: JSON.stringify(input) });
  const root = record(payload) ?? {};
  const data = record(root.data) ?? root;
  return data.work as BusinessWorkItem;
}

export async function syncBusinessWorkSuggestions(businessId: string) {
  const payload = await requestWork(businessPath(businessId, '/work/sync'), { method: 'POST' });
  const root = record(payload) ?? {};
  const data = record(root.data) ?? root;
  return Number(data.created) || 0;
}