import 'server-only';

import { readAccessToken } from '@/lib/auth-session';
import { fetchInternal } from '@/lib/server-fetch';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL || 'http://marketplace_service:8081';

export type SalesPeriodSummary = {
  revenue: number;
  cogs: number;
  transaction_count: number;
  incomplete_cost_count: number;
};

class SalesSummaryHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code || 'sales_summary_request_failed');
    this.status = status;
    this.code = code || 'sales_summary_request_failed';
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function getSalesPeriodSummary(
  businessId: string,
  options: { from?: string; to?: string } = {},
): Promise<SalesPeriodSummary> {
  const token = await readAccessToken();
  if (!token) throw new SalesSummaryHttpError(401, 'auth_required');

  const query = new URLSearchParams();
  if (options.from) query.set('from', options.from);
  if (options.to) query.set('to', options.to);
  const suffix = query.toString() ? `/summary?${query.toString()}` : '/summary';

  const response = await fetchInternal(
    `${MARKETPLACE_URL}/v1/businesses/${encodeURIComponent(businessId)}/sales${suffix}`,
    {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
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
    throw new SalesSummaryHttpError(
      response.status,
      typeof body.error === 'string'
        ? body.error
        : 'sales_summary_request_failed',
    );
  }

  const root = record(payload);
  const data = record(root.data);
  const summary = data.summary;
  if (!summary || typeof summary !== 'object') {
    throw new SalesSummaryHttpError(502, 'invalid_sales_summary_response');
  }
  return summary as SalesPeriodSummary;
}
