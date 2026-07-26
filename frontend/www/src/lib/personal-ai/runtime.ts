import { readFile } from 'fs/promises';
import path from 'path';
import { LAJUKAN_SYSTEM_PROMPT } from '@/lib/aiSystemPrompt';
import type {
  PersonalAiAgent,
  PersonalAiMemory,
  PersonalAiMessage,
  PersonalAiModelPreference,
} from './store';
import {
  BUILTIN_LAJUKAN_DOMAIN_KNOWLEDGE,
  buildLajukanDomainKnowledgePrompt,
  mergeDomainKnowledgeItems,
  normalizeDomainKnowledgeItems,
  type LajukanDomainKnowledgeItem,
} from './domainKnowledge';

const INTERNAL_AI_URL = process.env.INTERNAL_AI_URL || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';
const OPENAI_VISION_MODEL =
  process.env.OPENAI_VISION_MODEL ||
  (/(gpt-4|gpt-4o|o[134])/i.test(AI_MODEL) ? AI_MODEL : 'gpt-4o-mini');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL =
  process.env.OLLAMA_BUSINESS_MODEL ||
  process.env.OLLAMA_MODEL ||
  'qwen3-vl:4b-instruct';
const OLLAMA_VISION_MODEL =
  process.env.OLLAMA_VISION_MODEL || 'qwen3-vl:4b-instruct';
const OLLAMA_VISION_MODELS = prioritizeOllamaVisionModels(
  uniqueModelList(
    [
      process.env.PERSONAL_AI_OLLAMA_VISION_MODELS ||
        process.env.OLLAMA_VISION_MODELS ||
        OLLAMA_VISION_MODEL,
      OLLAMA_VISION_MODEL,
      'qwen3-vl:4b-instruct',
      'llava:7b',
      'qwen2.5vl:7b',
      'moondream:latest',
    ].join(','),
  ),
);

const OLLAMA_TIMEOUT_MS = cleanInteger(
  process.env.OLLAMA_CHAT_TIMEOUT_MS || process.env.OLLAMA_TIMEOUT_MS,
  90_000,
  3_000,
  180_000,
);
const OLLAMA_VISION_TIMEOUT_MS = cleanInteger(
  process.env.PERSONAL_AI_MIN_VISION_TIMEOUT_MS,
  180_000,
  30_000,
  600_000,
);
const RAW_OLLAMA_VISION_TIMEOUT_MS = cleanInteger(
  process.env.OLLAMA_VISION_TIMEOUT_MS ||
    process.env.OLLAMA_CHAT_VISION_TIMEOUT_MS ||
    process.env.OLLAMA_TIMEOUT_MS,
  OLLAMA_VISION_TIMEOUT_MS,
  10_000,
  600_000,
);
const EFFECTIVE_OLLAMA_VISION_TIMEOUT_MS = Math.max(
  RAW_OLLAMA_VISION_TIMEOUT_MS,
  OLLAMA_VISION_TIMEOUT_MS,
);
const OLLAMA_NUM_CTX = cleanInteger(
  process.env.OLLAMA_NUM_CTX,
  4_096,
  2_048,
  16_384,
);
const OLLAMA_NUM_PREDICT = cleanInteger(
  process.env.OLLAMA_NUM_PREDICT,
  900,
  128,
  3_000,
);
const OLLAMA_MAX_VISION_IMAGES = cleanInteger(
  process.env.OLLAMA_MAX_VISION_IMAGES,
  2,
  1,
  4,
);
const PERSONAL_AI_MAX_INLINE_IMAGE_BYTES = cleanInteger(
  process.env.PERSONAL_AI_MAX_INLINE_IMAGE_BYTES,
  3_500_000,
  250_000,
  5_000_000,
);
const OLLAMA_KEEP_ALIVE = cleanOllamaDuration(
  process.env.OLLAMA_KEEP_ALIVE,
  '10m',
);

const USE_OLLAMA = process.env.USE_OLLAMA === 'true';
const PERSONAL_AI_FAST_PROVIDER_FIRST =
  process.env.PERSONAL_AI_FAST_PROVIDER_FIRST !== 'false';
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

const NON_LATIN_SCRIPT_RANGES =
  /[\u0E00-\u0E7F\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/g;
const LATIN_WORD_RE = /[A-Za-z]{2,}/g;
const INDONESIAN_HINT_RE =
  /\b(gambar|foto|produk|terlihat|tampak|warna|bentuk|objek|kemasan|label|bahan|tekstur|kondisi|fungsi|caption|target|pembeli|asumsi|visual|ini|adalah|ada|pada|dalam|dari|untuk|dan|yang)\b/i;
const INDONESIAN_MESSAGE_RE =
  /\b(aku|saya|gua|gue|gw|kamu|anda|tolong|bantu|bisa|dong|nih|sih|yah|ya|kan|kok|gimana|bagaimana|apa|kenapa|mengapa|dimana|kapan|buat|bikin|jelasin|jelaskan|gambar|foto|produk|usaha|dagangan|jualan|caption|konten|bahasa|indonesia|terima kasih|makasih)\b/i;
const ENGLISH_MESSAGE_RE =
  /\b(i|me|my|you|your|please|help|can|could|would|what|why|how|where|when|make|create|explain|describe|image|photo|product|business|caption|content|english|thanks|thank you)\b/i;
const ENGLISH_RESPONSE_RE =
  /\b(the|this|that|there|with|from|for|and|you|your|product|image|photo|business|customer|market|target|caption|description|summary|recommend|should|could|would|please)\b/gi;
const INDONESIAN_RESPONSE_RE =
  /\b(ini|itu|yang|dan|atau|untuk|dari|dengan|pada|produk|gambar|foto|usaha|pelanggan|target|caption|deskripsi|ringkasan|rekomendasi|sebaiknya|bisa|perlu|terlihat|tampak|warna|bentuk)\b/gi;
const VISION_SCHEMA_PLACEHOLDER_RE =
  /\b(objek utama yang terlihat|deskripsi bahasa indonesia|detail visual konkret|warna terlihat|teks yang benar-benar terbaca|hal yang tidak pasti|perlu dikonfirmasi|main visible subject|sentence visual description|concrete visual detail|visible color|clearly readable text|uncertain detail to verify)\b/i;

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  /**
   * Ollama native /api/chat expects raw base64 strings without
   * the data:image/...;base64, prefix.
   */
  images?: string[];
};

type OpenAiMessage = {
  role: 'user' | 'assistant' | 'system';
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | {
            type: 'image_url';
            image_url: { url: string; detail: 'auto' };
          }
      >;
};

export type PersonalAiMediaContext = {
  kind: 'image' | 'video' | 'audio' | 'document' | 'file';
  name: string;
  mime: string;
  size: number;
  /**
   * Temporary inline image used only during this request.
   * Do not store this value in message history/database.
   */
  dataUrl?: string;
  text?: string;
  url?: string;
};

export type PersonalAiProviderResult = {
  response: string;
  provider: string;
  model: string;
};

type PreparedVisionImage = {
  mime: string;
  base64: string;
  dataUrl: string;
  byteLength: number;
};

type PreparedVisionResult = {
  images: PreparedVisionImage[];
  errors: string[];
};

type VisionCaptionResult = {
  description: string;
  mainSubject?: string;
  visibleDetails: string[];
  colors: string[];
  textSeen: string[];
  uncertainties: string[];
  provider: string;
  model: string;
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

function cleanOllamaDuration(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  if (/^(0|[1-9]\d*(ms|s|m|h))$/i.test(trimmed)) return trimmed;
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
  domainKnowledgeCache = { loadedAt: Date.now(), items };
  return items;
}

function uniqueModelList(value: string) {
  const models = value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const model of models) {
    if (seen.has(model)) continue;
    seen.add(model);
    result.push(model);
  }
  return result.length > 0 ? result : [OLLAMA_VISION_MODEL];
}

function prioritizeOllamaVisionModels(models: string[]) {
  if (process.env.PERSONAL_AI_FAST_VISION_FIRST === 'true') {
    const fast = models.filter(model => prefersPlainOllamaVision(model));
    const rest = models.filter(model => !prefersPlainOllamaVision(model));
    return [...fast, ...rest];
  }

  return [...models].sort(
    (left, right) =>
      ollamaVisionReliabilityRank(left) - ollamaVisionReliabilityRank(right),
  );
}

function ollamaVisionReliabilityRank(model: string) {
  const normalized = model.toLowerCase();
  if (/qwen3[-:]?vl|qwen3-vl/.test(normalized)) return 0;
  if (/llava/.test(normalized)) return 1;
  if (/qwen2\.5[-:]?vl|qwen2\.5vl/.test(normalized)) return 2;
  if (/qwen/.test(normalized)) return 3;
  if (/minicpm|bakllava|gemma3/.test(normalized)) return 4;
  if (/moondream/.test(normalized)) return 8;
  return 5;
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

function parseInlineImageDataUrl(
  dataUrl: string,
  maxBytes: number,
): PreparedVisionImage {
  const match =
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\r\n]+)$/.exec(
      dataUrl,
    );

  if (!match) {
    throw new Error('Format data URL gambar tidak valid.');
  }

  const mime = match[1].toLowerCase();
  if (!ALLOWED_INLINE_IMAGE_MIMES.has(mime)) {
    throw new Error(`Format gambar ${mime} belum didukung.`);
  }

  const base64 = match[2].replace(/\s+/g, '');
  const byteLength = estimatedBase64Bytes(base64);

  if (byteLength <= 0) {
    throw new Error('Isi gambar kosong.');
  }

  if (byteLength > maxBytes) {
    throw new Error(
      `Gambar terlalu besar (${byteLength} byte). Maksimal ${maxBytes} byte setelah kompresi.`,
    );
  }

  return {
    mime,
    base64,
    dataUrl: `data:${mime};base64,${base64}`,
    byteLength,
  };
}

function prepareVisionImages(
  media: PersonalAiMediaContext[],
): PreparedVisionResult {
  const images: PreparedVisionImage[] = [];
  const errors: string[] = [];

  for (const item of media) {
    if (images.length >= OLLAMA_MAX_VISION_IMAGES) break;
    if (item.kind !== 'image' || !item.dataUrl) continue;

    try {
      images.push(
        parseInlineImageDataUrl(
          item.dataUrl,
          PERSONAL_AI_MAX_INLINE_IMAGE_BYTES,
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${item.name || 'image'}: ${message}`);
    }
  }

  return { images, errors };
}

function buildVisionOnlyInstruction(locale: 'id' | 'en') {
  return locale === 'id'
    ? [
        '',
        '[Instruksi wajib untuk analisis gambar]',
        'Jawab hanya dalam Bahasa Indonesia.',
        'Identifikasi objek utama pada gambar terlebih dulu. Jika ini foto produk, jelaskan objek, warna, bentuk, bahan/tekstur yang tampak, kemasan/label yang terbaca, kondisi visual, kemungkinan fungsi, target pembeli, ide caption, dan hal yang perlu dikonfirmasi.',
        'Jangan jawab dengan aksara/bahasa lain. Jangan menebak merek, harga, lokasi, ukuran pasti, atau klaim yang tidak terlihat.',
        'Jika gambar tidak terbaca, katakan jelas bahwa gambar belum berhasil dianalisis.',
      ].join('\n')
    : [
        '',
        '[Required image analysis instruction]',
        'Answer only in English.',
        'Identify the main visible object first. For product photos, describe the object, colors, shape, visible material/texture, readable packaging/labels, visual condition, likely function, target buyer, caption ideas, and details to verify.',
        'Do not answer in another script or language. Do not guess brand, price, location, exact size, or unsupported claims.',
        'If the image is unreadable, clearly say it could not be analyzed.',
      ].join('\n');
}

function rejectSuspiciousVisionResponse(
  response: string,
  locale: 'id' | 'en',
  provider: string,
) {
  const normalized = response.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    throw new Error(`${provider} returned an empty vision response.`);
  }

  if (isSuspiciousNonLatinText(normalized)) {
    throw new Error(
      `${provider} returned an unrelated non-Latin vision response.`,
    );
  }

  if (
    locale === 'id' &&
    normalized.length < 60 &&
    !INDONESIAN_HINT_RE.test(normalized)
  ) {
    throw new Error(`${provider} returned a low-confidence vision response.`);
  }
}

function detectUserMessageLocale(
  message: string,
  fallback: 'id' | 'en',
): 'id' | 'en' {
  const normalized = message.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;

  const idMatches = countPatternMatches(normalized, INDONESIAN_MESSAGE_RE);
  const enMatches = countPatternMatches(normalized, ENGLISH_MESSAGE_RE);
  const hasIndonesian = idMatches > 0;
  const hasEnglish = enMatches > 0;

  if (hasIndonesian && !hasEnglish) return 'id';
  if (hasEnglish && !hasIndonesian) return 'en';

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

function countPatternMatches(value: string, pattern: RegExp) {
  return value.match(new RegExp(pattern.source, 'gi'))?.length || 0;
}

function rejectWrongLanguageResponse(
  response: string,
  locale: 'id' | 'en',
  provider: string,
) {
  if (locale !== 'id') return;

  const normalized = response.replace(/\s+/g, ' ').trim();
  if (normalized.length < 80) return;

  const englishMatches = normalized.match(ENGLISH_RESPONSE_RE)?.length || 0;
  const indonesianMatches =
    normalized.match(INDONESIAN_RESPONSE_RE)?.length || 0;

  if (englishMatches >= 8 && englishMatches > indonesianMatches * 2 + 4) {
    throw new Error(`${provider} answered in the wrong language.`);
  }
}

function validateProviderLanguage(
  result: PersonalAiProviderResult,
  locale: 'id' | 'en',
) {
  rejectWrongLanguageResponse(result.response, locale, result.provider);
  return result;
}

function isSuspiciousNonLatinText(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  const nonLatinChars = normalized.match(NON_LATIN_SCRIPT_RANGES)?.length || 0;
  const latinWords = normalized.match(LATIN_WORD_RE)?.length || 0;
  const ratio = nonLatinChars / Math.max(1, normalized.length);
  return nonLatinChars >= 4 && (ratio > 0.16 || latinWords < 4);
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const clean = text
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
  const candidates = [
    clean,
    clean.slice(clean.indexOf('{'), clean.lastIndexOf('}') + 1),
  ].filter(candidate => candidate.startsWith('{') && candidate.endsWith('}'));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function isVisionPlaceholderText(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return VISION_SCHEMA_PLACEHOLDER_RE.test(normalized);
}

function cleanVisionTextList(value: unknown, limit: number, maxLength = 180) {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const text = cleanText(item, maxLength);
    const key = text.toLowerCase();
    if (
      !text ||
      seen.has(key) ||
      isSuspiciousNonLatinText(text) ||
      isVisionPlaceholderText(text)
    ) {
      continue;
    }
    seen.add(key);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function buildVisionCaptionResult(
  parsed: Record<string, unknown>,
  provider: string,
  model: string,
): VisionCaptionResult {
  const description = cleanText(parsed.description, 1_200);
  const mainSubject = cleanText(parsed.main_subject || parsed.mainSubject, 220);

  if (
    !description ||
    isSuspiciousNonLatinText(description) ||
    isVisionPlaceholderText(description) ||
    isVisionPlaceholderText(mainSubject)
  ) {
    throw new Error(
      `${provider} returned a schema placeholder instead of visual analysis.`,
    );
  }

  const visibleDetails = cleanVisionTextList(
    parsed.visible_details || parsed.visibleDetails,
    8,
    220,
  );

  return {
    description,
    mainSubject:
      mainSubject && !isSuspiciousNonLatinText(mainSubject)
        ? mainSubject
        : undefined,
    visibleDetails,
    colors: cleanVisionTextList(parsed.colors, 8, 60),
    textSeen: cleanVisionTextList(parsed.text_seen || parsed.textSeen, 8, 120),
    uncertainties: cleanVisionTextList(parsed.uncertainties, 6, 180),
    provider,
    model,
  };
}

function buildPlainVisionCaptionResult(
  value: string,
  provider: string,
  model: string,
): VisionCaptionResult {
  const description = cleanText(
    value.replace(/^\s*(?:\d+[\).:-]\s*|[-*]\s*)/gm, '').replace(/\s+/g, ' '),
    1_200,
  );

  if (
    description.length < 8 ||
    isSuspiciousNonLatinText(description) ||
    isVisionPlaceholderText(description)
  ) {
    throw new Error(
      `${provider} returned a low-confidence plain vision response.`,
    );
  }

  return {
    description,
    visibleDetails: [description],
    colors: [],
    textSeen: [],
    uncertainties: [],
    provider,
    model,
  };
}

function isSimpleImageQuestion(message: string) {
  const normalized = message.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  return (
    normalized.length <= 180 &&
    (/\b(gambar|foto|media|image|photo)\b/.test(normalized) ||
      /\b(ini apa|apa ini|what is this|describe this)\b/.test(normalized)) &&
    /\b(apa|ini|deskripsi|deskripsikan|analisis|jelaskan|what|describe|analyze)\b/.test(
      normalized,
    )
  );
}

function shouldAnswerVisionDirectly(
  caption: VisionCaptionResult,
  locale: 'id' | 'en',
) {
  if (locale === 'en') return true;

  const combined = [
    caption.mainSubject,
    caption.description,
    ...caption.visibleDetails,
  ]
    .filter(Boolean)
    .join(' ');
  const englishMatches = combined.match(ENGLISH_RESPONSE_RE)?.length || 0;
  const indonesianMatches = combined.match(INDONESIAN_RESPONSE_RE)?.length || 0;

  return indonesianMatches >= 2 || englishMatches <= indonesianMatches + 1;
}

async function translateVisionCaptionForDirectResponse(
  caption: VisionCaptionResult,
  locale: 'id' | 'en',
) {
  if (locale !== 'id' || shouldAnswerVisionDirectly(caption, locale)) {
    return caption;
  }

  const source = cleanText(
    [
      caption.mainSubject ? `Main subject: ${caption.mainSubject}` : '',
      caption.description,
      caption.visibleDetails.length
        ? `Visible details: ${caption.visibleDetails.join('; ')}`
        : '',
      caption.colors.length ? `Colors: ${caption.colors.join(', ')}` : '',
      caption.textSeen.length
        ? `Readable text: ${caption.textSeen.join('; ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
    2_000,
  );
  if (!source) return caption;

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'Terjemahkan fakta visual ke Bahasa Indonesia natural. Jangan bertanya. Jangan menambah fakta baru. Jangan menebak merek, lokasi, harga, atau identitas. Jawab hanya deskripsi singkat 1-2 kalimat.',
    },
    {
      role: 'user',
      content: source,
    },
  ];

  try {
    const result = USE_OLLAMA
      ? await callOllama(messages, 0.05, [], 'id')
      : OPENAI_API_KEY
        ? await callOpenAI(messages, 0.05, [], 'id')
        : null;
    const translated = cleanText(result?.response, 1_200);
    if (
      translated &&
      !isSuspiciousNonLatinText(translated) &&
      !isVisionPlaceholderText(translated)
    ) {
      return {
        ...caption,
        description: translated,
        mainSubject: undefined,
        visibleDetails: [translated],
        colors: [],
        textSeen: caption.textSeen,
        provider: result
          ? `${caption.provider}+${result.provider}-translate`
          : caption.provider,
        model: result ? `${caption.model}+${result.model}` : caption.model,
      };
    }
  } catch (error) {
    console.warn('[PERSONAL_AI_PROVIDER_ERROR]', {
      provider: 'vision-translate',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return caption;
}

function buildDirectVisionResponse(
  caption: VisionCaptionResult,
  locale: 'id' | 'en',
) {
  const isId = locale === 'id';
  const details = caption.visibleDetails.length
    ? caption.visibleDetails
    : caption.description
      ? [caption.description]
      : [];
  const colors = caption.colors.length ? caption.colors.join(', ') : '';
  const textSeen = caption.textSeen.length ? caption.textSeen.join(', ') : '';
  const uncertainties = caption.uncertainties.length
    ? caption.uncertainties
    : [
        isId
          ? 'Saya hanya menjelaskan hal yang tampak dari gambar, bukan identitas, lokasi, harga, atau fakta yang tidak terlihat.'
          : 'I am only describing visible image details, not identity, location, price, or unsupported facts.',
      ];

  return [
    isId ? '## Analisis Gambar' : '## Image Analysis',
    caption.mainSubject
      ? `**${isId ? 'Objek utama' : 'Main subject'}:** ${caption.mainSubject}`
      : '',
    caption.description
      ? `**${isId ? 'Deskripsi' : 'Description'}:** ${caption.description}`
      : '',
    details.length
      ? [
          `**${isId ? 'Detail penting' : 'Important details'}:**`,
          ...details.map(item => `- ${item}`),
        ].join('\n')
      : '',
    colors
      ? `**${isId ? 'Warna yang terlihat' : 'Visible colors'}:** ${colors}`
      : '',
    textSeen
      ? `**${isId ? 'Teks yang terbaca' : 'Readable text'}:** ${textSeen}`
      : '',
    uncertainties.length
      ? [
          `**${isId ? 'Catatan' : 'Notes'}:**`,
          ...uncertainties.map(item => `- ${item}`),
        ].join('\n')
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildVisionSummaryForPrompt(
  caption: VisionCaptionResult,
  locale: 'id' | 'en',
) {
  const isId = locale === 'id';
  return [
    isId ? '[Hasil analisis visual gambar]' : '[Image vision analysis]',
    caption.mainSubject
      ? `${isId ? 'Objek utama' : 'Main subject'}: ${caption.mainSubject}`
      : '',
    caption.description
      ? `${isId ? 'Deskripsi' : 'Description'}: ${caption.description}`
      : '',
    caption.visibleDetails.length
      ? `${isId ? 'Detail terlihat' : 'Visible details'}: ${caption.visibleDetails.join('; ')}`
      : '',
    caption.colors.length
      ? `${isId ? 'Warna' : 'Colors'}: ${caption.colors.join(', ')}`
      : '',
    caption.textSeen.length
      ? `${isId ? 'Teks terbaca' : 'Readable text'}: ${caption.textSeen.join('; ')}`
      : '',
    caption.uncertainties.length
      ? `${isId ? 'Batasan/ketidakpastian' : 'Uncertainties'}: ${caption.uncertainties.join('; ')}`
      : '',
    isId
      ? 'Gunakan analisis visual ini sebagai fakta dasar. Jangan mengklaim hal di luar fakta ini kecuali ditandai sebagai asumsi kreatif.'
      : 'Use this visual analysis as the factual base. Do not claim beyond these facts unless clearly marked as a creative assumption.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildSystemPrompt(input: {
  agent: PersonalAiAgent;
  memory: PersonalAiMemory | null;
  locale: 'id' | 'en';
  domainContext?: string;
}) {
  const isId = input.locale === 'id';
  const memoryText =
    input.agent.memory_enabled && input.memory?.summary
      ? input.memory.summary
      : '';
  const builder = input.agent.builder_config;
  const builderText = builder
    ? [
        isId ? 'Konfigurasi AI mini-app:' : 'AI mini-app configuration:',
        `Nama mini-app: ${builder.branding.name}`,
        `Kategori: ${builder.branding.category || '-'}`,
        `Template: ${builder.templateId || '-'}`,
        `Mode model: ${builder.modelPolicy.mode}`,
        `Target model: ${builder.modelPolicy.preferredModelId || 'auto'}`,
        `Kemampuan wajib: ${
          builder.modelPolicy.requiredCapabilities.length
            ? builder.modelPolicy.requiredCapabilities.join(', ')
            : '-'
        }`,
        builder.instructions.baseInstruction
          ? `${isId ? 'Base instruction' : 'Base instruction'}:\n${builder.instructions.baseInstruction}`
          : '',
        builder.instructions.behaviorRules.length
          ? [
              isId ? 'Behavior rules:' : 'Behavior rules:',
              ...builder.instructions.behaviorRules.map(rule => `- ${rule}`),
            ].join('\n')
          : '',
        builder.output.sections.length
          ? [
              isId
                ? 'Output sections yang diharapkan:'
                : 'Expected output sections:',
              ...builder.output.sections.map(section =>
                [
                  `- ${section.title}: ${section.type}`,
                  section.description
                    ? `  Deskripsi: ${section.description}`
                    : '',
                  section.instruction
                    ? `  Instruksi: ${section.instruction}`
                    : '',
                ]
                  .filter(Boolean)
                  .join('\n'),
              ),
            ].join('\n')
          : '',
        isId
          ? [
              'Panduan format output:',
              '- Gunakan heading Markdown sesuai urutan output sections di atas.',
              '- Untuk section bertipe scene_collection, setiap scene wajib punya: nomor scene, durasi, tujuan cerita, visual prompt, subjek/produk, aksi, kamera, lighting, background, teks layar, voice over, sound cue, transisi, consistency notes, dan negative prompt.',
              '- Jika ada gambar dan user meminta prompt video, mulai dari fakta visual gambar, lalu ubah menjadi cerita/scene. Tandai asumsi kreatif dengan jelas.',
              '- Jangan memasukkan database schema, folder structure, PRD SaaS, atau bagian teknis internal kecuali user meminta eksplisit.',
            ].join('\n')
          : [
              'Output formatting guide:',
              '- Use Markdown headings in the same order as the expected output sections above.',
              '- For scene_collection sections, every scene must include: scene number, duration, story purpose, visual prompt, subject/product, action, camera, lighting, background, on-screen text, voice over, sound cue, transition, consistency notes, and negative prompt.',
              '- If an image is provided and the user asks for a video prompt, start from visible image facts, then translate them into story/scenes. Mark creative assumptions clearly.',
              '- Do not include database schemas, folder structures, SaaS PRDs, or internal technical sections unless explicitly requested.',
            ].join('\n'),
        builder.instructions.negativeInstruction
          ? `${isId ? 'Negative instruction' : 'Negative instruction'}:\n${builder.instructions.negativeInstruction}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  return [
    LAJUKAN_SYSTEM_PROMPT,
    '',
    isId
      ? 'Kamu sedang berjalan sebagai AI pribadi milik user Lajukan.'
      : 'You are running as a personal AI owned by a Lajukan user.',
    isId
      ? 'Ikuti instruksi pemilik AI selama tidak meminta hal berbahaya, ilegal, penipuan, kebocoran data rahasia, atau klaim pasti untung.'
      : 'Follow the owner instructions unless they request harmful, illegal, fraudulent, secret-leaking, or guaranteed-profit claims.',
    isId
      ? 'Jangan mengarang listing, harga, nomor kontak, supplier, legalitas, atau janji hasil. Jika data kurang, ajukan maksimal 2 pertanyaan.'
      : 'Do not invent listings, prices, contacts, suppliers, permits, or outcome promises. If data is missing, ask at most 2 questions.',
    isId
      ? 'Jika gambar benar-benar disertakan, analisis hanya hal yang terlihat. Jangan menebak identitas, lokasi, merek, harga, atau fakta yang tidak tampak jelas.'
      : 'When an image is provided, analyze only what is visibly supported. Do not guess identity, location, brand, price, or facts that are not clearly visible.',
    isId
      ? 'Bahasa jawaban wajib mengikuti bahasa pesan terakhir user. Jika user bertanya dalam Bahasa Indonesia, jawab dalam Bahasa Indonesia walaupun instruksi, riwayat, atau template memakai Bahasa Inggris.'
      : 'The answer language must follow the user latest message. If the user asks in English, answer in English even if previous context uses another language.',
    isId
      ? 'Jawab ringkas, praktis, dan cocok untuk pelaku usaha Indonesia.'
      : 'Answer concisely and practically for Indonesian local business operators.',
    isId
      ? 'Gunakan Markdown ringan: heading pendek, bullet seperlunya, dan bold secukupnya.'
      : 'Use light Markdown: short headings, useful bullets, and restrained bold text.',
    '',
    `Nama AI: ${input.agent.name}`,
    `Gaya jawaban: ${input.agent.tone}`,
    `Instruksi pemilik:\n${input.agent.instructions}`,
    input.domainContext || '',
    builderText,
    memoryText
      ? `${isId ? 'Memory personal yang boleh dipakai' : 'Allowed personal memory'}:\n${memoryText}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildMessages(input: {
  agent: PersonalAiAgent;
  memory: PersonalAiMemory | null;
  message: string;
  actionInstruction?: string;
  history: PersonalAiMessage[];
  locale: 'id' | 'en';
  media?: PersonalAiMediaContext[];
  domainContext?: string;
}): ChatMessage[] {
  const system: ChatMessage = {
    role: 'system',
    content: buildSystemPrompt({
      agent: input.agent,
      memory: input.memory,
      locale: input.locale,
      domainContext: input.domainContext,
    }),
  };

  const history = input.history
    .filter(item => item.role === 'user' || item.role === 'assistant')
    .filter(
      item =>
        item.role !== 'assistant' || !isSuspiciousNonLatinText(item.content),
    )
    .slice(-14)
    .map(item => ({
      role: item.role as 'user' | 'assistant',
      content: personalAiHistoryContent(item, input.locale),
    }));

  return [
    system,
    ...history,
    {
      role: 'user',
      content: buildUserMessageWithMediaContext(
        input.message,
        input.actionInstruction || '',
        input.media || [],
        input.locale,
      ),
    },
  ];
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

function buildUserMessageWithMediaContext(
  message: string,
  actionInstruction: string,
  media: PersonalAiMediaContext[],
  locale: 'id' | 'en',
) {
  const isId = locale === 'id';
  const hiddenInstruction = cleanText(actionInstruction, 1_600);
  const baseParts = [
    message,
    hiddenInstruction
      ? [
          '',
          isId
            ? '[Instruksi tombol dari creator]'
            : '[Creator button instruction]',
          hiddenInstruction,
        ].join('\n')
      : '',
  ].filter(Boolean);

  if (media.length === 0) return baseParts.join('\n');

  const mediaLines = media.map((item, index) => {
    const capability =
      item.kind === 'image' && item.dataUrl
        ? isId
          ? 'gambar tersedia untuk model vision'
          : 'image is available to the vision model'
        : item.text
          ? isId
            ? 'cuplikan teks file disertakan'
            : 'file text excerpt is included'
          : isId
            ? 'metadata saja'
            : 'metadata only';

    return `${index + 1}. ${item.kind}: ${cleanText(item.name, 180) || 'media'} (${cleanText(item.mime, 100) || 'unknown'}, ${Math.max(0, Number(item.size) || 0)} bytes) - ${capability}${
      item.text
        ? `\n   ${isId ? 'Cuplikan teks' : 'Text excerpt'}: ${cleanText(item.text, 1_400)}`
        : ''
    }`;
  });

  return [
    ...baseParts,
    '',
    isId ? '[Media yang dikirim user]' : '[Media sent by user]',
    ...mediaLines,
    '',
    isId
      ? [
          'Jika gambar diterima oleh model vision, jelaskan isi gambar secara langsung dan spesifik.',
          'Untuk foto produk: sebutkan objek utama, warna, bentuk, bahan/tekstur yang tampak, kemasan/label yang terbaca, kondisi visual, kemungkinan fungsi, target pembeli, ide caption/iklan, dan hal yang perlu dikonfirmasi.',
          'Pisahkan fakta visual dari asumsi. Jangan menebak merek, harga, lokasi, ukuran pasti, atau klaim yang tidak terlihat.',
          'Jika provider tidak menerima gambar, jangan berpura-pura melihatnya; beritahu bahwa gambar belum berhasil diproses.',
        ].join('\n')
      : [
          'If the vision model receives the image, describe the image directly and specifically.',
          'For product photos: mention the main object, colors, shape, visible material/texture, readable packaging/labels, visual condition, likely use case, target buyer, caption/ad ideas, and details to verify.',
          'Separate visible facts from assumptions. Do not guess brand, price, location, exact size, or unsupported claims.',
          'If the provider did not receive the image, do not pretend to see it; say that the image was not processed.',
        ].join('\n'),
  ].join('\n');
}

async function callOllamaVisionCaption(
  image: PreparedVisionImage,
  locale: 'id' | 'en',
): Promise<VisionCaptionResult> {
  const errors: string[] = [];
  for (const model of OLLAMA_VISION_MODELS) {
    try {
      return await callOllamaVisionCaptionWithModel(image, locale, model);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${model}: ${message}`);
      console.warn('[PERSONAL_AI_PROVIDER_ERROR]', {
        provider: 'ollama-vision',
        model,
        error: message,
      });
    }
  }
  throw new Error(
    `All Ollama vision models failed. ${errors.slice(0, 3).join(' | ')}`,
  );
}

async function callVisionCaption(
  image: PreparedVisionImage,
  locale: 'id' | 'en',
  preference: PersonalAiModelPreference,
): Promise<VisionCaptionResult> {
  const errors: string[] = [];
  const providers =
    preference === 'ollama'
      ? (['ollama', 'openai'] as const)
      : preference === 'openai'
        ? (['openai', 'ollama'] as const)
        : PERSONAL_AI_FAST_PROVIDER_FIRST
          ? (['openai', 'ollama'] as const)
          : (['ollama', 'openai'] as const);

  for (const provider of providers) {
    try {
      if (provider === 'openai' && OPENAI_API_KEY) {
        return await callOpenAiVisionCaption(image, locale);
      }
      if (provider === 'ollama' && USE_OLLAMA) {
        return await callOllamaVisionCaption(image, locale);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${provider}: ${message}`);
      console.warn('[PERSONAL_AI_PROVIDER_ERROR]', {
        provider: `${provider}-vision`,
        error: message,
      });
    }
  }

  throw new Error(
    `No working vision provider. ${errors.slice(0, 3).join(' | ')}`,
  );
}

async function callOpenAiVisionCaption(
  image: PreparedVisionImage,
  locale: 'id' | 'en',
): Promise<VisionCaptionResult> {
  const isId = locale === 'id';
  const instruction = isId
    ? [
        'Lihat pixel gambar yang dilampirkan secara langsung.',
        'Jawab dalam Bahasa Indonesia natural, 2-4 kalimat.',
        'Sebutkan objek utama, warna/bentuk yang terlihat, bahan/tekstur jika tampak, dan teks label yang benar-benar terbaca.',
        'Jangan menjawab dari nama file, ukuran file, atau metadata. Jangan menebak merek, harga, lokasi, identitas, atau ukuran pasti.',
      ].join('\n')
    : [
        'Look at the attached image pixels directly.',
        'Answer naturally in 2-4 sentences.',
        'Mention the main object, visible colors/shape, material/texture if visible, and any readable label text.',
        'Do not answer from filename, file size, or metadata. Do not guess brand, price, location, identity, or exact size.',
      ].join('\n');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_VISION_MODEL,
      temperature: 0.05,
      max_tokens: 900,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: instruction },
            {
              type: 'image_url',
              image_url: {
                url: image.dataUrl,
                detail: 'high',
              },
            },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`OpenAI vision ${res.status}: ${errorBody.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = cleanText(data.choices?.[0]?.message?.content, 12_000);
  const parsed = parseJsonObject(raw);
  if (!parsed) {
    throw new Error('OpenAI vision returned invalid JSON.');
  }

  return buildVisionCaptionResult(parsed, 'openai-vision', OPENAI_VISION_MODEL);
}

async function callOllamaVisionCaptionWithModel(
  image: PreparedVisionImage,
  locale: 'id' | 'en',
  model: string,
): Promise<VisionCaptionResult> {
  if (prefersPlainOllamaVision(model)) {
    return callOllamaVisionPlainCaptionWithModel(image, locale, model);
  }

  const isId = locale === 'id';
  const instruction = isId
    ? [
        'Analisis pixel gambar yang dilampirkan secara langsung.',
        'Jangan menjawab berdasarkan nama file, format, ukuran file, atau metadata.',
        'Jangan menebak identitas orang, lokasi, merek, harga, ukuran pasti, atau fakta yang tidak tampak jelas.',
        'Jawab hanya JSON valid tanpa markdown.',
        'Gunakan key: readable, main_subject, description, visible_details, colors, text_seen, uncertainties.',
        'Isi setiap value dengan hasil analisis visual nyata dari gambar. Jangan menyalin nama key, instruksi, atau placeholder schema.',
      ].join('\n')
    : [
        'Analyze the attached image pixels directly.',
        'Do not answer from filename, file format, file size, or metadata.',
        'Do not guess identity, location, brand, price, exact size, or unsupported facts.',
        'Return valid JSON only.',
        'Use these keys: readable, main_subject, description, visible_details, colors, text_seen, uncertainties.',
        'Fill every value with actual visual analysis from the image. Do not copy key names, instructions, or schema placeholders.',
      ].join('\n');

  const res = await fetch(`${trimBaseUrl(OLLAMA_URL)}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      keep_alive: OLLAMA_KEEP_ALIVE,
      messages: [
        {
          role: 'user',
          content: instruction,
          images: [image.base64],
        },
      ],
      options: {
        temperature: 0.05,
        num_ctx: OLLAMA_NUM_CTX,
        num_predict: 260,
        top_p: 0.8,
        repeat_penalty: 1.05,
      },
    }),
    signal: AbortSignal.timeout(EFFECTIVE_OLLAMA_VISION_TIMEOUT_MS),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`Ollama vision ${res.status}: ${errorBody.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    message?: { content?: string };
    response?: string;
  };
  const raw = cleanText(data.message?.content || data.response, 12_000);
  const parsed = parseJsonObject(raw);
  if (!parsed) {
    return buildPlainVisionCaptionResult(raw, 'ollama-vision', model);
  }

  try {
    return buildVisionCaptionResult(parsed, 'ollama-vision', model);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/placeholder|low-confidence|unsafe/i.test(message)) {
      return buildPlainVisionCaptionResult(raw, 'ollama-vision', model);
    }
    throw error;
  }
}

function prefersPlainOllamaVision(model: string) {
  return /(^|[:/\s-])moondream([:/\s-]|$)/i.test(model);
}

function selectOllamaChatVisionModel() {
  return (
    OLLAMA_VISION_MODELS.find(model => !prefersPlainOllamaVision(model)) ||
    OLLAMA_VISION_MODEL
  );
}

async function callOllamaVisionPlainCaptionWithModel(
  image: PreparedVisionImage,
  locale: 'id' | 'en',
  model: string,
): Promise<VisionCaptionResult> {
  const prompt =
    locale === 'id'
      ? [
          'What is in this image? Answer in one short sentence.',
          'Mention only visible objects and colors.',
          'Do not mention filename, file size, metadata, identity, price, or location.',
        ].join('\n')
      : [
          'What is in this image? Answer in one short sentence.',
          'Mention only visible objects and colors.',
          'Do not mention filename, file size, metadata, identity, price, or location.',
        ].join('\n');

  const res = await fetch(`${trimBaseUrl(OLLAMA_URL)}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      keep_alive: OLLAMA_KEEP_ALIVE,
      prompt,
      images: [image.base64],
      options: {
        temperature: 0.05,
        num_ctx: 1024,
        num_predict: 80,
        top_p: 0.8,
        repeat_penalty: 1.05,
      },
    }),
    signal: AbortSignal.timeout(EFFECTIVE_OLLAMA_VISION_TIMEOUT_MS),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(
      `Ollama plain vision ${res.status}: ${errorBody.slice(0, 500)}`,
    );
  }

  const data = (await res.json()) as {
    response?: string;
  };
  const raw = cleanText(data.response, 12_000);
  return buildPlainVisionCaptionResult(raw, 'ollama-vision-plain', model);
}

async function callOllama(
  messages: ChatMessage[],
  temperature: number,
  visionImages: PreparedVisionImage[],
  locale: 'id' | 'en',
): Promise<PersonalAiProviderResult> {
  const hasImages = visionImages.length > 0;
  const model = hasImages ? selectOllamaChatVisionModel() : OLLAMA_MODEL;

  const ollamaMessages: ChatMessage[] = messages.map((message, index) => {
    const isLastUserMessage =
      index === messages.length - 1 && message.role === 'user';

    if (!isLastUserMessage || !hasImages) return message;

    return {
      ...message,
      content: `${message.content}\n${buildVisionOnlyInstruction(locale)}`,
      images: visionImages.map(image => image.base64),
    };
  });
  const safeTemperature = hasImages ? Math.min(temperature, 0.2) : temperature;

  const res = await fetch(`${trimBaseUrl(OLLAMA_URL)}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: ollamaMessages,
      stream: false,
      think: false,
      keep_alive: OLLAMA_KEEP_ALIVE,
      options: {
        temperature: safeTemperature,
        num_ctx: OLLAMA_NUM_CTX,
        num_predict: OLLAMA_NUM_PREDICT,
        top_p: 0.9,
        repeat_penalty: 1.08,
      },
    }),
    signal: AbortSignal.timeout(
      hasImages ? EFFECTIVE_OLLAMA_VISION_TIMEOUT_MS : OLLAMA_TIMEOUT_MS,
    ),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`Ollama ${res.status}: ${errorBody.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    message?: {
      content?: string;
      thinking?: string;
    };
  };

  const response = cleanText(data.message?.content, 20_000);
  if (!response) {
    throw new Error('Ollama returned an empty response.');
  }

  if (hasImages) {
    rejectSuspiciousVisionResponse(response, locale, 'Ollama');
  }

  return {
    response,
    provider: 'ollama',
    model,
  };
}

async function callGroq(
  messages: ChatMessage[],
  temperature: number,
): Promise<PersonalAiProviderResult> {
  const model = 'llama-3.1-8b-instant';
  const textMessages = messages.map(({ role, content }) => ({ role, content }));

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: textMessages,
      max_tokens: 900,
      temperature,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`Groq ${res.status}: ${errorBody.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const response = cleanText(data.choices?.[0]?.message?.content, 20_000);

  if (!response) {
    throw new Error('Groq returned an empty response.');
  }

  return {
    response,
    provider: 'groq',
    model,
  };
}

async function callOpenAI(
  messages: ChatMessage[],
  temperature: number,
  visionImages: PreparedVisionImage[],
  locale: 'id' | 'en',
): Promise<PersonalAiProviderResult> {
  const model = visionImages.length > 0 ? OPENAI_VISION_MODEL : AI_MODEL;

  const openAiMessages: OpenAiMessage[] =
    visionImages.length > 0
      ? messages.map((message, index) =>
          index === messages.length - 1 && message.role === 'user'
            ? {
                role: message.role,
                content: [
                  {
                    type: 'text',
                    text: `${message.content}\n${buildVisionOnlyInstruction(locale)}`,
                  },
                  ...visionImages.slice(0, 4).map(image => ({
                    type: 'image_url' as const,
                    image_url: {
                      url: image.dataUrl,
                      detail: 'auto' as const,
                    },
                  })),
                ],
              }
            : {
                role: message.role,
                content: message.content,
              },
        )
      : messages.map(({ role, content }) => ({ role, content }));

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: openAiMessages,
      max_tokens: 1_200,
      temperature,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`OpenAI ${res.status}: ${errorBody.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const response = cleanText(data.choices?.[0]?.message?.content, 20_000);

  if (!response) {
    throw new Error('OpenAI returned an empty response.');
  }

  if (visionImages.length > 0) {
    rejectSuspiciousVisionResponse(response, locale, 'OpenAI');
  }

  return {
    response,
    provider: 'openai',
    model,
  };
}

async function callInternalAi(
  messages: ChatMessage[],
  agent: PersonalAiAgent,
): Promise<PersonalAiProviderResult> {
  const textMessages = messages.map(({ role, content }) => ({ role, content }));

  const res = await fetch(`${trimBaseUrl(INTERNAL_AI_URL)}/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: textMessages,
      message: textMessages[textMessages.length - 1]?.content || '',
      agent: {
        id: agent.id,
        name: agent.name,
        instructions: agent.instructions,
        tone: agent.tone,
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  const data = (await res.json().catch(() => ({}))) as {
    response?: string;
    message?: string;
    model?: string;
    error?: string;
  };

  const response = cleanText(data.response || data.message, 20_000);

  if (res.ok && response) {
    return {
      response,
      provider: 'internal-ai',
      model: cleanText(data.model, 120) || 'internal-ai',
    };
  }

  throw new Error(data.error || `Internal AI ${res.status}`);
}

function providerOrder(
  preference: PersonalAiModelPreference,
  hasVisionMedia: boolean,
  hasAnalyzedVisionContext = false,
) {
  if (hasVisionMedia) {
    if (preference === 'openai') {
      return ['openai', 'ollama'] as const;
    }

    if (preference === 'ollama') {
      return ['ollama', 'openai'] as const;
    }

    // Groq model yang dipakai di file ini bersifat text-only.
    // Untuk pesan bergambar, prioritaskan provider vision terlebih dahulu.
    if (preference === 'groq') {
      return ['ollama', 'openai'] as const;
    }

    if (PERSONAL_AI_FAST_PROVIDER_FIRST && OPENAI_API_KEY) {
      return ['openai', 'ollama'] as const;
    }

    return ['ollama', 'openai'] as const;
  }

  if (hasAnalyzedVisionContext && preference === 'auto') {
    return ['ollama', 'internal', 'openai', 'groq'] as const;
  }

  if (preference === 'ollama') {
    return ['ollama', 'internal', 'groq', 'openai'] as const;
  }

  if (preference === 'groq') {
    return ['groq', 'ollama', 'internal', 'openai'] as const;
  }

  if (preference === 'openai') {
    return ['openai', 'ollama', 'internal', 'groq'] as const;
  }

  if (PERSONAL_AI_FAST_PROVIDER_FIRST) {
    return ['groq', 'internal', 'ollama', 'openai'] as const;
  }

  return ['ollama', 'internal', 'groq', 'openai'] as const;
}

export async function runPersonalAi(input: {
  agent: PersonalAiAgent;
  memory: PersonalAiMemory | null;
  message: string;
  actionInstruction?: string;
  history: PersonalAiMessage[];
  locale: 'id' | 'en';
  media?: PersonalAiMediaContext[];
}): Promise<
  PersonalAiProviderResult & {
    provider_errors: string[];
  }
> {
  const sanitizedMessage = cleanText(input.message, 3_500);
  const responseLocale = detectUserMessageLocale(
    sanitizedMessage,
    input.locale,
  );
  const media = (input.media || []).slice(0, 4).map(item => ({
    ...item,
    name: cleanText(item.name, 180),
    mime: cleanText(item.mime, 100),
    size: Math.max(0, Number(item.size) || 0),
    text: item.text ? cleanText(item.text, 4_000) : undefined,
    url: item.url ? cleanText(item.url, 500) : undefined,
  }));

  const domainKnowledge = await loadLajukanDomainKnowledge();
  const domainContext = buildLajukanDomainKnowledgePrompt({
    query: sanitizedMessage,
    media,
    locale: responseLocale,
    items: domainKnowledge,
  });
  const preparedVision = prepareVisionImages(media);
  const baseMessages = buildMessages({
    agent: input.agent,
    memory: input.memory,
    message: sanitizedMessage,
    actionInstruction: cleanText(input.actionInstruction, 1_600),
    history: input.history,
    locale: responseLocale,
    media,
    domainContext,
  });

  const errors: string[] = [...preparedVision.errors];
  const temperature = Math.max(
    0,
    Math.min(1, Number(input.agent.temperature) || 0),
  );
  const hadVisionMedia = preparedVision.images.length > 0;
  let messages = baseMessages;
  let visionImages = preparedVision.images;
  let visionCaption: VisionCaptionResult | null = null;

  if (hadVisionMedia && (USE_OLLAMA || OPENAI_API_KEY)) {
    try {
      visionCaption = await callVisionCaption(
        preparedVision.images[0]!,
        responseLocale,
        input.agent.model_preference,
      );

      if (isSimpleImageQuestion(sanitizedMessage)) {
        const directCaption = await translateVisionCaptionForDirectResponse(
          visionCaption,
          responseLocale,
        );
        if (shouldAnswerVisionDirectly(directCaption, responseLocale)) {
          return {
            response: buildDirectVisionResponse(directCaption, responseLocale),
            provider: directCaption.provider,
            model: directCaption.model,
            provider_errors: errors,
          };
        }
      }

      const summary = buildVisionSummaryForPrompt(
        visionCaption,
        responseLocale,
      );
      const visionDomainContext = buildLajukanDomainKnowledgePrompt({
        query: `${sanitizedMessage}\n${summary}`,
        media,
        locale: responseLocale,
        items: domainKnowledge,
      });
      const lastMessage = baseMessages[baseMessages.length - 1];
      messages = lastMessage
        ? [
            ...baseMessages.slice(0, -1),
            {
              ...lastMessage,
              content: `${summary}\n\n${visionDomainContext}\n\n${lastMessage.content}`,
            },
          ]
        : baseMessages;
      // Once the image has been decoded into visual facts, keep the follow-up
      // generation text-only. This prevents Qwen-VL from ignoring pixels and
      // answering from metadata/history on the second pass.
      visionImages = [];
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push(`vision-preflight: ${errorMessage}`);
      console.warn('[PERSONAL_AI_PROVIDER_ERROR]', {
        provider: 'vision-preflight',
        error: errorMessage,
      });
    }
  }

  for (const provider of providerOrder(
    input.agent.model_preference,
    visionImages.length > 0,
    hadVisionMedia && Boolean(visionCaption),
  )) {
    try {
      if (provider === 'ollama' && USE_OLLAMA) {
        if (
          hadVisionMedia &&
          visionImages.length > 0 &&
          !preparedVision.errors.length
        ) {
          return {
            ...(await callOllama(
              messages,
              temperature,
              visionImages,
              responseLocale,
            ).then(result => validateProviderLanguage(result, responseLocale))),
            provider_errors: errors,
          };
        }

        if (hadVisionMedia && visionImages.length > 0) {
          errors.push(
            'ollama: skipped generic vision chat after vision preflight failed.',
          );
          continue;
        }
        return {
          ...(await callOllama(
            messages,
            temperature,
            visionImages,
            responseLocale,
          ).then(result => validateProviderLanguage(result, responseLocale))),
          provider_errors: errors,
        };
      }

      if (provider === 'openai' && OPENAI_API_KEY) {
        if (
          hadVisionMedia &&
          visionImages.length > 0 &&
          !preparedVision.errors.length
        ) {
          return {
            ...(await callOpenAI(
              messages,
              temperature,
              visionImages,
              responseLocale,
            ).then(result => validateProviderLanguage(result, responseLocale))),
            provider_errors: errors,
          };
        }

        if (hadVisionMedia && visionImages.length > 0) {
          errors.push(
            'openai: skipped generic vision chat after vision preflight failed.',
          );
          continue;
        }
        return {
          ...(await callOpenAI(
            messages,
            temperature,
            visionImages,
            responseLocale,
          ).then(result => validateProviderLanguage(result, responseLocale))),
          provider_errors: errors,
        };
      }

      if (provider === 'internal' && INTERNAL_AI_URL) {
        return {
          ...(await callInternalAi(messages, input.agent).then(result =>
            validateProviderLanguage(result, responseLocale),
          )),
          provider_errors: errors,
        };
      }

      if (provider === 'groq' && GROQ_API_KEY) {
        return {
          ...(await callGroq(messages, temperature).then(result =>
            validateProviderLanguage(result, responseLocale),
          )),
          provider_errors: errors,
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push(`${provider}: ${errorMessage}`);
      console.warn('[PERSONAL_AI_PROVIDER_ERROR]', {
        provider,
        error: errorMessage,
      });
    }
  }

  if (visionCaption) {
    return {
      response: buildDirectVisionResponse(visionCaption, responseLocale),
      provider: visionCaption.provider,
      model: visionCaption.model,
      provider_errors: errors.slice(0, 6),
    };
  }

  const imageWasSent = media.some(
    item =>
      item.kind === 'image' && (Boolean(item.dataUrl) || Boolean(item.url)),
  );

  return {
    response:
      responseLocale === 'id'
        ? imageWasSent
          ? hadVisionMedia
            ? 'Foto sudah diterima, tapi model vision belum berhasil membaca gambar ini dengan aman. Aku tidak mau menebak isi gambar dari metadata saja. Coba kirim ulang foto yang sama, atau kompres ke JPG/PNG/WEBP yang lebih kecil agar analisis vision bisa diproses lagi.'
            : 'Foto sudah diterima, tapi belum bisa dikirim ke model vision. Pastikan formatnya JPG, PNG, WEBP, atau GIF dan ukurannya sudah dikompres, lalu kirim ulang.'
          : 'AI sedang belum bisa merespons. Coba kirim ulang sebentar lagi.'
        : imageWasSent && !hadVisionMedia
          ? 'The photo was received, but it could not be sent to the vision model. Use JPG, PNG, WEBP, or GIF, compress it, and send it again.'
          : imageWasSent
            ? 'The photo was received, but the vision model could not read it safely. I will not guess from metadata only. Please retry with a smaller JPG/PNG/WEBP image.'
            : 'AI is not ready to respond. Please try again shortly.',
    provider: 'safe-fallback',
    model: 'personal-ai-fallback',
    provider_errors: errors.slice(0, 6),
  };
}
