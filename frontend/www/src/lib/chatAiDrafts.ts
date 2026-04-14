import type { CreateRouteTypeId } from '@/lib/createRoutes';
import type { ListingSide } from '@/lib/content/listingSide';
import { buildContentHref } from '@/lib/content/routes';
import { toMarketSideValue } from '@/lib/content/listingSide';

export type AiRoomDraftWorkspace = 'listing' | 'company';

export type AiRoomDraftResult = {
  workspace: AiRoomDraftWorkspace;
  contentType: CreateRouteTypeId;
  listingSide: ListingSide;
  pricingMode: 'fixed' | 'request';
  title: string;
  summary: string;
  body: string;
  priceCents?: number;
  tags: string[];
  metadata: Record<string, unknown>;
  reviewNotes: string[];
  followUpQuestions: string[];
  assumptions: string[];
};

const CARD_METADATA_KEYS = [
  'cover_image',
  'image',
  'thumbnail',
  'logo',
  'avatar',
  'avatar_url',
  'banner',
  'promo_label',
  'company_name',
  'industry_focus',
  'company_size',
  'headquarters',
  'website',
  'founded_year',
  'delivery_time',
  'service_scope',
  'deliverables',
  'work_mode',
  'salary_range',
  'must_have_skills',
  'responsibilities',
  'property_type',
  'area_sqm',
  'available_from',
  'pickup_location',
  'rental_rate_type',
  'deposit_amount_cents',
  'condition',
  'availability_status',
  'brand',
  'model_name',
  'hiring_focus',
] as const;

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function parsePositiveInteger(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const raw =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(raw)) return undefined;
  const normalized = Math.trunc(raw);
  return normalized > 0 ? normalized : undefined;
}

function sanitizeStringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: string[] = [];

  for (const entry of value) {
    const text =
      typeof entry === 'string'
        ? entry.trim()
        : typeof entry === 'number'
          ? String(entry)
          : '';
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(text.slice(0, 220));
    if (items.length >= limit) break;
  }

  return items;
}

function sanitizeMetadataValue(
  value: unknown,
  depth = 0,
): string | number | boolean | string[] | Record<string, unknown> | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    const text = value.trim();
    return text ? text.slice(0, 1500) : undefined;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    const list = sanitizeStringList(value, 8);
    return list.length > 0 ? list : undefined;
  }
  if (typeof value !== 'object' || depth >= 2) return undefined;

  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const cleanKey = key.trim();
    if (!cleanKey) continue;
    const normalized = sanitizeMetadataValue(entry, depth + 1);
    if (normalized !== undefined) {
      next[cleanKey] = normalized;
    }
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function sanitizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const cleanKey = key.trim();
    if (!cleanKey) continue;
    const normalized = sanitizeMetadataValue(entry);
    if (normalized !== undefined) {
      next[cleanKey] = normalized;
    }
  }
  return next;
}

function pickMetadataString(
  metadata: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function buildCardPreviewFields(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const preview: Record<string, unknown> = {};

  for (const key of CARD_METADATA_KEYS) {
    if (metadata[key] !== undefined) {
      preview[key] = metadata[key];
    }
  }

  const coverImage =
    typeof preview.cover_image === 'string' && preview.cover_image.trim()
      ? preview.cover_image
      : pickMetadataString(metadata, [
          'image',
          'thumbnail',
          'logo',
          'avatar',
          'avatar_url',
          'banner',
        ]);
  if (typeof coverImage === 'string' && coverImage.trim()) {
    preview.cover_image = coverImage;
  }

  const location = pickMetadataString(metadata, [
    'location',
    'headquarters',
    'pickup_location',
  ]);
  if (location) {
    preview.location = location;
  }

  return preview;
}

function canonicalContentType(value: unknown): CreateRouteTypeId {
  const normalized = cleanText(value, 80).toLowerCase();
  if (normalized === 'product') return 'product';
  if (normalized === 'service') return 'service';
  if (normalized === 'job') return 'job';
  if (normalized === 'property') return 'property';
  if (
    normalized === 'tool_rental' ||
    normalized === 'tool-rental' ||
    normalized === 'rental'
  ) {
    return 'tool_rental';
  }
  if (
    normalized === 'company' ||
    normalized === 'company_profile' ||
    normalized === 'business' ||
    normalized === 'business_profile'
  ) {
    return 'company';
  }
  return 'service';
}

function extractJsonObject(
  value: string,
): Record<string, unknown> | null {
  const direct = value.trim();
  const candidates = [
    direct,
    direct.match(/```json\s*([\s\S]+?)```/i)?.[1] || '',
    direct.match(/```([\s\S]+?)```/i)?.[1] || '',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try next candidate
    }
  }

  const firstBrace = direct.indexOf('{');
  const lastBrace = direct.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(
        direct.slice(firstBrace, lastBrace + 1),
      ) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }

  return null;
}

function resolvePayloadRoot(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const nestedKeys = ['draft', 'result', 'data', 'payload'];
  for (const key of nestedKeys) {
    const nested = value[key];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return nested as Record<string, unknown>;
    }
  }
  return value;
}

export function buildDefaultAiRoomDraftPrompt(
  workspace: AiRoomDraftWorkspace,
  locale: 'id' | 'en',
  options?: {
    lastIncoming?: string | null;
  },
): string {
  const context = cleanText(options?.lastIncoming, 280);

  if (workspace === 'company') {
    return locale === 'id'
      ? [
          'Tolong bantu buat draft profil usaha yang meyakinkan tapi tetap realistis.',
          '',
          'Nama usaha:',
          'Bidang usaha:',
          'Kota / basis usaha:',
          'Produk / layanan utama:',
          'Target customer:',
          'Nilai utama / pembeda:',
          'Keunggulan utama:',
          'Catatan penting:',
          context ? '' : undefined,
          context ? `Konteks chat terakhir: ${context}` : undefined,
        ]
          .filter(Boolean)
          .join('\n')
      : [
          'Help me draft a strong but realistic business profile.',
          '',
        'Business name:',
        'Business focus:',
        'City / base:',
        'Main products or services:',
        'Target customers:',
        'Main value / difference:',
        'Main strengths:',
        'Important notes:',
        context ? '' : undefined,
          context ? `Latest chat context: ${context}` : undefined,
        ]
          .filter(Boolean)
          .join('\n');
  }

  return locale === 'id'
    ? [
        'Tolong bantu buat draft listing yang jelas dan cepat dipahami.',
        '',
        'Yang mau dijual / dicari:',
        'Tipe paling dekat (produk / jasa / lowongan / properti / sewa alat):',
        'Lokasi / area:',
        'Harga / budget yang sehat:',
        'Target buyer / partner:',
        'Pembeda / nilai utama:',
        'Detail penting:',
        context ? '' : undefined,
        context ? `Konteks chat terakhir: ${context}` : undefined,
      ]
        .filter(Boolean)
        .join('\n')
    : [
        'Help me draft a listing that is clear and quick to understand.',
        '',
        'What is being offered / requested:',
        'Closest type (product / service / job / property / tool rental):',
        'Location / coverage:',
        'Healthy price / budget:',
        'Target buyer / partner:',
        'Main value / difference:',
        'Important details:',
        context ? '' : undefined,
        context ? `Latest chat context: ${context}` : undefined,
      ]
        .filter(Boolean)
        .join('\n');
}

export function buildAiRoomDraftInstruction({
  workspace,
  locale,
  prompt,
  extraInstruction,
  lastIncoming,
  composerDraft,
}: {
  workspace: AiRoomDraftWorkspace;
  locale: 'id' | 'en';
  prompt: string;
  extraInstruction?: string;
  lastIncoming?: string | null;
  composerDraft?: string;
}): string {
  const baseRules =
    locale === 'id'
      ? [
          'Kamu membantu pengguna Lajukan menyiapkan draft yang bisa diedit dan dipublish.',
          'Balas dengan JSON valid saja. Jangan pakai markdown. Jangan ada teks di luar JSON.',
          'Utamakan konteks usaha lokal Indonesia.',
          'Jangan masukkan kontak off-platform, ajakan transfer di luar platform, atau klaim palsu.',
          'Jika ada data yang belum pasti, isi dengan asumsi yang hati-hati lalu catat di assumptions dan review_notes.',
          'Buat title, summary, dan body yang natural, ringkas, dan siap diedit.',
          'Jangan dorong perang harga. Jika perlu, utamakan nilai, kualitas, bundling, positioning, dan margin yang sehat.',
          'Jika harga belum yakin atau berisiko bikin rugi, lebih aman pakai price_cents null lalu tulis catatan review untuk cek margin dan detail deal.',
          'Kalau relevan, pakai follow_up_questions atau review_notes untuk mendorong kolaborasi, bundling, atau partner yang bisa saling menguatkan.',
        ]
      : [
          'You help Lajukan users prepare drafts that can be edited and published.',
          'Return valid JSON only. No markdown. No text outside the JSON.',
          'Prefer local Indonesian business context.',
          'Do not include off-platform contacts, unsafe payment instructions, or false claims.',
          'If something is uncertain, use cautious assumptions and record them in assumptions and review_notes.',
          'Make the title, summary, and body natural, concise, and ready to edit.',
          'Do not push price wars. When relevant, prioritize value, quality, bundles, positioning, and healthy margins.',
          'If pricing is uncertain or risky, prefer price_cents null and use review notes to flag margin and deal details for review.',
          'When relevant, use follow_up_questions or review_notes to suggest collaboration, bundles, or partners that strengthen the business.',
        ];

  const listingSchema =
    locale === 'id'
      ? [
          'Schema JSON yang wajib:',
          '{',
          '  "content_type": "product|service|job|property|tool_rental",',
          '  "listing_side": "supply|demand",',
          '  "title": "string",',
          '  "summary": "string",',
          '  "body": "string",',
          '  "price_cents": 0 atau null,',
          '  "tags": ["tag 1", "tag 2"],',
          '  "metadata": {',
          '    "location": "opsional",',
          '    "delivery_time": "opsional",',
          '    "service_scope": "opsional",',
          '    "deliverables": "opsional",',
          '    "work_mode": "opsional",',
          '    "salary_range": "opsional",',
          '    "must_have_skills": "opsional",',
          '    "responsibilities": "opsional",',
          '    "property_type": "opsional",',
          '    "area_sqm": "opsional",',
          '    "available_from": "opsional",',
          '    "pickup_location": "opsional",',
          '    "rental_rate_type": "opsional",',
          '    "deposit_amount_cents": "opsional",',
          '    "condition": "opsional",',
          '    "availability_status": "opsional",',
          '    "brand": "opsional",',
          '    "model_name": "opsional"',
          '  },',
          '  "review_notes": ["catatan review"],',
          '  "follow_up_questions": ["pertanyaan lanjutan"],',
          '  "assumptions": ["asumsi yang dipakai"]',
          '}',
          'Pilih content_type yang paling masuk akal. Jika harga belum jelas, pakai price_cents null.',
        ]
      : [
          'Required JSON schema:',
          '{',
          '  "content_type": "product|service|job|property|tool_rental",',
          '  "listing_side": "supply|demand",',
          '  "title": "string",',
          '  "summary": "string",',
          '  "body": "string",',
          '  "price_cents": 0 or null,',
          '  "tags": ["tag 1", "tag 2"],',
          '  "metadata": {',
          '    "location": "optional",',
          '    "delivery_time": "optional",',
          '    "service_scope": "optional",',
          '    "deliverables": "optional",',
          '    "work_mode": "optional",',
          '    "salary_range": "optional",',
          '    "must_have_skills": "optional",',
          '    "responsibilities": "optional",',
          '    "property_type": "optional",',
          '    "area_sqm": "optional",',
          '    "available_from": "optional",',
          '    "pickup_location": "optional",',
          '    "rental_rate_type": "optional",',
          '    "deposit_amount_cents": "optional",',
          '    "condition": "optional",',
          '    "availability_status": "optional",',
          '    "brand": "optional",',
          '    "model_name": "optional"',
          '  },',
          '  "review_notes": ["review note"],',
          '  "follow_up_questions": ["follow-up question"],',
          '  "assumptions": ["assumption used"]',
          '}',
          'Choose the most suitable content_type. If the price is unknown, use price_cents null.',
        ];

  const companySchema =
    locale === 'id'
      ? [
          'Schema JSON yang wajib:',
          '{',
          '  "content_type": "company",',
          '  "listing_side": "supply",',
          '  "title": "string",',
          '  "summary": "string",',
          '  "body": "string",',
          '  "price_cents": null,',
          '  "tags": ["tag 1", "tag 2"],',
          '  "metadata": {',
          '    "company_name": "string",',
          '    "industry_focus": "string",',
          '    "company_size": "opsional",',
          '    "headquarters": "string",',
          '    "website": "opsional",',
          '    "founded_year": "opsional",',
          '    "about_company": "string",',
          '    "company_values": "opsional",',
          '    "hiring_focus": "opsional"',
          '  },',
          '  "review_notes": ["catatan review"],',
          '  "follow_up_questions": ["pertanyaan lanjutan"],',
          '  "assumptions": ["asumsi yang dipakai"]',
          '}',
          'Tipe company tidak boleh memakai harga.',
        ]
      : [
          'Required JSON schema:',
          '{',
          '  "content_type": "company",',
          '  "listing_side": "supply",',
          '  "title": "string",',
          '  "summary": "string",',
          '  "body": "string",',
          '  "price_cents": null,',
          '  "tags": ["tag 1", "tag 2"],',
          '  "metadata": {',
          '    "company_name": "string",',
          '    "industry_focus": "string",',
          '    "company_size": "optional",',
          '    "headquarters": "string",',
          '    "website": "optional",',
          '    "founded_year": "optional",',
          '    "about_company": "string",',
          '    "company_values": "optional",',
          '    "hiring_focus": "optional"',
          '  },',
          '  "review_notes": ["review note"],',
          '  "follow_up_questions": ["follow-up question"],',
          '  "assumptions": ["assumption used"]',
          '}',
          'Company drafts must not use a listing price.',
        ];

  return [
    ...baseRules,
    '',
    ...(workspace === 'company' ? companySchema : listingSchema),
    extraInstruction
      ? locale === 'id'
        ? `Instruksi tambahan: ${extraInstruction}`
        : `Extra instruction: ${extraInstruction}`
      : '',
    composerDraft
      ? locale === 'id'
        ? `Draft teks user saat ini: ${composerDraft}`
        : `Current user text draft: ${composerDraft}`
      : '',
    lastIncoming
      ? locale === 'id'
        ? `Pesan terakhir lawan bicara: ${lastIncoming}`
        : `Latest incoming message: ${lastIncoming}`
      : '',
    locale === 'id' ? 'Brief user:' : 'User brief:',
    prompt.trim(),
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function extractAiRoomDraftFromResponse(
  responseText: string,
  workspace: AiRoomDraftWorkspace,
): AiRoomDraftResult | null {
  const parsed = extractJsonObject(responseText);
  if (!parsed) return null;
  const root = resolvePayloadRoot(parsed);
  const contentType =
    workspace === 'company'
      ? 'company'
      : canonicalContentType(root.content_type || root.type);
  const listingSide =
    workspace === 'company'
      ? 'supply'
      : cleanText(root.listing_side, 32).toLowerCase() === 'demand'
        ? 'demand'
        : 'supply';
  const title = cleanText(root.title, 180);
  const summary = cleanText(root.summary, 1200);
  const body = cleanText(root.body, 6000);
  const priceCents =
    workspace === 'company'
      ? undefined
      : parsePositiveInteger(root.price_cents);
  const pricingMode = workspace === 'company' || !priceCents
    ? 'request'
    : 'fixed';

  if (!title || !summary || !body) return null;

  return {
    workspace,
    contentType,
    listingSide,
    pricingMode,
    title,
    summary,
    body,
    priceCents,
    tags: sanitizeStringList(root.tags, 8),
    metadata: sanitizeMetadata(root.metadata),
    reviewNotes: sanitizeStringList(root.review_notes, 6),
    followUpQuestions: sanitizeStringList(root.follow_up_questions, 6),
    assumptions: sanitizeStringList(root.assumptions, 6),
  };
}

export function buildAiRoomCreatePayload(
  draft: AiRoomDraftResult,
): Record<string, unknown> {
  return {
    content_type: draft.contentType,
    title: draft.title,
    summary: draft.summary,
    body: draft.body,
    pricing_mode: draft.pricingMode,
    price_cents: draft.pricingMode === 'fixed' ? draft.priceCents : undefined,
    tags: draft.tags,
    content_status: 'draft',
    metadata: {
      ...draft.metadata,
      market_side: toMarketSideValue(draft.listingSide),
      ai_generated: true,
      ai_workspace: draft.workspace,
      ai_review_notes: draft.reviewNotes,
      ai_follow_up_questions: draft.followUpQuestions,
      ai_assumptions: draft.assumptions,
    },
  };
}

export function buildAiRoomCardPayload(input: {
  draft: AiRoomDraftResult;
  contentId: string;
  slug?: string | null;
  status?: string | null;
  publishIssues?: string[];
}) {
  const { draft, contentId, slug, status, publishIssues = [] } = input;
  const previewFields = buildCardPreviewFields(draft.metadata);
  return {
    source: 'ai_room_draft',
    ai_generated: true,
    draft_id: contentId,
    content_id: contentId,
    content_type: draft.contentType,
    content_title: draft.title,
    summary: draft.summary,
    content_url: buildContentHref(contentId, draft.title, slug || ''),
    slug: slug || '',
    price_cents: draft.pricingMode === 'fixed' ? draft.priceCents : undefined,
    currency: 'IDR',
    market_side: toMarketSideValue(draft.listingSide),
    pricing_mode: draft.pricingMode,
    content_status: status || 'draft',
    ...previewFields,
    review_notes: draft.reviewNotes,
    follow_up_questions: draft.followUpQuestions,
    assumptions: draft.assumptions,
    publish_ready: publishIssues.length === 0,
    publish_issues: publishIssues,
    metadata_preview: draft.metadata,
    tags: draft.tags,
    ai_workspace: draft.workspace,
  };
}
