import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { appendFile, mkdir, readFile } from 'fs/promises';
import path from 'path';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';

export const runtime = 'nodejs';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const AI_VISION_MODEL =
  process.env.AI_VISION_MODEL || process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';
const IMAGE_AI_ASSIST_ENABLED =
  process.env.IMAGE_AI_ASSIST_ENABLED === 'true' ||
  process.env.NEXT_PUBLIC_IMAGE_AI_ASSIST_ENABLED === 'true';
const USE_OLLAMA = process.env.USE_OLLAMA === 'true';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_VISION_MODEL =
  process.env.OLLAMA_VISION_MODEL ||
  process.env.OLLAMA_MODEL ||
  'moondream:latest';
const OLLAMA_KEEP_ALIVE = cleanOllamaDuration(
  process.env.OLLAMA_KEEP_ALIVE,
  '10m',
);
const INTERNAL_AI_URL =
  process.env.INTERNAL_AI_URL || process.env.AI_SERVICE_URL || '';
const AI_SERVICE_TOKEN = process.env.AI_SERVICE_TOKEN || '';
const AI_LEARNING_ENABLED = process.env.AI_LEARNING_ENABLED !== 'false';
const AI_LEARNING_LOG_DIR =
  process.env.AI_LEARNING_LOG_DIR ||
  (process.env.NODE_ENV === 'production'
    ? '/tmp/lajukan-ai-learning'
    : path.join(process.cwd(), '../../.runtime/ai-learning'));
const AI_LEARNING_MEMORY_FILE =
  process.env.AI_LEARNING_MEMORY_FILE ||
  path.join(AI_LEARNING_LOG_DIR, 'create-from-image-memory.json');
const OLLAMA_VISION_TIMEOUT_MS = cleanTimeout(
  process.env.OLLAMA_VISION_TIMEOUT_MS,
  45000,
);
const INTERNAL_VISION_TIMEOUT_MS = cleanTimeout(
  process.env.INTERNAL_VISION_TIMEOUT_MS,
  45000,
);
const OPENAI_VISION_TIMEOUT_MS = cleanTimeout(
  process.env.OPENAI_VISION_TIMEOUT_MS,
  45000,
);
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type AiFieldSuggestion = {
  key: string;
  value: string;
  confidence: number;
  reason?: string;
};

type AiImageDraft = {
  readable: boolean;
  confidence: number;
  fields: AiFieldSuggestion[];
  notes?: string;
  warnings: string[];
  questions: string[];
};

type AiImageResponse = AiImageDraft & {
  model: string;
  provider: string;
  fallback?: boolean;
  provider_errors?: string[];
  learning_event_id?: string;
};

function cleanTimeout(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(3000, Math.min(95000, Math.round(parsed)));
}

function cleanOllamaDuration(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  if (/^(0|[1-9]\d*(ms|s|m|h))$/i.test(trimmed)) return trimmed;
  return fallback;
}

function cleanText(value: unknown, maxLength = 1000): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanNumber(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

function cleanList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const items: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const text = cleanText(item, 260);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    items.push(text);
    if (items.length >= limit) break;
  }
  return items;
}

function extractJsonObject(value: string): Record<string, unknown> | null {
  const direct = value.trim();
  const fenced =
    direct.match(/```json\s*([\s\S]+?)```/i)?.[1] ||
    direct.match(/```([\s\S]+?)```/i)?.[1] ||
    '';
  const candidates = [direct, fenced].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try brace slicing below.
    }
  }

  const firstBrace = direct.indexOf('{');
  const lastBrace = direct.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(direct.slice(firstBrace, lastBrace + 1)) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function sanitizeFields(
  value: unknown,
  allowedKeys: Set<string>,
): AiFieldSuggestion[] {
  if (!Array.isArray(value)) return [];
  const result: AiFieldSuggestion[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const key = cleanText(record.key, 80);
    const valueText = cleanText(record.value, 900);
    if (!key || !valueText || !allowedKeys.has(key) || seen.has(key)) continue;
    const confidence = cleanNumber(record.confidence);
    if (confidence < 0.52) continue;
    seen.add(key);
    result.push({
      key,
      value: valueText,
      confidence,
      reason: cleanText(record.reason, 220) || undefined,
    });
    if (result.length >= 12) break;
  }

  return result;
}

function sanitizeDraftRecord(
  parsed: Record<string, unknown>,
  allowedKeys: Set<string>,
): AiImageDraft {
  return {
    readable: parsed.readable === true,
    confidence: cleanNumber(parsed.confidence),
    fields: sanitizeFields(parsed.fields, allowedKeys),
    notes: cleanText(parsed.notes, 1200) || undefined,
    warnings: cleanList(parsed.warnings, 5),
    questions: cleanList(parsed.questions, 5),
  };
}

function sanitizeDraft(rawText: string, allowedKeys: Set<string>): AiImageDraft | null {
  const parsed = extractJsonObject(rawText);
  if (!parsed) return null;
  return sanitizeDraftRecord(parsed, allowedKeys);
}

function sanitizeDraftPayload(
  payload: unknown,
  allowedKeys: Set<string>,
): AiImageDraft | null {
  if (typeof payload === 'string') return sanitizeDraft(payload, allowedKeys);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const nested = record.data;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return sanitizeDraftPayload(nested, allowedKeys);
  }
  return sanitizeDraftRecord(record, allowedKeys);
}

function getBusinessVisionHints(locale: 'id' | 'en', categoryTitle: string) {
  const isId = locale === 'id';
  const normalizedCategory = categoryTitle.toLowerCase();
  const equipmentHints = [
    'cup sealer',
    'freezer',
    'showcase chiller',
    'mesin kopi',
    'grinder kopi',
    'mixer roti',
    'oven',
    'vacuum sealer',
    'timbangan digital',
    'mesin kasir',
    'rak minimarket',
    'etalase',
    'booth',
    'meja stainless',
    'mesin jahit',
    'mesin sablon',
    'mesin press',
    'kompor',
    'deep fryer',
    'blender',
  ];
  const packagingHints = [
    'cup plastik',
    'botol',
    'standing pouch',
    'paper bowl',
    'box makanan',
    'sedotan',
    'label stiker',
    'plastik vacuum',
    'karung',
    'bubble wrap',
  ];
  const supplyHints = [
    'tepung',
    'gula',
    'bumbu',
    'biji kopi',
    'bubuk minuman',
    'susu evaporasi',
    'frozen food',
    'coklat',
    'minyak',
    'saus',
  ];
  const serviceHints = [
    'desain logo',
    'foto produk',
    'banner',
    'booth',
    'instalasi',
    'servis mesin',
    'rental alat',
    'jasa kirim',
  ];

  const relevant = normalizedCategory.match(/mesin|alat|equipment|tool/)
    ? equipmentHints
    : normalizedCategory.match(/kemasan|packaging/)
      ? packagingHints
      : normalizedCategory.match(/bahan|supply|ingredient/)
        ? supplyHints
        : normalizedCategory.match(/jasa|service/)
          ? serviceHints
          : [...equipmentHints.slice(0, 10), ...packagingHints.slice(0, 7), ...supplyHints.slice(0, 7)];

  return [
    isId
      ? 'Fokus domain Lajukan: kebutuhan usaha Indonesia, bukan semua benda umum.'
      : 'Lajukan domain focus: Indonesian business needs, not every generic object.',
    isId
      ? `Kandidat kategori/objek yang sering muncul: ${relevant.join(', ')}.`
      : `Frequent object/category candidates: ${relevant.join(', ')}.`,
    isId
      ? 'Gunakan ciri visual: bentuk, tombol/tuas, tabung, rak, kaca, kabel, pemanas, label merek, kapasitas, watt, ukuran, dan teks di foto.'
      : 'Use visual cues: shape, buttons/levers, tanks, racks, glass, cables, heaters, brand labels, capacity, watts, dimensions, and text in the photo.',
    isId
      ? 'Jika mirip tetapi tidak pasti, pakai frasa "Kemungkinan ..." dan confidence sedang. Jangan isi merek/model/harga jika tidak terbaca.'
      : 'If similar but uncertain, use "Likely ..." and medium confidence. Do not fill brand/model/price unless readable.',
    isId
      ? 'Contoh: foto alat dengan tuas dan plat pemanas untuk cup plastik -> Nama mesin / alat: Cup sealer; Spesifikasi penting: mesin penutup cup minuman; Kondisi / status alat hanya diisi jika tampak jelas.'
      : 'Example: a tool with lever and heated plate for plastic cups -> equipment name: Cup sealer; specification: drink cup sealing machine; condition only if visible.',
    isId
      ? 'Contoh: foto kotak/kabinet kaca pendingin -> Nama mesin / alat: Showcase chiller atau freezer display, tanyakan kapasitas/listrik jika tidak terbaca.'
      : 'Example: glass cooling cabinet -> equipment name: Showcase chiller or display freezer, ask for capacity/power if unreadable.',
  ].join('\n');
}

function buildInstruction(input: {
  locale: 'id' | 'en';
  side: string;
  categoryTitle: string;
  fields: Array<{ key: string; label: string; placeholder?: string; required?: boolean }>;
  learningHints?: string;
}) {
  const fieldLines = input.fields
    .map(field =>
      [
        `- ${field.key}: ${field.label}`,
        field.required ? '(required)' : '',
        field.placeholder ? `example hint: ${field.placeholder}` : '',
      ]
        .filter(Boolean)
        .join(' '),
    )
    .join('\n');

  return [
    input.locale === 'id'
      ? 'Kamu membantu user Lajukan mengisi form listing dari foto. Foto bisa berisi produk, alat usaha, bahan, tempat usaha, poster jasa, brosur, menu, kemasan, atau catatan.'
      : 'You help a Lajukan user fill a listing form from an image. The image may show a product, business tool, supply, place, service poster, brochure, menu, packaging, or note.',
    input.locale === 'id'
      ? 'Jangan menebak berlebihan. Isi field hanya jika terlihat jelas atau sangat masuk akal dari teks/objek di foto. Kalau tidak yakin, jangan isi field itu; taruh pertanyaan di questions.'
      : 'Do not over-guess. Fill a field only when it is clearly visible or strongly supported by text/objects in the image. If uncertain, do not fill the field; put a question in questions.',
    input.locale === 'id'
      ? 'Jangan membuat nomor telepon, harga, lokasi, ukuran, merek, legalitas, stok, atau klaim kualitas jika tidak terbaca jelas.'
      : 'Do not invent phone numbers, prices, locations, dimensions, brands, permits, stock, or quality claims unless clearly readable.',
    `Listing side: ${input.side || 'unknown'}`,
    `Category: ${input.categoryTitle || 'unknown'}`,
    '',
    getBusinessVisionHints(input.locale, input.categoryTitle),
    '',
    'Allowed form fields:',
    fieldLines,
    input.learningHints ? `\nLocal feedback memory:\n${input.learningHints}` : '',
    '',
    'Return valid JSON only with this schema:',
    '{',
    '  "readable": true,',
    '  "confidence": 0.0,',
    '  "fields": [',
    '    { "key": "allowed_field_key", "value": "suggested value", "confidence": 0.0, "reason": "short reason" }',
    '  ],',
    '  "notes": "optional extra note that can help the listing",',
    '  "warnings": ["unclear image, unreadable price, etc"],',
    '  "questions": ["ask user to confirm missing/uncertain data"]',
    '}',
  ].join('\n');
}

function trimBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function buildMemoryKey(input: {
  locale: 'id' | 'en';
  side: string;
  categoryTitle: string;
}) {
  const category = input.categoryTitle.trim().toLowerCase() || 'unknown';
  const side = input.side.trim().toLowerCase() || 'unknown';
  return `${input.locale}|${side}|${category}`;
}

function pickTopFields(
  counts: Record<string, unknown> | undefined,
  allowedKeys: Set<string>,
  limit: number,
) {
  if (!counts) return [];
  return Object.entries(counts)
    .map(([key, value]) => ({
      key,
      count: typeof value === 'number' ? value : Number(value),
    }))
    .filter(item => allowedKeys.has(item.key) && Number.isFinite(item.count) && item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(item => item.key);
}

async function loadLearningPromptHints(input: {
  locale: 'id' | 'en';
  side: string;
  categoryTitle: string;
  fields: Array<{ key: string; label: string }>;
}) {
  if (!AI_LEARNING_ENABLED) return '';
  try {
    const raw = await readFile(AI_LEARNING_MEMORY_FILE, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return '';
    const categories = (parsed as Record<string, unknown>).categories;
    if (!categories || typeof categories !== 'object' || Array.isArray(categories)) return '';

    const key = buildMemoryKey(input);
    const memory = (categories as Record<string, unknown>)[key];
    if (!memory || typeof memory !== 'object' || Array.isArray(memory)) return '';

    const memoryRecord = memory as Record<string, unknown>;
    const allowedKeys = new Set(input.fields.map(field => field.key));
    const labelByKey = new Map(input.fields.map(field => [field.key, field.label]));
    const confirmed = pickTopFields(
      memoryRecord.applied_fields as Record<string, unknown> | undefined,
      allowedKeys,
      4,
    );
    const corrected = pickTopFields(
      memoryRecord.corrected_fields as Record<string, unknown> | undefined,
      allowedKeys,
      4,
    );
    const total = Number(memoryRecord.total_feedback || 0);
    if (!confirmed.length && !corrected.length) return '';

    const toLabels = (keys: string[]) =>
      keys.map(fieldKey => labelByKey.get(fieldKey) || fieldKey).join(', ');

    const lines: string[] = [];
    if (confirmed.length) {
      lines.push(
        input.locale === 'id'
          ? `Field yang sering dikonfirmasi benar: ${toLabels(confirmed)}.`
          : `Fields often confirmed as correct: ${toLabels(confirmed)}.`,
      );
    }
    if (corrected.length) {
      lines.push(
        input.locale === 'id'
          ? `Field yang sering perlu koreksi pengguna: ${toLabels(corrected)}. Untuk field ini, lebih konservatif dan tanyakan jika kurang jelas.`
          : `Fields often corrected by users: ${toLabels(corrected)}. Be more conservative on these and ask when unclear.`,
      );
    }
    if (Number.isFinite(total) && total >= 5) {
      lines.push(
        input.locale === 'id'
          ? `Sinyal ini berasal dari ${Math.min(total, 999)} feedback lokal. Jangan mengisi data jika tidak terlihat jelas.`
          : `This signal comes from ${Math.min(total, 999)} local feedback events. Do not fill data unless clearly visible.`,
      );
    }
    return lines.join('\n');
  } catch {
    return '';
  }
}

function buildLearningEventId() {
  return crypto.randomUUID();
}

async function appendLearningEvent(event: Record<string, unknown>) {
  if (!AI_LEARNING_ENABLED) return;
  try {
    await mkdir(AI_LEARNING_LOG_DIR, { recursive: true });
    const dateKey = new Date().toISOString().slice(0, 10);
    const filePath = path.join(AI_LEARNING_LOG_DIR, `create-from-image-${dateKey}.jsonl`);
    await appendFile(filePath, `${JSON.stringify(event)}\n`, 'utf8');
  } catch (error) {
    console.warn(
      '[CREATE_FROM_IMAGE_LEARNING_LOG_ERROR]',
      error instanceof Error ? error.message : error,
    );
  }
}

function buildSafeFallbackDraft(input: {
  locale: 'id' | 'en';
  categoryTitle: string;
  fields: Array<{ key: string; label: string; required?: boolean }>;
  providerErrors: string[];
}): AiImageResponse {
  const requiredLabels = input.fields
    .filter(field => field.required)
    .map(field => field.label)
    .slice(0, 4);
  const isId = input.locale === 'id';

  return {
    readable: false,
    confidence: 0,
    fields: [],
    warnings: [
      isId
        ? 'AI belum bisa membaca foto ini dengan aman, jadi tidak ada field yang diisi otomatis.'
        : 'AI could not safely read this photo, so no fields were auto-filled.',
      isId
        ? 'Gunakan foto yang lebih terang, dekat, tidak blur, dan tampilkan teks/spesifikasi alat jika ada.'
        : 'Use a brighter, closer, non-blurry photo and show any text/specification when available.',
    ],
    questions: requiredLabels.length
      ? [
        isId
          ? `Mohon isi manual field wajib: ${requiredLabels.join(', ')}.`
          : `Please fill required fields manually: ${requiredLabels.join(', ')}.`,
      ]
      : [
        isId
          ? `Mohon cek ulang detail ${input.categoryTitle || 'listing'} sebelum publish.`
          : `Please review the ${input.categoryTitle || 'listing'} details before publishing.`,
      ],
    notes: isId
      ? 'Hasil ini tetap disimpan sebagai sinyal belajar agar prompt dan model bisa dievaluasi.'
      : 'This result is still saved as a learning signal for prompt and model evaluation.',
    model: 'safe-fallback-v1',
    provider: 'safe-fallback',
    fallback: true,
    provider_errors: input.providerErrors.slice(0, 4),
  };
}

async function withLearningEvent(input: {
  draft: AiImageResponse;
  eventId: string;
  userId: string;
  imageHash: string;
  imageSize: number;
  imageType: string;
  locale: 'id' | 'en';
  side: string;
  categoryTitle: string;
  fields: Array<{ key: string; label: string; required?: boolean }>;
  providerErrors: string[];
}) {
  const data = {
    ...input.draft,
    learning_event_id: input.eventId,
  };

  await appendLearningEvent({
    event_id: input.eventId,
    event_name: 'ai.create_from_image.generated',
    occurred_at: new Date().toISOString(),
    user_id: input.userId,
    image_hash: input.imageHash,
    image_size: input.imageSize,
    image_type: input.imageType,
    locale: input.locale,
    side: input.side,
    category_title: input.categoryTitle,
    allowed_fields: input.fields.map(field => ({
      key: field.key,
      label: field.label,
      required: Boolean(field.required),
    })),
    provider: data.provider,
    model: data.model,
    readable: data.readable,
    confidence: data.confidence,
    suggested_fields: data.fields,
    warnings: data.warnings,
    questions: data.questions,
    fallback: Boolean(data.fallback),
    provider_errors: input.providerErrors.slice(0, 4),
  });

  return data;
}

async function callOllamaVision(input: {
  imageBase64: string;
  instruction: string;
  allowedKeys: Set<string>;
}): Promise<AiImageResponse> {
  const response = await fetch(`${trimBaseUrl(OLLAMA_URL)}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OLLAMA_VISION_MODEL,
      stream: false,
      format: 'json',
      keep_alive: OLLAMA_KEEP_ALIVE,
      messages: [
        {
          role: 'user',
          content: input.instruction,
          images: [input.imageBase64],
        },
      ],
      options: {
        temperature: 0.05,
        num_ctx: 2048,
        num_predict: 360,
      },
    }),
    signal: AbortSignal.timeout(OLLAMA_VISION_TIMEOUT_MS),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Ollama ${response.status}: ${text.slice(0, 500)}`);
  }

  const payload = (await response.json()) as {
    message?: { content?: string };
    response?: string;
  };
  const text = payload.message?.content || payload.response || '';
  const draft = sanitizeDraft(text, input.allowedKeys);
  if (!draft) throw new Error('Ollama returned unsafe or invalid JSON.');
  return {
    ...draft,
    model: OLLAMA_VISION_MODEL,
    provider: 'ollama',
  };
}

async function callInternalVision(input: {
  imageBase64: string;
  mimeType: string;
  locale: 'id' | 'en';
  side: string;
  categoryTitle: string;
  fields: Array<{ key: string; label: string; placeholder?: string; required?: boolean }>;
  instruction: string;
  allowedKeys: Set<string>;
}): Promise<AiImageResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (AI_SERVICE_TOKEN) {
    headers.Authorization = `Bearer ${AI_SERVICE_TOKEN}`;
  }

  const response = await fetch(`${trimBaseUrl(INTERNAL_AI_URL)}/v1/create-from-image`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      image_base64: input.imageBase64,
      mime_type: input.mimeType,
      locale: input.locale,
      side: input.side,
      category_title: input.categoryTitle,
      fields: input.fields,
      instruction: input.instruction,
    }),
    signal: AbortSignal.timeout(INTERNAL_VISION_TIMEOUT_MS),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Internal AI ${response.status}: ${text.slice(0, 500)}`);
  }

  const payload = (await response.json()) as unknown;
  const draft = sanitizeDraftPayload(payload, input.allowedKeys);
  if (!draft) throw new Error('Internal AI returned unsafe or invalid JSON.');
  return {
    ...draft,
    model: cleanText((payload as Record<string, unknown>)?.model, 80) || 'internal-ai',
    provider: 'internal-ai',
  };
}

async function callOpenAiVision(input: {
  dataUrl: string;
  instruction: string;
  allowedKeys: Set<string>;
}): Promise<AiImageResponse> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_VISION_MODEL,
      temperature: 0.1,
      max_tokens: 900,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: input.instruction },
            {
              type: 'image_url',
              image_url: {
                url: input.dataUrl,
                detail: 'low',
              },
            },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(OPENAI_VISION_TIMEOUT_MS),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`OpenAI ${response.status}: ${text.slice(0, 500)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = payload.choices?.[0]?.message?.content || '';
  const draft = sanitizeDraft(text, input.allowedKeys);
  if (!draft) throw new Error('OpenAI returned unsafe or invalid JSON.');
  return {
    ...draft,
    model: AI_VISION_MODEL,
    provider: 'openai',
  };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    if (!IMAGE_AI_ASSIST_ENABLED) {
      return NextResponse.json(
        {
          error:
            'Bantuan AI baca foto sedang dimatikan sementara agar proses create tetap cepat.',
        },
        { status: 503 },
      );
    }

    const ip = getClientIp(req.headers);
    const rate = await enforceRateLimit({
      key: `rl:ai:create-from-image:${auth.ctx.userId}:${ip}`,
      limit: 12,
      windowSeconds: 3600,
      message: 'Too many image assist requests. Please retry later.',
    });
    if (!rate.ok) return rate.response;

    const formData = await req.formData();
    const image = formData.get('image');
    if (!(image instanceof File)) {
      return NextResponse.json({ error: 'Image file is required.' }, { status: 400 });
    }
    if (!SUPPORTED_IMAGE_TYPES.has(image.type)) {
      return NextResponse.json(
        { error: 'Only JPG, PNG, or WebP images are supported.' },
        { status: 400 },
      );
    }
    if (image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: 'Image is too large. Use an image under 4 MB.' },
        { status: 413 },
      );
    }

    const locale = formData.get('locale') === 'en' ? 'en' : 'id';
    const side = cleanText(formData.get('side'), 40);
    const categoryTitle = cleanText(formData.get('category_title'), 120);
    const rawFields = cleanText(formData.get('fields'), 6000);
    const parsedFields = (() => {
      try {
        return JSON.parse(rawFields || '[]') as unknown;
      } catch {
        return null;
      }
    })();
    const fields = Array.isArray(parsedFields)
      ? parsedFields
        .map(item => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
          const record = item as Record<string, unknown>;
          const key = cleanText(record.key, 80);
          const label = cleanText(record.label, 140);
          if (!key || !label) return null;
          return {
            key,
            label,
            placeholder: cleanText(record.placeholder, 180),
            required: record.required === true,
          };
        })
        .filter(
          (
            item,
          ): item is {
            key: string;
            label: string;
            placeholder: string;
            required: boolean;
          } => Boolean(item),
        )
        .slice(0, 24)
      : [];
    if (fields.length === 0) {
      return NextResponse.json(
        { error: 'Form fields are required for safe extraction.' },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await image.arrayBuffer());
    const eventId = buildLearningEventId();
    const imageHash = crypto.createHash('sha256').update(bytes).digest('hex');
    const imageBase64 = bytes.toString('base64');
    const dataUrl = `data:${image.type};base64,${imageBase64}`;
    const learningHints = await loadLearningPromptHints({
      locale,
      side,
      categoryTitle,
      fields,
    });
    const instruction = buildInstruction({
      locale,
      side,
      categoryTitle,
      fields,
      learningHints,
    });
    const allowedKeys = new Set(fields.map(field => field.key));
    const providerErrors: string[] = [];

    if (USE_OLLAMA) {
      try {
        const draft = await callOllamaVision({
          imageBase64,
          instruction,
          allowedKeys,
        });
        const data = await withLearningEvent({
          draft,
          eventId,
          userId: auth.ctx.userId,
          imageHash,
          imageSize: image.size,
          imageType: image.type,
          locale,
          side,
          categoryTitle,
          fields,
          providerErrors,
        });
        return NextResponse.json({ data });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        providerErrors.push(`ollama: ${message}`);
        console.warn('[CREATE_FROM_IMAGE_OLLAMA_ERROR]', message);
      }
    }

    if (INTERNAL_AI_URL) {
      try {
        const draft = await callInternalVision({
          imageBase64,
          mimeType: image.type,
          locale,
          side,
          categoryTitle,
          fields,
          instruction,
          allowedKeys,
        });
        const data = await withLearningEvent({
          draft,
          eventId,
          userId: auth.ctx.userId,
          imageHash,
          imageSize: image.size,
          imageType: image.type,
          locale,
          side,
          categoryTitle,
          fields,
          providerErrors,
        });
        return NextResponse.json({ data });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        providerErrors.push(`internal: ${message}`);
        console.warn('[CREATE_FROM_IMAGE_INTERNAL_AI_ERROR]', message);
      }
    }

    if (OPENAI_API_KEY) {
      try {
        const draft = await callOpenAiVision({
          dataUrl,
          instruction,
          allowedKeys,
        });
        const data = await withLearningEvent({
          draft,
          eventId,
          userId: auth.ctx.userId,
          imageHash,
          imageSize: image.size,
          imageType: image.type,
          locale,
          side,
          categoryTitle,
          fields,
          providerErrors,
        });
        return NextResponse.json({ data });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        providerErrors.push(`openai: ${message}`);
        console.warn('[CREATE_FROM_IMAGE_OPENAI_ERROR]', message);
      }
    }

    const fallbackDraft = buildSafeFallbackDraft({
      locale,
      categoryTitle,
      fields,
      providerErrors,
    });
    const data = await withLearningEvent({
      draft: fallbackDraft,
      eventId,
      userId: auth.ctx.userId,
      imageHash,
      imageSize: image.size,
      imageType: image.type,
      locale,
      side,
      categoryTitle,
      fields,
      providerErrors,
    });
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[CREATE_FROM_IMAGE_ERROR]', error);
    return NextResponse.json(
      { error: 'Gagal menjalankan bantuan AI foto.' },
      { status: 500 },
    );
  }
}
