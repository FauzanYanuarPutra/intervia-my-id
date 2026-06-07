import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, enforceRateLimit } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';
import {
  BUSINESS_MODULES,
  type BusinessModuleStatus,
} from '@/lib/business/moduleCatalog';
import { buildBusinessOperatingSystemSnapshot } from '@/lib/business/operatingSystem';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';
const CHAT_URL = process.env.INTERNAL_CHAT_URL || 'http://localhost:4000';

type GenericRecord = Record<string, unknown>;

type ModuleMetric = {
  status: BusinessModuleStatus;
  value: number;
  label: string;
  trend: string;
};

function extractList(payload: unknown): GenericRecord[] {
  if (Array.isArray(payload)) return payload as GenericRecord[];
  if (payload && typeof payload === 'object') {
    const obj = payload as GenericRecord;
    const candidates = [
      obj.data,
      obj.items,
      obj.results,
      obj.transactions,
      obj.contents,
      obj.leads,
      obj.tickets,
      obj.threads,
    ];

    for (const value of candidates) {
      if (Array.isArray(value)) return value as GenericRecord[];
    }
  }
  return [];
}

function normalizeStatus(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase();
}

function normalizeNumber(raw: unknown): number {
  const parsed = Number(raw ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

function normalizeTimestamp(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number' && Number.isFinite(raw))
    return new Date(raw).toISOString();
  return '';
}

function isWithinDays(value: string, days: number): boolean {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const diffMs = Date.now() - parsed.getTime();
  return diffMs >= 0 && diffMs <= days * 86_400_000;
}

function isActiveTransaction(status: string): boolean {
  return new Set([
    'pending',
    'accepted',
    'in_progress',
    'processing',
    'funded',
    'awaiting_funding',
    'awaiting_delivery',
    'delivering',
    'disputed',
  ]).has(status);
}

function isOpenSupport(status: string): boolean {
  return new Set(['open', 'in_progress', 'pending_customer']).has(status);
}

function isPublishedContent(status: string): boolean {
  return new Set(['published', 'active', 'live', 'approved']).has(status);
}

async function fetchListFromUpstream(
  url: string,
  token: string,
  timeoutMs = 3500,
): Promise<{ ok: boolean; items: GenericRecord[] }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!res.ok) {
      return { ok: false, items: [] };
    }

    const payload = await res.json().catch(() => ({}));
    return { ok: true, items: extractList(payload) };
  } catch {
    return { ok: false, items: [] };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchObjectFromUpstream(
  url: string,
  token: string,
  timeoutMs = 3500,
): Promise<{ ok: boolean; data: GenericRecord | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!res.ok) {
      return { ok: false, data: null };
    }

    const payload = (await res.json().catch(() => null)) as unknown;
    return {
      ok: Boolean(payload && typeof payload === 'object'),
      data:
        payload && typeof payload === 'object'
          ? (payload as GenericRecord)
          : null,
    };
  } catch {
    return { ok: false, data: null };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const ip = getClientIp(req);
  const rateLimit = await enforceRateLimit({
    key: `business-os:overview:${auth.ctx.userId}:${ip}`,
    limit: 120,
    windowSeconds: 60,
  });
  if (!rateLimit.ok) return rateLimit.response;

  const token = auth.ctx.token;

  const [
    contentResult,
    transactionResult,
    leadResult,
    supportResult,
    inboxResult,
    aiOsResult,
  ] = await Promise.all([
    fetchListFromUpstream(
      `${MARKETPLACE_URL}/v1/content?limit=200&offset=0`,
      token,
    ),
    fetchListFromUpstream(
      `${MARKETPLACE_URL}/v1/transactions?limit=200&offset=0`,
      token,
    ),
    fetchListFromUpstream(
      `${MARKETPLACE_URL}/v1/crm/leads?limit=200&offset=0`,
      token,
    ),
    fetchListFromUpstream(
      `${MARKETPLACE_URL}/v1/support/tickets?limit=200&offset=0`,
      token,
    ),
    fetchListFromUpstream(`${CHAT_URL}/api/v1/inbox?limit=100`, token),
    fetchObjectFromUpstream(`${MARKETPLACE_URL}/v1/ai-os/overview`, token),
  ]);

  const contentItems = contentResult.items;
  const transactionItems = transactionResult.items;
  const leadItems = leadResult.items;
  const supportItems = supportResult.items;
  const inboxRooms = inboxResult.items;

  const activeTransactions = transactionItems.filter(item =>
    isActiveTransaction(normalizeStatus(item.status)),
  ).length;
  const activeLeads = leadItems.filter(
    item =>
      !new Set(['won', 'lost', 'closed']).has(
        normalizeStatus(item.stage ?? item.status),
      ),
  ).length;
  const openSupportTickets = supportItems.filter(item =>
    isOpenSupport(normalizeStatus(item.status)),
  ).length;
  const publishedContent = contentItems.filter(item =>
    isPublishedContent(normalizeStatus(item.status)),
  ).length;
  const unreadMessages = inboxRooms.reduce((sum, room) => {
    return sum + Math.max(0, Math.floor(normalizeNumber(room.unread_count)));
  }, 0);

  const weeklyContent = contentItems.filter(item =>
    isWithinDays(normalizeTimestamp(item.created_at ?? item.updated_at), 7),
  ).length;
  const weeklyTransactions = transactionItems.filter(item =>
    isWithinDays(normalizeTimestamp(item.created_at ?? item.updated_at), 7),
  ).length;
  const weeklyLeads = leadItems.filter(item =>
    isWithinDays(normalizeTimestamp(item.created_at ?? item.updated_at), 7),
  ).length;
  const weeklyThroughput = weeklyContent + weeklyTransactions + weeklyLeads;

  const moduleMetrics: Record<string, ModuleMetric> = Object.fromEntries(
    BUSINESS_MODULES.map(module => [
      module.slug,
      {
        status: module.status,
        value: 0,
        label: 'No live metric',
        trend: 'stable',
      },
    ]),
  );

  moduleMetrics.crm = {
    status: activeLeads > 0 ? 'live' : 'partial',
    value: activeLeads,
    label: 'Active leads',
    trend: activeLeads > 15 ? 'rising' : 'stable',
  };
  moduleMetrics.erp = {
    status: activeTransactions > 0 ? 'live' : 'partial',
    value: activeTransactions,
    label: 'Open transactions',
    trend: activeTransactions > 20 ? 'busy' : 'stable',
  };
  moduleMetrics.cms = {
    status: publishedContent > 0 ? 'partial' : 'planned',
    value: publishedContent,
    label: 'Published content',
    trend: publishedContent > 30 ? 'growing' : 'steady',
  };
  moduleMetrics.kms = {
    status: unreadMessages > 0 ? 'live' : 'partial',
    value: unreadMessages,
    label: 'Unread conversations',
    trend: unreadMessages > 20 ? 'requires-action' : 'healthy',
  };
  moduleMetrics.dms = {
    status: publishedContent > 0 ? 'partial' : 'planned',
    value: contentItems.length,
    label: 'Managed documents',
    trend: 'stable',
  };
  moduleMetrics.fms = {
    status: activeTransactions > 0 ? 'partial' : 'planned',
    value: activeTransactions,
    label: 'Tracked money flow',
    trend: activeTransactions > 15 ? 'rising' : 'stable',
  };
  moduleMetrics.bi = {
    status: weeklyThroughput > 0 ? 'partial' : 'planned',
    value: weeklyThroughput,
    label: 'Weekly business events',
    trend: weeklyThroughput > 25 ? 'active' : 'building',
  };
  moduleMetrics.cdp = {
    status: activeLeads > 0 || unreadMessages > 0 ? 'partial' : 'planned',
    value: activeLeads + unreadMessages,
    label: 'Customer touchpoints',
    trend: 'expanding',
  };
  moduleMetrics.pim = {
    status: contentItems.length > 0 ? 'live' : 'partial',
    value: contentItems.length,
    label: 'Catalog items',
    trend: contentItems.length > 50 ? 'scaled' : 'growing',
  };
  moduleMetrics.pos = {
    status: activeTransactions > 0 ? 'partial' : 'planned',
    value: activeTransactions,
    label: 'Checkout operations',
    trend: 'stable',
  };
  moduleMetrics.hris = {
    status: leadItems.length > 0 ? 'partial' : 'planned',
    value: leadItems.length,
    label: 'Talent pipeline records',
    trend: 'building',
  };
  moduleMetrics.lms = {
    status: 'partial',
    value: weeklyLeads,
    label: 'Learning linked opportunities',
    trend: 'steady',
  };
  moduleMetrics.pms = {
    status: transactionItems.length > 0 ? 'live' : 'partial',
    value: weeklyTransactions,
    label: 'Weekly execution load',
    trend: weeklyTransactions > 10 ? 'high' : 'normal',
  };
  moduleMetrics.ma = {
    status: activeLeads > 0 ? 'partial' : 'planned',
    value: activeLeads,
    label: 'Campaign-ready leads',
    trend: 'stable',
  };
  moduleMetrics.eam = {
    status: 'partial',
    value: supportItems.length,
    label: 'Asset-facing tickets',
    trend: 'stable',
  };
  moduleMetrics.tms = {
    status: transactionItems.length > 0 ? 'partial' : 'planned',
    value: Math.max(0, activeTransactions - openSupportTickets),
    label: 'Shipment candidates',
    trend: 'building',
  };
  moduleMetrics.scm = {
    status: 'planned',
    value: 0,
    label: 'Supplier network map',
    trend: 'blueprint',
  };
  moduleMetrics.wms = {
    status: 'planned',
    value: 0,
    label: 'Warehouse orchestration',
    trend: 'blueprint',
  };
  moduleMetrics.mes = {
    status: 'planned',
    value: 0,
    label: 'Factory telemetry',
    trend: 'blueprint',
  };
  moduleMetrics.plm = {
    status: publishedContent > 0 ? 'partial' : 'planned',
    value: publishedContent,
    label: 'Lifecycle-managed products',
    trend: 'building',
  };

  const overview = {
    active_transactions: activeTransactions,
    unread_messages: unreadMessages,
    active_leads: activeLeads,
    open_support_tickets: openSupportTickets,
    published_content: publishedContent,
    weekly_throughput: weeklyThroughput,
  };

  const response = {
    generated_at: new Date().toISOString(),
    overview,
    ai_os: aiOsResult.ok
      ? aiOsResult.data
      : {
          unavailable: true,
          reason: 'AI OS overview needs agent access or marketplace support',
        },
    module_metrics: moduleMetrics,
    operating_system: buildBusinessOperatingSystemSnapshot({
      overview,
      moduleMetrics,
    }),
    flow_recommendations: [
      {
        id: 'flow-revenue',
        status: 'high-priority',
        title: 'Lead to revenue flow',
        description:
          'Capture lead in CRM, close via chat, and execute via transactions.',
        steps: [
          'Capture inbound lead from chat/support in CRM',
          'Qualify, negotiate, and send offer in chat',
          'Lock commitment in transaction and monitor progress',
        ],
        href: '/crm',
      },
      {
        id: 'flow-support',
        status: 'operational',
        title: 'Support to retention flow',
        description:
          'Resolve support issues fast and feed insights into knowledge base.',
        steps: [
          'Triage open support queue by urgency',
          'Handle case in chat and update ticket status',
          'Publish reusable solution in forum knowledge base',
        ],
        href: '/support',
      },
      {
        id: 'flow-growth',
        status: 'growth',
        title: 'Catalog to growth flow',
        description:
          'Strengthen listings and measure business momentum in analytics.',
        steps: [
          'Standardize listing data in CMS/PIM',
          'Publish and optimize product content',
          'Review conversion and throughput in analytics',
        ],
        href: '/dashboard',
      },
    ],
    security_guardrails: [
      'JWT-gated aggregation endpoint with server-side auth validation',
      'Leaky-bucket rate limiting per user and IP for API stability',
      'Role-oriented module routing through app-level auth guard',
      'Support and transaction workflows designed with status integrity checks',
    ],
    performance_guardrails: [
      'Parallel upstream calls with timeout to prevent slow dependency lock',
      'Compact payload shape for dashboard-first rendering',
      'Short-lived cache headers to reduce repeated heavy fan-out',
      'Graceful partial-data fallback when one upstream service is unavailable',
    ],
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'private, max-age=20, stale-while-revalidate=40',
    },
  });
}
