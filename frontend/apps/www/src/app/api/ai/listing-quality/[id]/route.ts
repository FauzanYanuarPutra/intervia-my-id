import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';

export const runtime = 'nodejs';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';

const USE_OLLAMA = process.env.USE_OLLAMA === 'true';
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/+$/, '');
const OLLAMA_MODEL =
  process.env.OLLAMA_LISTING_QUALITY_MODEL ||
  process.env.OLLAMA_MODEL ||
  'llama3.2:3b';

type QuickFix = {
  id: string;
  label: string;
  description: string;
  confidence: number;
  patch: Record<string, unknown>;
  safeAutoApply: boolean;
};

type QualityResult = {
  status: 'ok' | 'review';
  provider: 'rules' | 'ollama+rules';
  confidence: number;
  likelyThing: string;
  likelyType: 'product' | 'service' | 'job' | 'property' | 'tool_rental' | 'company' | 'other';
  current: {
    type: string;
    typeLabel: string;
    price?: string;
    priceUnit?: string;
  };
  issues: Array<{
    code: string;
    severity: 'high' | 'medium' | 'low';
    title: string;
    detail: string;
  }>;
  quickFixes: QuickFix[];
  priceUnitChoices?: Array<{
    unit: string;
    label: string;
    confidence: number;
    description: string;
  }>;
  explanation: string;
};

function cleanText(value: unknown, max = 800): string {
  return typeof value === 'string'
    ? value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
    : '';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeType(value: unknown): string {
  const raw = cleanText(value, 100).toLowerCase().replace(/[^a-z0-9_]+/g, '');
  if (
    ['product', 'products', 'produk', 'menawarkanproduk', 'menjualproduk', 'barang', 'jualan'].includes(raw)
  ) return 'product';
  if (
    ['service', 'services', 'jasa', 'menawarkanjasa', 'menyediakanjasa', 'layanan'].includes(raw)
  ) return 'service';
  if (
    ['job', 'jobs', 'lowongan', 'loker', 'menawarkanpekerjaan'].includes(raw)
  ) return 'job';
  if (['property', 'properties', 'properti', 'realestate', 'rumah', 'tanah'].includes(raw)) return 'property';
  if (raw.includes('rental') || raw.includes('sewa')) return 'tool_rental';
  if (raw.includes('company') || raw.includes('business') || raw.includes('perusahaan')) return 'company';
  return raw || 'other';
}

function normalizePriceUnit(value: unknown): string {
  const raw = cleanText(value, 80).toLowerCase().replace(/\s+/g, ' ');
  if (!raw) return '';
  if (['per proyek', 'proyek', 'project', 'per project'].includes(raw)) return 'project';
  if (['per sesi', 'sesi', 'session'].includes(raw)) return 'session';
  if (['per jam', 'jam', 'hour', 'per hour'].includes(raw)) return 'hour';
  if (['per hari', 'hari', 'day', 'per day'].includes(raw)) return 'day';
  if (['per bulan', 'bulan', 'month', 'per month'].includes(raw)) return 'month';
  if (['per tahun', 'tahun', 'year', 'per year'].includes(raw)) return 'year';
  if (['per kg', 'kg', 'kilogram', 'kilo'].includes(raw)) return 'kg';
  if (['per pcs', 'pcs', 'piece', 'item'].includes(raw)) return 'pcs';
  if (['per buah', 'buah'].includes(raw)) return 'pcs';
  if (['liter', 'per liter', 'l'].includes(raw)) return 'liter';
  return raw.replace(/^per\s+/, '');
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    product: 'Produk',
    service: 'Jasa',
    job: 'Lowongan',
    property: 'Properti',
    tool_rental: 'Sewa alat',
    company: 'Perusahaan',
    other: 'Lainnya',
  };
  return labels[type] || type;
}

function scoreKeyword(text: string, words: string[]): number {
  return words.reduce((score, word) => (text.includes(word) ? score + 1 : score), 0);
}

function inferLocalQuality(item: Record<string, unknown>): Omit<QualityResult, 'provider'> {
  const metadata = asRecord(item.metadata);
  const formValues = asRecord(metadata.form_values);
  const title = cleanText(item.title, 180);
  const summary = cleanText(item.summary, 600);
  const body = cleanText(item.body || item.description, 1200);
  const combined = `${title} ${summary} ${body} ${JSON.stringify(formValues)}`.toLowerCase();

  const currentType = normalizeType(item.content_type || item.type);
  const priceUnit = normalizePriceUnit(item.price_unit || formValues.price_unit);
  const price = Number(item.price_cents);

  const productScore = scoreKeyword(combined, [
    'buah','sawo','mangga','jeruk','naga','pisang','apel','alpukat','durian',
    'sayur','daging','ikan','ayam','beras','gula','kopi','teh','produk','barang',
    'stok','kg','gram','ton','pcs','per kg','per pcs','jual',
  ]);
  const serviceScore = scoreKeyword(combined, [
    'jasa','service','desain','designer','foto','fotografi','video','akuntansi',
    'pajak','marketing','admin','konsultan','konsultasi','per proyek','per sesi',
    'per jam','freelance','layanan',
  ]);
  const jobScore = scoreKeyword(combined, [
    'lowongan','loker','rekrut','recruiter','posisi','gaji','salary','lamaran',
    'pengalaman kerja','full time','part time',
  ]);

  let likelyType: QualityResult['likelyType'] = 'other';
  if (productScore >= Math.max(serviceScore, jobScore) && productScore >= 1) {
    likelyType = 'product';
  } else if (serviceScore >= Math.max(productScore, jobScore) && serviceScore >= 1) {
    likelyType = 'service';
  } else if (jobScore > 0) {
    likelyType = 'job';
  } else {
    likelyType = currentType as QualityResult['likelyType'];
  }

  const likelyThing =
    likelyType === 'product'
      ? title || 'Produk/barang'
      : likelyType === 'service'
        ? title || 'Jasa'
        : title || typeLabel(likelyType);

  const issues: QualityResult['issues'] = [];
  const quickFixes: QuickFix[] = [];

  if (likelyType !== currentType && likelyType !== 'other') {
    const currentLabel = typeLabel(currentType);
    const likelyLabel = typeLabel(likelyType);
    issues.push({
      code: 'type_mismatch',
      severity: 'high',
      title: `Isi terlihat lebih cocok sebagai ${likelyLabel}`,
      detail: `Saat ini listing tercatat sebagai ${currentLabel}, tetapi teks utama berulang kali menyebut karakteristik ${likelyLabel.toLowerCase()}.`,
    });
    const fixConfidence = Math.min(
      0.99,
      0.68 +
        Math.min(productScore + serviceScore + jobScore, 7) * 0.04 +
        (likelyType === 'product' && productScore >= 2 ? 0.08 : 0),
    );
    quickFixes.push({
      id: 'change-type',
      label: `Ubah ke ${likelyLabel}`,
      description: `Perbaiki jenis listing tanpa membuka form.`,
      confidence: fixConfidence,
      patch: { content_type: likelyType },
      safeAutoApply: fixConfidence >= 0.72,
    });
  }

  const productLike =
    likelyType === 'product' ||
    (currentType === 'service' && productScore >= 2);

  const serviceBadUnit =
    likelyType === 'service' && ['kg','gram','ton','liter','ml','pcs','buah'].includes(priceUnit);
  const productBadUnit =
    productLike && ['project','session','hour','day','week','month','year'].includes(priceUnit);

  if (serviceBadUnit || productBadUnit) {
    const expected =
      productLike
        ? 'per kg atau per pcs'
        : 'per proyek, sesi, jam, atau unit jasa yang memang digunakan';
    issues.push({
      code: 'price_unit_mismatch',
      severity: 'high',
      title: 'Satuan harga terlihat tidak cocok',
      detail: `Harga ${Number.isFinite(price) && price > 0 ? 'yang tercantum' : ''} memakai satuan "${priceUnit || 'belum jelas'}", sementara isi listing lebih cocok memakai ${expected}.`,
    });
  }

  const priceUnitChoices = productLike
    ? [
        {
          unit: 'kg',
          label: 'Per kg',
          confidence: combined.includes('kg') || combined.includes('kilo') ? 0.91 : 0.67,
          description: 'Pilih ini bila harga Rp yang dicantumkan adalah harga berdasarkan berat.',
        },
        {
          unit: 'pcs',
          label: 'Per pcs',
          confidence: combined.includes('pcs') || combined.includes('buah') ? 0.89 : 0.60,
          description: 'Pilih ini bila satu harga berlaku untuk satu buah/item.',
        },
      ]
    : undefined;

  const evidenceScore = productScore + serviceScore + jobScore;
  const confidence = likelyType === 'other'
    ? 0.54
    : Math.min(
        0.98,
        0.55 +
          Math.min(evidenceScore, 9) * 0.055 +
          (likelyType !== currentType ? 0.08 : 0) +
          (likelyType === 'product' && productScore >= 2 ? 0.08 : 0),
      );

  return {
    status: issues.length ? 'review' : 'ok',
    confidence,
    likelyThing,
    likelyType,
    current: {
      type: currentType,
      typeLabel: typeLabel(currentType),
      ...(Number.isFinite(price) && price > 0 ? { price: `Rp ${Math.round(price / 100).toLocaleString('id-ID')}` } : {}),
      ...(priceUnit ? { priceUnit } : {}),
    },
    issues,
    quickFixes,
    priceUnitChoices,
    explanation: issues.length
      ? 'Ada data yang tampak tidak konsisten dengan isi listing. Lajukan tidak menganggap ini pasti salah; kamu tetap memegang keputusan sebelum perubahan diterapkan.'
      : 'Isi listing dan tipe/satuan utama terlihat cukup konsisten.',
  };
}

function parseAiJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return asRecord(parsed);
  } catch {
    return null;
  }
}

async function enrichWithOllama(base: Omit<QualityResult, 'provider'>, item: Record<string, unknown>) {
  if (!USE_OLLAMA) return base;
  const prompt = `Analyze a Lajukan listing for input mistakes.
Use ONLY the provided facts. Never invent price, stock, certification, delivery, or legal facts.
Return JSON only:
{"likelyThing":"...","likelyType":"product|service|job|property|tool_rental|company|other","confidence":0-1,"explanation":"..."}
Listing:
${JSON.stringify({
  title: cleanText(item.title, 180),
  summary: cleanText(item.summary, 500),
  body: cleanText(item.body || item.description, 1000),
  content_type: cleanText(item.content_type || item.type, 80),
  price_unit: cleanText(item.price_unit, 80),
  category: cleanText(item.category, 120),
}, null, 2)}`;
  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return base;
    const payload = asRecord(await response.json().catch(() => ({})));
    const parsed = parseAiJson(cleanText(payload.response, 1600));
    if (!parsed) return base;
    const aiType = normalizeType(parsed.likelyType);
    const allowedTypes = new Set(['product','service','job','property','tool_rental','company','other']);
    if (!allowedTypes.has(aiType)) return base;
    const aiConfidence = Math.max(0, Math.min(1, Number(parsed.confidence)));
    return {
      ...base,
      likelyThing: cleanText(parsed.likelyThing, 180) || base.likelyThing,
      likelyType: aiType as QualityResult['likelyType'],
      confidence: Math.max(base.confidence, aiConfidence || 0),
      explanation: cleanText(parsed.explanation, 600) || base.explanation,
    };
  } catch {
    return base;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const limit = await enforceRateLimit({
    key: `ai:listing-quality:${auth.ctx.userId}:${getClientIp(req)}`,
    limit: 12,
    windowSeconds: 60 * 60,
    message: 'Terlalu banyak analisis listing. Coba lagi nanti.',
  });
  if (!limit.ok) return limit.response;

  const { id } = await params;
  const contentId = encodeURIComponent(id.trim());
  const response = await fetch(`${MARKETPLACE_URL}/v1/content/${contentId}`, {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${auth.ctx.token}`,
    },
    cache: 'no-store',
  });
  const item = asRecord(await response.json().catch(() => ({})));
  if (!response.ok) {
    return NextResponse.json(item, { status: response.status });
  }

  const ownerId = cleanText(item.owner_id, 80);
  if (!ownerId || ownerId !== auth.ctx.userId) {
    return NextResponse.json({ error: 'Listing owner only' }, { status: 403 });
  }

  const metadata = asRecord(item.metadata);
  if (metadata.source_only === true || metadata.is_transactional === false) {
    return NextResponse.json(
      { error: 'Reference-only listing does not support owner quality analysis.' },
      { status: 409 },
    );
  }

  const base = inferLocalQuality(item);
  const result = await enrichWithOllama(base, item);
  return NextResponse.json({
    ...result,
    generated_at: new Date().toISOString(),
  });
}
