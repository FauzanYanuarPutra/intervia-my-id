import { readFile } from 'fs/promises';
import path from 'path';
import type {
  PersonalAiAgent,
  PersonalAiMemory,
  PersonalAiMessage,
} from './store';
import {
  BUILTIN_LAJUKAN_DOMAIN_KNOWLEDGE,
  buildLajukanDomainKnowledgePrompt,
  mergeDomainKnowledgeItems,
  normalizeDomainKnowledgeItems,
  type LajukanDomainKnowledgeItem,
} from './domainKnowledge';

/**
 * Personal AI runtime boundary.
 *
 * Architecture:
 *   Browser -> Next.js BFF -> this runtime -> Rust ai_service -> provider
 *
 * This file MUST NOT call Ollama, Groq, OpenAI, or any other model provider
 * directly. Provider selection, retry, reasoning controls, structured output,
 * and vision routing belong to ai_service.
 */

const INTERNAL_AI_URL =
  (process.env.INTERNAL_AI_URL || 'http://ai_service:8080').trim();
const AI_SERVICE_TOKEN = process.env.AI_SERVICE_TOKEN || '';

const INTERNAL_AI_TIMEOUT_MS = cleanInteger(
  process.env.PERSONAL_AI_GATEWAY_TIMEOUT_MS ||
    process.env.INTERNAL_AI_TIMEOUT_MS ||
    process.env.AI_REQUEST_TIMEOUT_MS,
  105_000,
  10_000,
  180_000,
);

const PERSONAL_AI_MAX_MEDIA = cleanInteger(
  process.env.PERSONAL_AI_MAX_MEDIA,
  4,
  1,
  4,
);

const PERSONAL_AI_MAX_INLINE_IMAGE_BYTES = cleanInteger(
  process.env.PERSONAL_AI_MAX_INLINE_IMAGE_BYTES,
  2_000_000,
  100_000,
  4_000_000,
);

const AI_MAX_INLINE_MEDIA_CHARS = cleanInteger(
  process.env.AI_MAX_INLINE_MEDIA_CHARS,
  3_000_000,
  100_000,
  8_000_000,
);

const PERSONAL_AI_MAX_FILE_TEXT_CHARS = cleanInteger(
  process.env.PERSONAL_AI_MAX_FILE_TEXT_CHARS,
  3_500,
  500,
  8_000,
);

const PERSONAL_AI_MAX_HISTORY_MESSAGES = cleanInteger(
  process.env.PERSONAL_AI_MAX_HISTORY_MESSAGES ||
    process.env.PERSONAL_AI_MAX_HISTORY,
  14,
  2,
  18,
);

const PERSONAL_AI_MAX_OUTPUT_TOKENS = cleanInteger(
  process.env.PERSONAL_AI_MAX_OUTPUT_TOKENS ||
    process.env.AI_MAX_OUTPUT_TOKENS,
  800,
  128,
  1_600,
);

const PERSONAL_AI_USE_RAG =
  /^(1|true|yes|on)$/i.test(process.env.PERSONAL_AI_USE_RAG || '');

const PERSONAL_AI_DOMAIN_DATASET_FILE =
  process.env.PERSONAL_AI_DOMAIN_DATASET_FILE ||
  (process.env.NODE_ENV === 'production'
    ? '/tmp/lajukan-personal-ai/domain-dataset.json'
    : path.join(
        process.cwd(),
        '../../.runtime/personal-ai/domain-dataset.json',
      ));

const ALLOWED_INLINE_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const INDONESIAN_MESSAGE_RE =
  /\b(aku|saya|gua|gue|gw|kamu|anda|tolong|bantu|bisa|dong|nih|sih|yah|ya|kan|kok|gimana|bagaimana|apa|kenapa|mengapa|dimana|kapan|buat|bikin|jelasin|jelaskan|gambar|foto|produk|usaha|dagangan|jualan|caption|konten|bahasa|indonesia|terima kasih|makasih)\b/i;
const ENGLISH_MESSAGE_RE =
  /\b(i|me|my|you|your|please|help|can|could|would|what|why|how|where|when|make|create|explain|describe|image|photo|product|business|caption|content|english|thanks|thank you)\b/i;

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type GatewayMedia = {
  kind: string;
  name: string;
  mime: string;
  data_url?: string;
  text?: string;
};

type GatewayResponse = {
  status?: string;
  request_id?: string;
  response?: string;
  message?: string;
  data?: unknown;
  model?: string;
  provider?: string;
  warnings?: unknown;
  error?: string;
  confidence?: number;
  needs_clarification?: boolean;
  questions?: unknown;
};

export type PersonalAiMediaContext = {
  kind: 'image' | 'video' | 'audio' | 'document' | 'file';
  name: string;
  mime: string;
  size: number;
  /**
   * Temporary inline image used only during this request.
   * Never persist this value in message history/database/browser cache.
   */
  dataUrl?: string;
  /**
   * Text that an authorized upstream parser already extracted.
   * Runtime never downloads or parses arbitrary media URLs itself.
   */
  text?: string;
  /**
   * Display/reference metadata only. This runtime intentionally never fetches it.
   */
  url?: string;
};

export type PersonalAiProviderResult = {
  response: string;
  /**
   * Public boundary name, not the underlying provider selected by ai_service.
   */
  provider: string;
  model: string;
};

type SanitizedMediaResult = {
  media: GatewayMedia[];
  warnings: string[];
};

let domainKnowledgeCache: {
  loadedAt: number;
  items: LajukanDomainKnowledgeItem[];
} | null = null;

function trimBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

function cleanInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function cleanRequestId(value: unknown): string {
  const requestId = cleanText(value, 128);
  if (!requestId) return '';
  return /^[A-Za-z0-9._:-]+$/.test(requestId) ? requestId : '';
}

function cleanStringArray(
  value: unknown,
  limit: number,
  maxLength: number,
): string[] {
  if (!Array.isArray(value)) return [];
  const output: string[] = [];
  const seen = new Set<string>();

  for (const raw of value) {
    const item = cleanText(raw, maxLength);
    const key = item.toLocaleLowerCase('id-ID');
    if (!item || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
    if (output.length >= limit) break;
  }

  return output;
}

function countPatternMatches(value: string, pattern: RegExp) {
  return value.match(new RegExp(pattern.source, 'gi'))?.length || 0;
}

function detectUserMessageLocale(
  message: string,
  fallback: 'id' | 'en',
): 'id' | 'en' {
  const normalized = message.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;

  const idMatches = countPatternMatches(normalized, INDONESIAN_MESSAGE_RE);
  const enMatches = countPatternMatches(normalized, ENGLISH_MESSAGE_RE);

  if (idMatches > enMatches) return 'id';
  if (enMatches > idMatches) return 'en';

  if (
    /[?!.]?\s*(dong|nih|sih|yah|ya|kan|aja|banget|gimana|kok)\b/i.test(
      normalized,
    )
  ) {
    return 'id';
  }

  return fallback;
}

async function loadLajukanDomainKnowledge() {
  const cacheTtlMs = cleanInteger(
    process.env.PERSONAL_AI_DOMAIN_DATASET_CACHE_TTL_MS,
    120_000,
    10_000,
    3_600_000,
  );

  if (
    domainKnowledgeCache &&
    Date.now() - domainKnowledgeCache.loadedAt < cacheTtlMs
  ) {
    return domainKnowledgeCache.items;
  }

  let runtimeItems: LajukanDomainKnowledgeItem[] = [];

  try {
    const raw = await readFile(PERSONAL_AI_DOMAIN_DATASET_FILE, 'utf8');
    runtimeItems = normalizeDomainKnowledgeItems(JSON.parse(raw));
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code)
        : '';

    if (code && code !== 'ENOENT') {
      console.warn('[PERSONAL_AI_DOMAIN_DATASET_LOAD_FAILED]', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const items = mergeDomainKnowledgeItems(
    runtimeItems,
    BUILTIN_LAJUKAN_DOMAIN_KNOWLEDGE,
  ).slice(0, 240);

  domainKnowledgeCache = {
    loadedAt: Date.now(),
    items,
  };

  return items;
}

function estimatedBase64Bytes(base64: string) {
  const normalized = base64.replace(/\s+/g, '');
  const padding = normalized.endsWith('==')
    ? 2
    : normalized.endsWith('=')
      ? 1
      : 0;

  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
}

function sanitizeInlineImageDataUrl(
  value: string,
): { dataUrl: string; mime: string; bytes: number } {
  if (typeof value !== 'string') {
    throw new Error('invalid_inline_image');
  }

  // Reject over-limit payloads before any slicing. Truncating base64 can turn a
  // valid image into corrupted input while still looking syntactically valid.
  const dataUrl = value
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .trim();

  if (!dataUrl || dataUrl.length > AI_MAX_INLINE_MEDIA_CHARS) {
    throw new Error('inline_image_exceeds_gateway_limit');
  }

  const match =
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\r\n]+)$/.exec(
      dataUrl,
    );

  if (!match) {
    throw new Error('invalid_inline_image');
  }

  const mime = match[1].toLowerCase();
  if (!ALLOWED_INLINE_IMAGE_MIMES.has(mime)) {
    throw new Error('unsupported_inline_image_type');
  }

  const base64 = match[2].replace(/\s+/g, '');
  const bytes = estimatedBase64Bytes(base64);

  if (bytes <= 0) {
    throw new Error('empty_inline_image');
  }

  if (bytes > PERSONAL_AI_MAX_INLINE_IMAGE_BYTES) {
    throw new Error('inline_image_too_large');
  }

  const normalized = `data:${mime};base64,${base64}`;
  if (normalized.length > AI_MAX_INLINE_MEDIA_CHARS) {
    throw new Error('inline_image_exceeds_gateway_limit');
  }

  return {
    dataUrl: normalized,
    mime,
    bytes,
  };
}

function sanitizeMedia(
  input: PersonalAiMediaContext[],
): SanitizedMediaResult {
  const media: GatewayMedia[] = [];
  const warnings: string[] = [];

  for (const raw of input.slice(0, PERSONAL_AI_MAX_MEDIA)) {
    const kind = cleanText(raw.kind, 40);
    const name = cleanText(raw.name, 180) || 'media';
    const mime = cleanText(raw.mime, 100).toLowerCase();
    const text = cleanText(raw.text, PERSONAL_AI_MAX_FILE_TEXT_CHARS);

    const item: GatewayMedia = {
      kind,
      name,
      mime,
    };

    if (kind === 'image' && raw.dataUrl) {
      try {
        const image = sanitizeInlineImageDataUrl(raw.dataUrl);
        item.data_url = image.dataUrl;
        item.mime = image.mime;
      } catch (error) {
        warnings.push(
          `${name}:${error instanceof Error ? error.message : 'invalid_inline_image'}`,
        );
      }
    }

    if (text) {
      item.text = text;
    }

    // Intentionally DO NOT forward raw.url. ai_service accepts only inline
    // images and caller-extracted text. This prevents SSRF/provider URL fetches.
    if (item.data_url || item.text || kind) {
      media.push(item);
    }
  }

  return {
    media,
    warnings: warnings.slice(0, 6),
  };
}

function personalAiHistoryContent(
  message: PersonalAiMessage,
  locale: 'id' | 'en',
) {
  const content = cleanText(message.content, 6_000);
  const reply =
    message.metadata?.reply_to &&
    typeof message.metadata.reply_to === 'object' &&
    !Array.isArray(message.metadata.reply_to)
      ? (message.metadata.reply_to as Record<string, unknown>)
      : null;

  const forwarded =
    message.metadata?.forwarded_from &&
    typeof message.metadata.forwarded_from === 'object' &&
    !Array.isArray(message.metadata.forwarded_from)
      ? (message.metadata.forwarded_from as Record<string, unknown>)
      : null;

  const context = [
    reply
      ? `${locale === 'id' ? '[Membalas pesan]' : '[Replying to message]'} ${cleanText(reply.excerpt, 500)}`
      : '',
    forwarded
      ? `${locale === 'id' ? '[Pesan diteruskan]' : '[Forwarded message]'} (${cleanText(forwarded.role, 20) || 'message'})`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return context ? `${context}\n${content}` : content;
}

function buildHistoryMessages(
  history: PersonalAiMessage[],
  locale: 'id' | 'en',
): ChatMessage[] {
  return history
    .filter(
      item =>
        item.role === 'user' ||
        item.role === 'assistant',
    )
    .slice(-PERSONAL_AI_MAX_HISTORY_MESSAGES)
    .map(item => ({
      role: item.role as 'user' | 'assistant',
      content: personalAiHistoryContent(item, locale),
    }))
    .filter(item => Boolean(item.content));
}

function buildBuilderInstruction(
  agent: PersonalAiAgent,
  actionInstruction: string,
  locale: 'id' | 'en',
) {
  const builder = agent.builder_config;
  if (!builder && !actionInstruction) return '';

  const isId = locale === 'id';
  const outputSections = builder?.output?.sections
    ?.slice(0, 12)
    .map(section => {
      const title = cleanText(section.title, 90);
      const type = cleanText(section.type, 40);
      const instruction = cleanText(section.instruction, 500);
      return [
        title ? `- ${title}${type ? ` (${type})` : ''}` : '',
        instruction ? `  ${instruction}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .filter(Boolean);

  const builderRules = builder
    ? cleanStringArray(
        builder.instructions?.behaviorRules,
        20,
        220,
      )
    : [];

  return [
    isId
      ? '[KONFIGURASI PERSONAL AI DARI PEMILIK - prioritas di bawah kebijakan Lajukan]'
      : '[OWNER PERSONAL AI CONFIGURATION - lower priority than Lajukan policy]',
    builder?.instructions?.baseInstruction
      ? cleanText(builder.instructions.baseInstruction, 3_000)
      : '',
    builderRules.length
      ? [
          isId ? 'Aturan perilaku:' : 'Behavior rules:',
          ...builderRules.map(rule => `- ${rule}`),
        ].join('\n')
      : '',
    builder?.instructions?.negativeInstruction
      ? `${isId ? 'Hindari:' : 'Avoid:'} ${cleanText(
          builder.instructions.negativeInstruction,
          1_600,
        )}`
      : '',
    actionInstruction
      ? `${isId ? 'Instruksi tombol aktif:' : 'Active creator button instruction:'} ${cleanText(
          actionInstruction,
          1_600,
        )}`
      : '',
    outputSections?.length
      ? [
          isId ? 'Struktur output yang diharapkan:' : 'Expected output structure:',
          ...outputSections,
        ].join('\n')
      : '',
    builder?.output?.format
      ? `${isId ? 'Format output' : 'Output format'}: ${cleanText(
          builder.output.format,
          30,
        )}`
      : '',
    outputSections?.some(section => /scene_collection/i.test(section))
      ? isId
        ? 'Untuk scene_collection: setiap scene harus jelas soal durasi, tujuan, visual/subjek, aksi, kamera, lighting, background, teks layar/VO bila relevan, transisi, consistency notes, dan negative prompt.'
        : 'For scene_collection: make each scene explicit about duration, purpose, visual/subject, action, camera, lighting, background, on-screen text/VO when relevant, transition, consistency notes, and negative prompt.'
      : '',
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 7_500);
}

function buildSafeMemory(memory: PersonalAiMemory | null) {
  if (!memory) return undefined;

  const summary = cleanText(memory.summary, 5_000);
  const facts = memory.facts
    ? {
        topics: cleanStringArray(memory.facts.topics, 20, 120),
        user_terms: cleanStringArray(memory.facts.user_terms, 20, 120),
        last_messages: cleanStringArray(memory.facts.last_messages, 8, 500),
      }
    : undefined;

  if (!summary && !facts) return undefined;

  return {
    summary,
    facts,
    updated_at: cleanText(memory.updated_at, 64),
  };
}

function buildPersonalAiContext(input: {
  agent: PersonalAiAgent;
  domainContext: string;
  mediaWarnings: string[];
}) {
  const builder = input.agent.builder_config;

  return {
    personal_ai: {
      agent_id: cleanText(input.agent.id, 160),
      // Kept only as migration/debug metadata. ai_service owns provider routing.
      legacy_model_preference: cleanText(
        input.agent.model_preference,
        40,
      ),
      builder: builder
        ? {
            schema_version: builder.schemaVersion,
            template_id: cleanText(builder.templateId, 80),
            branding: {
              name: cleanText(builder.branding?.name, 90),
              category: cleanText(builder.branding?.category, 80),
              tags: cleanStringArray(builder.branding?.tags, 12, 40),
            },
            output: {
              format: cleanText(builder.output?.format, 30),
              sections: (builder.output?.sections || [])
                .slice(0, 12)
                .map(section => ({
                  key: cleanText(section.key, 80),
                  title: cleanText(section.title, 90),
                  type: cleanText(section.type, 40),
                })),
            },
            // Informational only. This runtime never routes by provider/model id.
            model_policy: {
              mode: cleanText(builder.modelPolicy?.mode, 30),
              preferred_model_id: cleanText(
                builder.modelPolicy?.preferredModelId,
                80,
              ),
              required_capabilities: cleanStringArray(
                builder.modelPolicy?.requiredCapabilities,
                6,
                30,
              ),
            },
          }
        : undefined,
      domain_reference: cleanText(input.domainContext, 12_000),
      media_warnings: input.mediaWarnings,
    },
  };
}

function localizedUnavailable(locale: 'id' | 'en', hasImage: boolean) {
  if (locale === 'id') {
    return hasImage
      ? 'Foto sudah diterima, tetapi layanan AI belum berhasil memprosesnya. Coba kirim ulang sebentar lagi; saya tidak akan menebak isi gambar.'
      : 'AI sedang belum bisa merespons. Coba kirim ulang sebentar lagi.';
  }

  return hasImage
    ? 'The image was received, but the AI service could not process it. Please retry shortly; I will not guess the image contents.'
    : 'AI is temporarily unavailable. Please try again shortly.';
}

function sanitizeGatewayWarnings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => cleanText(item, 180))
    .filter(Boolean)
    .slice(0, 6);
}

function safeGatewayErrorCode(status: number, value: unknown) {
  const raw = cleanText(value, 120);
  if (/^[A-Za-z0-9._:-]+$/.test(raw)) {
    return `ai-service:${raw}`;
  }
  return `ai-service:http_${status}`;
}

async function callAiService(input: {
  message: string;
  messages: ChatMessage[];
  locale: 'id' | 'en';
  agent: PersonalAiAgent;
  memory: PersonalAiMemory | null;
  context: Record<string, unknown>;
  media: GatewayMedia[];
  requestId: string;
}): Promise<
  PersonalAiProviderResult & {
    provider_errors: string[];
  }
> {
  if (!INTERNAL_AI_URL) {
    throw new Error('AI_GATEWAY_NOT_CONFIGURED');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (input.requestId) {
    headers['X-Request-Id'] = input.requestId;
  }

  if (AI_SERVICE_TOKEN.trim()) {
    headers.Authorization = `Bearer ${AI_SERVICE_TOKEN.trim()}`;
  }

  const response = await fetch(`${trimBaseUrl(INTERNAL_AI_URL)}/v1/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      task: 'chat',
      message: input.message,
      messages: input.messages,
      locale: input.locale,
      agent: {
        id: cleanText(input.agent.id, 160),
        name: cleanText(input.agent.name, 160),
        instructions: cleanText(input.agent.instructions, 5_000),
        tone: cleanText(input.agent.tone, 160),
      },
      memory: buildSafeMemory(input.memory),
      context: input.context,
      media: input.media,
      temperature: Math.max(
        0,
        Math.min(1, Number(input.agent.temperature) || 0),
      ),
      max_tokens: PERSONAL_AI_MAX_OUTPUT_TOKENS,
      response_mode: 'text',
      use_rag: PERSONAL_AI_USE_RAG,
    }),
    signal: AbortSignal.timeout(INTERNAL_AI_TIMEOUT_MS),
  });

  const data = (await response.json().catch(() => ({}))) as GatewayResponse;
  const text = cleanText(data.response || data.message, 20_000);

  if (!response.ok || !text) {
    const code = safeGatewayErrorCode(response.status, data.error);
    console.warn('[PERSONAL_AI_GATEWAY_ERROR]', {
      status: response.status,
      code,
      request_id: cleanText(data.request_id, 128) || input.requestId || undefined,
    });
    throw new Error(code);
  }

  return {
    response: text,
    // Never expose/route by the underlying provider at the BFF boundary.
    provider: 'ai-service',
    model: cleanText(data.model, 120) || 'ai-service',
    provider_errors: sanitizeGatewayWarnings(data.warnings),
  };
}

export async function runPersonalAi(input: {
  agent: PersonalAiAgent;
  memory: PersonalAiMemory | null;
  message: string;
  actionInstruction?: string;
  history: PersonalAiMessage[];
  locale: 'id' | 'en';
  media?: PersonalAiMediaContext[];
  requestId?: string;
}): Promise<
  PersonalAiProviderResult & {
    provider_errors: string[];
  }
> {
  const message = cleanText(input.message, 6_000);
  const requestId = cleanRequestId(input.requestId);
  const locale = detectUserMessageLocale(message, input.locale);

  const sanitizedMedia = sanitizeMedia(input.media || []);
  const history = buildHistoryMessages(input.history, locale);

  const domainKnowledge = await loadLajukanDomainKnowledge();
  const domainContext = buildLajukanDomainKnowledgePrompt({
    query: message,
    media: sanitizedMedia.media.map(item => ({
      name: item.name,
      mime: item.mime,
      text: item.text,
    })),
    locale,
    items: domainKnowledge,
  });

  const callerInstruction = buildBuilderInstruction(
    input.agent,
    cleanText(input.actionInstruction, 1_600),
    locale,
  );

  const messages: ChatMessage[] = [
    ...(callerInstruction
      ? [
          {
            role: 'system' as const,
            content: callerInstruction,
          },
        ]
      : []),
    ...history,
  ];

  const context = buildPersonalAiContext({
    agent: input.agent,
    domainContext,
    mediaWarnings: sanitizedMedia.warnings,
  });

  const hasImage = sanitizedMedia.media.some(
    item => item.kind === 'image' && Boolean(item.data_url),
  );

  try {
    const result = await callAiService({
      message,
      messages,
      locale,
      agent: input.agent,
      memory: input.memory,
      context,
      media: sanitizedMedia.media,
      requestId,
    });

    return {
      ...result,
      provider_errors: [
        ...sanitizedMedia.warnings,
        ...result.provider_errors,
      ].slice(0, 6),
    };
  } catch (error) {
    const errorCode =
      error instanceof Error
        ? cleanText(error.message, 180)
        : 'ai-service:unknown';

    console.warn('[PERSONAL_AI_RUNTIME_FALLBACK]', {
      code: errorCode,
      request_id: requestId || undefined,
    });

    return {
      response: localizedUnavailable(locale, hasImage),
      provider: 'safe-fallback',
      model: 'personal-ai-fallback',
      provider_errors: [
        ...sanitizedMedia.warnings,
        errorCode || 'ai-service:unknown',
      ].slice(0, 6),
    };
  }
}
