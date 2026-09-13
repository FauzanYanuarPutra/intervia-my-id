import 'server-only';

import { readAccessToken } from '@/lib/auth-session';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL || 'http://marketplace_service:8081';

export type BusinessAdvisorSummary = {
  metrics: {
    sales_30d_amount: number;
    sales_30d_count: number;
    incomplete_cost_sales_30d: number;
    due_14d_amount: number;
    low_stock_count: number;
    yield_evidence_count: number;
  };
  signals: string[];
  provider: {
    provider: 'disabled' | 'ollama' | 'open_ai_compatible';
    base_url: string | null;
    model: string | null;
  };
  mode: string;
};

export async function getBusinessAdvisorSummary(
  businessId: string,
): Promise<BusinessAdvisorSummary | null> {
  const token = await readAccessToken();
  if (!token) return null;
  const response = await fetch(
    `${MARKETPLACE_URL}/v1/businesses/${encodeURIComponent(businessId)}/advisor/summary`,
    {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    },
  );
  if (!response.ok) return null;
  const payload = await response.json().catch(() => ({}));
  const advisor = payload?.data?.advisor;
  return advisor && typeof advisor === 'object'
    ? (advisor as BusinessAdvisorSummary)
    : null;
}
