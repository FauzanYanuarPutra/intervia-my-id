'use client';

import {
  normalizeLajukanEventName,
  sanitizeLajukanEventRecord,
} from '@/lib/analytics/eventCatalog';

export type LajukanEventInput = {
  eventId?: string;
  occurredAt?: string;
  anonymousId?: string;
  sessionId?: string;
  tenantId?: string;
  locale?: string;
  source?: string;
  page?: string;
  entityType?: string;
  entityId?: string;
  properties?: Record<string, unknown>;
  context?: Record<string, unknown>;
};

const ANONYMOUS_ID_KEY = 'lajukan:anonymous-id:v1';
const SESSION_ID_KEY = 'lajukan:session-id:v1';
const SESSION_STARTED_AT_KEY = 'lajukan:session-started-at:v1';
const SESSION_TTL_MS = 30 * 60 * 1000;

function makeId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${random}`;
}

function getOrCreateStorageValue(key: string, prefix: string): string {
  if (typeof window === 'undefined') return makeId(prefix);

  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;

    const next = makeId(prefix);
    window.localStorage.setItem(key, next);
    return next;
  } catch {
    return makeId(prefix);
  }
}

export function getLajukanAnonymousId(): string {
  return getOrCreateStorageValue(ANONYMOUS_ID_KEY, 'anon');
}

export function getLajukanSessionId(): string {
  if (typeof window === 'undefined') return makeId('session');

  try {
    const now = Date.now();
    const startedAt = Number(window.sessionStorage.getItem(SESSION_STARTED_AT_KEY) || '0');
    const existing = window.sessionStorage.getItem(SESSION_ID_KEY);

    if (existing && startedAt && now - startedAt < SESSION_TTL_MS) {
      window.sessionStorage.setItem(SESSION_STARTED_AT_KEY, String(now));
      return existing;
    }

    const next = makeId('session');
    window.sessionStorage.setItem(SESSION_ID_KEY, next);
    window.sessionStorage.setItem(SESSION_STARTED_AT_KEY, String(now));
    return next;
  } catch {
    return makeId('session');
  }
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem('access_token');
  } catch {
    return null;
  }
}

function resolveLocale(page?: string): string {
  const source = page || (typeof window !== 'undefined' ? window.location.pathname : '');
  const segment = source.split('/').filter(Boolean)[0];
  return segment || 'id';
}

export async function trackLajukanEvent(
  eventName: string,
  input: LajukanEventInput = {},
): Promise<void> {
  if (typeof window === 'undefined') return;

  const page = input.page || `${window.location.pathname}${window.location.search}`;
  const payload = {
    event_id: input.eventId,
    event_name: normalizeLajukanEventName(eventName),
    occurred_at: input.occurredAt || new Date().toISOString(),
    anonymous_id: input.anonymousId || getLajukanAnonymousId(),
    session_id: input.sessionId || getLajukanSessionId(),
    tenant_id: input.tenantId || 'default',
    locale: input.locale || resolveLocale(page),
    source: input.source || 'web',
    page,
    entity_type: input.entityType,
    entity_id: input.entityId,
    properties: sanitizeLajukanEventRecord(input.properties),
    context: {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      referrer: document.referrer || undefined,
      ...sanitizeLajukanEventRecord(input.context),
    },
  };

  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    await fetch('/api/events', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Analytics must never block the user flow.
  }
}
