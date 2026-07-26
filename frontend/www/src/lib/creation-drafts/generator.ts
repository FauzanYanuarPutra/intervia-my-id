import type {
  BusinessProfileDraftPayload,
  DraftFieldMetadata,
  DraftMedia,
  DraftWarning,
  LookingForDraftPayload,
  OfferingDraftPayload,
  SupportedCreationDraftPayload,
  SupportedCreationTarget,
} from './types';

type GenerateCreationDraftInput = {
  target?: SupportedCreationTarget;
  instruction: string;
  assistantContext?: string;
  media: DraftMedia[];
  locale: 'id' | 'en';
};

export type GeneratedCreationDraft = {
  target: SupportedCreationTarget;
  title: string;
  summary: string;
  payload: SupportedCreationDraftPayload;
  fieldMetadata: DraftFieldMetadata[];
  completenessScore: number;
  missingRequiredFields: string[];
  warnings: DraftWarning[];
  provider: 'ollama+rules' | 'local-rules';
};

type ListingCategory = {
  categorySlug: string;
  subcategorySlug: string;
};

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
const USE_OLLAMA = process.env.USE_OLLAMA === 'true';

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string'
    ? value
        .replace(/\u0000/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength)
    : '';
}

function cleanMultilineText(value: unknown, maxLength: number) {
  return typeof value === 'string'
    ? value
        .replace(/\u0000/g, '')
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .trim()
        .slice(0, maxLength)
    : '';
}

function lower(value: string) {
  return value.toLocaleLowerCase('id-ID');
}

export function detectCreationTarget(
  text: string,
): SupportedCreationTarget | null {
  const value = lower(text);
  if (
    /\b(profil usaha|daftar(?:kan)? usaha|buat usaha|business profile|register business)\b/.test(
      value,
    )
  ) {
    return 'business_profile';
  }
  if (
    /\b(cari|mencari|butuh|membutuhkan|dibutuhkan|need|looking for|supplier yang dicari)\b/.test(
      value,
    )
  ) {
    return 'looking_for_listing';
  }
  if (
    /\b(jual|menjual|tawarkan|menawarkan|disewakan|offer|sell|for sale)\b/.test(
      value,
    )
  ) {
    return 'offering_listing';
  }
  return null;
}

function detectCategory(text: string): ListingCategory {
  const value = lower(text);
  if (
    /\b(mesin|alat|equipment|sealer|oven|freezer|kompor|printer|mesin kopi)\b/.test(
      value,
    )
  ) {
    return {
      categorySlug: 'equipment',
      subcategorySlug: /makanan|minuman|kopi|oven|sealer/.test(value)
        ? 'food-beverage-machines'
        : 'production-machines',
    };
  }
  if (
    /\b(jasa|layanan|service|teknisi|desain|konsultan|fotografer|marketing)\b/.test(
      value,
    )
  ) {
    return {
      categorySlug: 'service',
      subcategorySlug: /desain|foto|kreatif/.test(value)
        ? 'creative-design'
        : /teknisi|perbaikan|servis/.test(value)
          ? 'technical-repair'
          : 'business-operations',
    };
  }
  if (
    /\b(ruko|kios|gudang|lahan|booth|lapak|kantor|properti|property)\b/.test(
      value,
    )
  ) {
    return {
      categorySlug: 'property',
      subcategorySlug: /ruko/.test(value)
        ? 'shop-houses'
        : /gudang/.test(value)
          ? 'warehouses'
          : /booth|lapak/.test(value)
            ? 'booths-stalls'
            : 'kiosks',
    };
  }
  if (
    /\b(franchise|waralaba|reseller|dropship|kemitraan|peluang usaha)\b/.test(
      value,
    )
  ) {
    return {
      categorySlug: 'opportunity',
      subcategorySlug: /franchise|waralaba/.test(value)
        ? 'franchise'
        : /reseller/.test(value)
          ? 'reseller'
          : 'partnerships',
    };
  }
  return {
    categorySlug: 'supplies',
    subcategorySlug: /kemasan|pouch|botol|cup|dus|box/.test(value)
      ? 'business-packaging'
      : /bahan baku|tepung|kopi|gula|kayu|kain/.test(value)
        ? 'raw-materials'
        : 'resale-products',
  };
}

function detectIndustry(text: string): string[] {
  const value = lower(text);
  if (/makanan|minuman|kopi|roti|tepung|kuliner|cafe|kafe/.test(value))
    return ['food-beverage'];
  if (/fashion|baju|kain|konveksi|sepatu|tas/.test(value))
    return ['fashion-garment'];
  if (/skincare|kosmetik|salon|kecantikan/.test(value))
    return ['cosmetics-care'];
  if (/tani|pertanian|pupuk|bibit/.test(value)) return ['agriculture'];
  if (/bengkel|otomotif|motor|mobil/.test(value))
    return ['automotive-workshop'];
  if (/software|aplikasi|digital|komputer|teknologi/.test(value))
    return ['technology'];
  if (/bangunan|konstruksi|material bangunan/.test(value))
    return ['construction'];
  if (/toko|retail|grosir|reseller/.test(value)) return ['retail'];
  return ['other'];
}

function detectBusinessCategory(text: string) {
  const value = lower(text);
  if (/warung|kios|lapak/.test(value)) return 'warung_kios';
  if (/grosir|sembako|retail|supplier|distributor/.test(value))
    return 'grocery_retail';
  if (/fashion|baju|kain|konveksi|sepatu|tas/.test(value))
    return 'fashion_apparel';
  if (/skincare|kosmetik|salon|kecantikan|parfum/.test(value))
    return 'beauty_personal_care';
  if (/kerajinan|souvenir|hampers|kriya/.test(value)) return 'crafts_souvenirs';
  if (/bengkel|otomotif|perkakas/.test(value)) return 'automotive_tools';
  if (/jasa|layanan|service|teknisi/.test(value)) return 'services_local';
  if (/software|digital|desain|kreatif/.test(value)) return 'digital_creative';
  if (/tani|pertanian|ikan|ternak/.test(value)) return 'agri_fishery';
  return 'culinary';
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function labeledValue(text: string, labels: string[]) {
  const pattern = new RegExp(
    `(?:^|\\n)\\s*(?:${labels.map(escapeRegExp).join('|')})\\s*:\\s*([^\\n]+)`,
    'i',
  );
  return cleanText(pattern.exec(text)?.[1], 500);
}

function detectLocationText(text: string) {
  const labeled = labeledValue(text, [
    'Lokasi / area layanan',
    'Lokasi tujuan',
    'Alamat / area usaha',
    'Lokasi',
    'Alamat',
    'Area',
  ]);
  if (labeled) return cleanText(labeled, 80);
  const match = text.match(
    /\b(?:lokasi|area|alamat|di|ke)\s+([a-z][a-z\s.-]{2,60}?)(?=\s+(?:dengan|harga|budget|kondisi|seharga|dan)\b|[,.]|$)/i,
  );
  return cleanText(match?.[1], 80);
}

function detectMoney(text: string) {
  const match = text.match(
    /(?:rp\.?\s*)?(\d[\d.]{2,})(?:\s*(ribu|juta|miliar))?/i,
  );
  if (!match) return undefined;
  const digits = Number.parseInt(match[1].replace(/\D/g, ''), 10);
  if (!Number.isFinite(digits)) return undefined;
  const multiplier =
    lower(match[2] || '') === 'ribu'
      ? 1_000
      : lower(match[2] || '') === 'juta'
        ? 1_000_000
        : lower(match[2] || '') === 'miliar'
          ? 1_000_000_000
          : 1;
  return digits * multiplier;
}

function detectQuantity(text: string) {
  const labeled = labeledValue(text, ['Jumlah', 'Kuantitas', 'Qty', 'Volume']);
  const source = labeled || text;
  const match = source.match(
    /\b(\d+(?:[.,]\d+)?)\s*(kg|gram|g|ton|liter|l|ml|pcs|unit|dus|box)\b/i,
  );
  if (!match) return {};
  const rawQuantity = match[1];
  const normalizedQuantity = /^\d{1,3}(?:\.\d{3})+$/.test(rawQuantity)
    ? rawQuantity.replace(/\./g, '')
    : rawQuantity.replace(',', '.');
  return {
    quantity: Number.parseFloat(normalizedQuantity),
    unit: lower(match[2]),
  };
}

function detectCondition(text: string): 'new' | 'used' | undefined {
  const value = lower(text);
  if (/\b(bekas|second|seken|used)\b/.test(value)) return 'used';
  if (/\b(baru|new)\b/.test(value)) return 'new';
  return undefined;
}

function candidateTitle(
  instruction: string,
  assistantContext: string,
  target: SupportedCreationTarget,
) {
  const explicitTitle =
    target === 'business_profile'
      ? labeledValue(instruction, ['Nama usaha', 'Nama bisnis'])
      : target === 'looking_for_listing'
        ? labeledValue(instruction, [
            'Barang / jasa yang dibutuhkan',
            'Barang yang dibutuhkan',
            'Jasa yang dibutuhkan',
            'Kebutuhan',
          ])
        : labeledValue(instruction, [
            'Nama produk / jasa',
            'Nama produk',
            'Nama jasa',
            'Nama penawaran',
          ]);
  if (explicitTitle) return cleanText(explicitTitle, 110);
  const fromContext = assistantContext
    .split(/\r?\n/)
    .map(line => cleanText(line.replace(/^#+|^[*-]\s*|\*\*/g, ''), 140))
    .find(
      line => line.length >= 6 && line.length <= 100 && !/[.!?]$/.test(line),
    );
  if (fromContext) return fromContext;

  const stripped = cleanText(
    instruction.replace(
      /^(tolong\s+)?(buatkan|buat|saya\s+mau|aku\s+mau|mohon)?\s*(jual|menjual|tawarkan|menawarkan|mencari|cari|butuh|daftarkan)?\s*/i,
      '',
    ),
    110,
  );
  if (stripped.length >= 6) return stripped;
  if (target === 'business_profile') return 'Profil usaha baru';
  if (target === 'looking_for_listing') return 'Kebutuhan usaha baru';
  return 'Penawaran usaha baru';
}

function shortSummary(instruction: string, assistantContext: string) {
  const details = labeledValue(instruction, [
    'Keunggulan / kondisi',
    'Spesifikasi / kriteria',
    'Keunggulan usaha',
    'Deskripsi',
    'Detail',
  ]);
  if (details) return cleanText(details, 280);
  const source =
    cleanText(instruction, 280) || cleanText(assistantContext, 280);
  return source || 'Draft disiapkan dari percakapan Profile AI.';
}

function metadataFor(
  fields: string[],
  source: DraftFieldMetadata['source'],
  requiresConfirmation: boolean,
): DraftFieldMetadata[] {
  return fields.map(field => ({
    field,
    source,
    confidence: source === 'user_message' ? 0.96 : 0.68,
    requiresConfirmation,
  }));
}

function computeCompleteness(total: number, missing: string[]) {
  return Math.max(10, Math.round(((total - missing.length) / total) * 100));
}

function buildLocalDraft(
  input: GenerateCreationDraftInput,
): GeneratedCreationDraft {
  const context = `${input.instruction}\n${input.assistantContext || ''}`;
  const target =
    input.target || detectCreationTarget(context) || 'offering_listing';
  const title = candidateTitle(
    input.instruction,
    input.assistantContext || '',
    target,
  );
  const summary = shortSummary(input.instruction, input.assistantContext || '');
  const locationText = detectLocationText(input.instruction);
  const mediaAssetIds = input.media.map(item => item.assetId);
  const warnings: DraftWarning[] = [];
  const fieldMetadata = [
    ...metadataFor(['title', 'description'], 'user_message', false),
  ];

  if (target === 'business_profile') {
    const businessName = title.replace(/^profil usaha\s*/i, '').trim();
    const payload: BusinessProfileDraftPayload = {
      target,
      businessName,
      description: summary,
      businessCategory: detectBusinessCategory(context),
      locationText: locationText || undefined,
      logoAssetId: mediaAssetIds[0],
      coverAssetId: mediaAssetIds[0],
      galleryAssetIds: mediaAssetIds,
    };
    const missing = [
      ...(!businessName ? ['businessName'] : []),
      ...(!input.media.length ? ['businessPhoto'] : []),
      'locationConfirmation',
      'businessCategoryConfirmation',
    ];
    fieldMetadata.push(
      ...metadataFor(['businessCategory'], 'ai_inference', true),
      ...(locationText
        ? metadataFor(['locationText'], 'user_message', true)
        : []),
    );
    warnings.push({
      code: 'confirm_business_category',
      field: 'businessCategory',
      message: 'Kategori usaha masih berupa saran dan perlu diperiksa.',
    });
    return {
      target,
      title: businessName || title,
      summary,
      payload,
      fieldMetadata,
      completenessScore: computeCompleteness(6, missing),
      missingRequiredFields: missing,
      warnings,
      provider: 'local-rules',
    };
  }

  const category = detectCategory(context);
  const industryIds = detectIndustry(context);
  const money = detectMoney(input.instruction);
  const quantity = detectQuantity(input.instruction);
  fieldMetadata.push(
    ...metadataFor(
      ['categorySlug', 'subcategorySlug', 'industryIds'],
      'ai_inference',
      true,
    ),
    ...(locationText
      ? metadataFor(['locationText'], 'user_message', true)
      : []),
  );
  warnings.push({
    code: 'confirm_taxonomy',
    field: 'subcategorySlug',
    message:
      'Kategori dan subkategori adalah saran AI. Periksa sebelum menerbitkan.',
  });

  if (target === 'looking_for_listing') {
    const payload: LookingForDraftPayload = {
      target,
      title,
      description: summary,
      ...category,
      industryIds,
      ...quantity,
      budgetMax: money,
      locationText: locationText || undefined,
      mediaAssetIds,
    };
    const missing = [
      ...(!title ? ['title'] : []),
      ...(!locationText ? ['location'] : ['locationConfirmation']),
      ...(!quantity.quantity ? ['quantity'] : []),
    ];
    return {
      target,
      title,
      summary,
      payload,
      fieldMetadata,
      completenessScore: computeCompleteness(8, missing),
      missingRequiredFields: missing,
      warnings,
      provider: 'local-rules',
    };
  }

  const condition = detectCondition(input.instruction);
  const payload: OfferingDraftPayload = {
    target,
    title,
    description: summary,
    ...category,
    industryIds,
    price: money,
    priceType: money ? 'fixed' : 'negotiable',
    condition,
    locationText: locationText || undefined,
    mediaAssetIds,
    contactPreference: 'chat',
  };
  if (condition) {
    fieldMetadata.push(...metadataFor(['condition'], 'user_message', false));
  }
  const missing = [
    ...(!title ? ['title'] : []),
    ...(!locationText ? ['location'] : ['locationConfirmation']),
    ...(!money ? ['price'] : []),
  ];
  return {
    target,
    title,
    summary,
    payload,
    fieldMetadata,
    completenessScore: computeCompleteness(8, missing),
    missingRequiredFields: missing,
    warnings,
    provider: 'local-rules',
  };
}

function parseJsonObject(text: string) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function improveWithOllama(
  input: GenerateCreationDraftInput,
  fallback: GeneratedCreationDraft,
): Promise<GeneratedCreationDraft> {
  if (!USE_OLLAMA) return fallback;
  const prompt = `You are a structured draft assistant for Lajukan. Improve only the title and summary using facts explicitly present in the user instruction and prior assistant analysis. Do not invent price, location, condition, capacity, certification, contact data, or product identity. Return valid JSON only: {"title":"...","summary":"..."}. Language: ${input.locale}. Target: ${fallback.target}. User instruction: ${JSON.stringify(input.instruction)}. Prior assistant analysis: ${JSON.stringify(input.assistantContext || '')}.`;
  try {
    const response = await fetch(
      `${OLLAMA_URL.replace(/\/$/, '')}/api/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt,
          stream: false,
          options: { temperature: 0.1 },
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok) return fallback;
    const raw = (await response.json().catch(() => ({}))) as {
      response?: unknown;
    };
    const parsed = parseJsonObject(cleanText(raw.response, 1600));
    const title = cleanText(parsed?.title, 120);
    const summary = cleanText(parsed?.summary, 500);
    if (!title || !summary) return fallback;
    const improvedPayload: SupportedCreationDraftPayload =
      fallback.payload.target === 'business_profile'
        ? { ...fallback.payload, businessName: title, description: summary }
        : { ...fallback.payload, title, description: summary };
    return {
      ...fallback,
      title,
      summary,
      payload: improvedPayload,
      provider: 'ollama+rules',
    };
  } catch {
    return fallback;
  }
}

export async function generateCreationDraft(
  input: GenerateCreationDraftInput,
): Promise<GeneratedCreationDraft> {
  const normalized: GenerateCreationDraftInput = {
    ...input,
    instruction: cleanMultilineText(input.instruction, 3500),
    assistantContext: cleanMultilineText(input.assistantContext, 5000),
    media: input.media.slice(0, 10),
  };
  const fallback = buildLocalDraft(normalized);
  return improveWithOllama(normalized, fallback);
}
