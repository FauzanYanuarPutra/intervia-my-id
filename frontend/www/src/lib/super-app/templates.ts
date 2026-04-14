import crypto from 'node:crypto';
import { getRedis } from '@/lib/redis';
import type { SuperAppService } from '@/lib/super-app/dispatch';

export type SuperAppOrderTemplate = {
  id: string;
  name: string;
  service: SuperAppService;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_used_at?: string;
  usage_count?: number;
};

const MAX_TEMPLATES = 12;

function templateKey(userId: string): string {
  return `superapp:templates:${userId}`;
}

function normalizeText(value: unknown, maxLen: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function normalizeTemplate(input: Partial<SuperAppOrderTemplate>): SuperAppOrderTemplate {
  const now = new Date().toISOString();
  const service = (input.service || 'ride') as SuperAppService;
  return {
    id: input.id || crypto.randomUUID(),
    name: normalizeText(input.name, 80) || `${service.toUpperCase()} Template`,
    service,
    payload: input.payload && typeof input.payload === 'object' ? input.payload : {},
    created_at: input.created_at || now,
    updated_at: now,
    last_used_at: input.last_used_at,
    usage_count: typeof input.usage_count === 'number' ? input.usage_count : 0,
  };
}

async function loadTemplates(userId: string): Promise<SuperAppOrderTemplate[]> {
  try {
    const redis = getRedis();
    const raw = await redis.get(templateKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SuperAppOrderTemplate[];
    return Array.isArray(parsed)
      ? parsed.map((item) => normalizeTemplate(item)).slice(0, MAX_TEMPLATES)
      : [];
  } catch (error) {
    console.error('[SUPER_APP_TEMPLATES_LOAD_ERROR]', error);
    return [];
  }
}

async function storeTemplates(userId: string, templates: SuperAppOrderTemplate[]): Promise<void> {
  const redis = getRedis();
  const normalized = templates.map((item) => normalizeTemplate(item)).slice(0, MAX_TEMPLATES);
  await redis.set(templateKey(userId), JSON.stringify(normalized));
}

export async function listOrderTemplates(userId: string): Promise<SuperAppOrderTemplate[]> {
  const items = await loadTemplates(userId);
  return items.sort((a, b) => {
    const aTime = a.last_used_at || a.updated_at;
    const bTime = b.last_used_at || b.updated_at;
    return bTime.localeCompare(aTime);
  });
}

export async function getOrderTemplate(
  userId: string,
  templateId: string,
): Promise<SuperAppOrderTemplate | null> {
  const items = await loadTemplates(userId);
  return items.find((item) => item.id === templateId) || null;
}

export async function saveOrderTemplate(
  userId: string,
  input: Partial<SuperAppOrderTemplate>,
): Promise<SuperAppOrderTemplate[]> {
  const templates = await loadTemplates(userId);
  const normalized = normalizeTemplate(input);
  const next = [normalized, ...templates.filter((item) => item.id !== normalized.id)];
  await storeTemplates(userId, next);
  return listOrderTemplates(userId);
}

export async function deleteOrderTemplate(
  userId: string,
  templateId: string,
): Promise<SuperAppOrderTemplate[]> {
  const templates = await loadTemplates(userId);
  const next = templates.filter((item) => item.id !== templateId);
  await storeTemplates(userId, next);
  return listOrderTemplates(userId);
}

export async function touchOrderTemplateUsed(
  userId: string,
  templateId: string,
): Promise<void> {
  const templates = await loadTemplates(userId);
  const next = templates.map((item) => {
    if (item.id !== templateId) return item;
    return {
      ...item,
      last_used_at: new Date().toISOString(),
      usage_count: (item.usage_count || 0) + 1,
    };
  });
  await storeTemplates(userId, next);
}
