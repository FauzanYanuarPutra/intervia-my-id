import { NextRequest, NextResponse } from 'next/server';
import { appendFile, mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';

export const runtime = 'nodejs';

const AI_LEARNING_ENABLED = process.env.AI_LEARNING_ENABLED !== 'false';
const AI_LEARNING_LOG_DIR =
  process.env.AI_LEARNING_LOG_DIR ||
  (process.env.NODE_ENV === 'production'
    ? '/tmp/lajukan-ai-learning'
    : path.join(process.cwd(), '../../.runtime/ai-learning'));
const AI_LEARNING_MEMORY_FILE =
  process.env.AI_LEARNING_MEMORY_FILE ||
  path.join(AI_LEARNING_LOG_DIR, 'create-from-image-memory.json');

type AiImageLearningMemory = {
  version: 1;
  updated_at: string;
  categories: Record<
    string,
    {
      total_feedback: number;
      accurate: number;
      needs_fix: number;
      applied_fields: Record<string, number>;
      corrected_fields: Record<string, number>;
      last_updated: string;
    }
  >;
};

function cleanText(value: unknown, maxLength = 1000) {
  return typeof value === 'string'
    ? value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function cleanStringList(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => cleanText(item, 120))
    .filter(Boolean)
    .slice(0, limit);
}

function cleanRecord(value: unknown, limit = 24): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value).slice(0, limit)) {
    const cleanKey = cleanText(key, 80);
    const cleanValue = cleanText(item, 1000);
    if (cleanKey && cleanValue) result[cleanKey] = cleanValue;
  }
  return result;
}

function buildMemoryKey(input: {
  locale: string;
  side: string;
  categoryTitle: string;
}) {
  const locale = input.locale === 'en' ? 'en' : 'id';
  const side = input.side.trim().toLowerCase() || 'unknown';
  const category = input.categoryTitle.trim().toLowerCase() || 'unknown';
  return `${locale}|${side}|${category}`;
}

function createEmptyMemory(): AiImageLearningMemory {
  return {
    version: 1,
    updated_at: new Date().toISOString(),
    categories: {},
  };
}

async function readLearningMemory(): Promise<AiImageLearningMemory> {
  try {
    const raw = await readFile(AI_LEARNING_MEMORY_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AiImageLearningMemory>;
    if (!parsed || parsed.version !== 1 || !parsed.categories) {
      return createEmptyMemory();
    }
    return {
      version: 1,
      updated_at: cleanText(parsed.updated_at, 40) || new Date().toISOString(),
      categories: parsed.categories,
    };
  } catch {
    return createEmptyMemory();
  }
}

function incrementCount(target: Record<string, number>, key: string) {
  const cleanKey = cleanText(key, 80);
  if (!cleanKey) return;
  target[cleanKey] = (target[cleanKey] || 0) + 1;
}

async function updateLearningMemory(input: {
  locale: string;
  side: string;
  categoryTitle: string;
  review: 'accurate' | 'needs_fix';
  appliedFieldKeys: string[];
  finalValues: Record<string, string>;
}) {
  if (!AI_LEARNING_ENABLED) return;
  await mkdir(AI_LEARNING_LOG_DIR, { recursive: true });
  const now = new Date().toISOString();
  const memory = await readLearningMemory();
  const memoryKey = buildMemoryKey(input);
  const category =
    memory.categories[memoryKey] ||
    {
      total_feedback: 0,
      accurate: 0,
      needs_fix: 0,
      applied_fields: {},
      corrected_fields: {},
      last_updated: now,
    };

  category.total_feedback += 1;
  category[input.review] += 1;
  category.last_updated = now;

  for (const key of input.appliedFieldKeys) {
    incrementCount(category.applied_fields, key);
  }
  if (input.review === 'needs_fix') {
    for (const key of Object.keys(input.finalValues)) {
      incrementCount(category.corrected_fields, key);
    }
  }

  memory.updated_at = now;
  memory.categories[memoryKey] = category;
  await writeFile(AI_LEARNING_MEMORY_FILE, `${JSON.stringify(memory, null, 2)}\n`, 'utf8');
}

async function appendLearningEvent(event: Record<string, unknown>) {
  if (!AI_LEARNING_ENABLED) return;
  await mkdir(AI_LEARNING_LOG_DIR, { recursive: true });
  const dateKey = new Date().toISOString().slice(0, 10);
  const filePath = path.join(AI_LEARNING_LOG_DIR, `create-from-image-feedback-${dateKey}.jsonl`);
  await appendFile(filePath, `${JSON.stringify(event)}\n`, 'utf8');
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const ip = getClientIp(req.headers);
    const rate = await enforceRateLimit({
      key: `rl:ai:create-from-image-feedback:${auth.ctx.userId}:${ip}`,
      limit: 60,
      windowSeconds: 3600,
      message: 'Too many AI feedback requests. Please retry later.',
    });
    if (!rate.ok) return rate.response;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const review = body.review === 'accurate' ? 'accurate' : 'needs_fix';
    const eventId = cleanText(body.event_id, 80);
    if (!eventId) {
      return NextResponse.json({ error: 'event_id is required.' }, { status: 400 });
    }

    const locale = cleanText(body.locale, 8) === 'en' ? 'en' : 'id';
    const side = cleanText(body.side, 40);
    const categoryTitle = cleanText(body.category_title, 120);
    const appliedFieldKeys = cleanStringList(body.applied_field_keys, 24);
    const finalValues = cleanRecord(body.final_values);

    await appendLearningEvent({
      event_name: 'ai.create_from_image.feedback',
      occurred_at: new Date().toISOString(),
      user_id: auth.ctx.userId,
      source_event_id: eventId,
      review,
      locale,
      side,
      category_title: categoryTitle,
      provider: cleanText(body.provider, 80),
      model: cleanText(body.model, 120),
      readable: body.readable === true,
      confidence: typeof body.confidence === 'number' ? body.confidence : null,
      applied_field_keys: appliedFieldKeys,
      final_values: finalValues,
      suggested_fields: cleanRecord(body.suggested_fields),
      correction_note: cleanText(body.correction_note, 600),
    });
    await updateLearningMemory({
      locale,
      side,
      categoryTitle,
      review,
      appliedFieldKeys,
      finalValues,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.warn(
      '[CREATE_FROM_IMAGE_FEEDBACK_ERROR]',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ ok: true, degraded: true });
  }
}
