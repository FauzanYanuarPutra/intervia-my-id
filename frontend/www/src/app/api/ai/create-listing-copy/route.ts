import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';

export const runtime = 'nodejs';

const USE_OLLAMA = process.env.USE_OLLAMA === 'true';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL =
  process.env.OLLAMA_CREATE_MODEL || process.env.OLLAMA_MODEL || 'llama3.2:3b';

type Locale = 'id' | 'en';
type Intent = 'offer' | 'request';

type FieldLabel = {
  key?: unknown;
  labelId?: unknown;
  labelEn?: unknown;
};

type CopyInput = {
  locale: Locale;
  intent: Intent;
  categorySlug: string;
  subcategorySlug: string;
  industryIds: string[];
  values: Record<string, unknown>;
  fields: Array<{ key: string; labelId: string; labelEn: string }>;
};

type ListingCopy = {
  provider: 'local-rules' | 'ollama+rules';
  title: string;
  summary: string;
};

const FIELD_FALLBACK_LABELS: Record<string, { id: string; en: string }> = {
  item_name: { id: 'Nama bahan atau produk', en: 'Supply or product name' },
  item_needed: { id: 'Bahan yang dibutuhkan', en: 'Supply needed' },
  service_name: { id: 'Nama jasa', en: 'Service name' },
  service_needed: { id: 'Jasa yang dibutuhkan', en: 'Service needed' },
  equipment_name: { id: 'Nama mesin atau alat', en: 'Machine or tool name' },
  equipment_needed: {
    id: 'Mesin atau alat yang dicari',
    en: 'Machine or tool needed',
  },
  place_name: { id: 'Nama tempat', en: 'Place name' },
  place_needed: { id: 'Tempat yang dicari', en: 'Place needed' },
  opportunity_name: { id: 'Nama peluang', en: 'Opportunity name' },
  opportunity_needed: { id: 'Peluang yang dicari', en: 'Opportunity needed' },
  unit: { id: 'Satuan', en: 'Unit' },
  price_amount: { id: 'Harga', en: 'Price' },
  budget_amount: { id: 'Budget', en: 'Budget' },
  minimum_order: { id: 'Minimum pembelian', en: 'Minimum order' },
  quantity: { id: 'Jumlah kebutuhan', en: 'Required quantity' },
  quantity_needed: { id: 'Jumlah kebutuhan', en: 'Quantity needed' },
  stock_status: { id: 'Ketersediaan stok', en: 'Stock availability' },
  location: { id: 'Lokasi', en: 'Location' },
  shipping_area: { id: 'Area pengiriman', en: 'Shipping area' },
  service_area: { id: 'Area layanan', en: 'Service area' },
};

const UNIT_LABELS: Record<string, string> = {
  kg: 'kg',
  g: 'g',
  ton: 'ton',
  lb: 'lb',
  oz: 'oz',
  l: 'L',
  ml: 'ml',
  m3: 'm3',
  m: 'm',
  cm: 'cm',
  m2: 'm2',
  pcs: 'pcs',
  dozen: 'dozen',
  pack: 'pack',
  box: 'box',
  carton: 'carton',
  case: 'case',
  sack: 'sack',
  bag: 'bag',
  roll: 'roll',
  sheet: 'sheet',
  bundle: 'bundle',
  pallet: 'pallet',
  container: 'container',
};

const STOCK_LABELS: Record<string, { id: string; en: string }> = {
  ready_stock: { id: 'ready stock', en: 'ready stock' },
  limited_stock: { id: 'stok terbatas', en: 'limited stock' },
  pre_order: { id: 'pre-order', en: 'pre-order' },
  made_to_order: { id: 'produksi sesuai pesanan', en: 'made to order' },
  recurring_stock: {
    id: 'stok rutin / restock berkala',
    en: 'recurring stock',
  },
  seasonal: { id: 'musiman', en: 'seasonal' },
};

const PRIMARY_KEYS = [
  'item_name',
  'item_needed',
  'service_name',
  'service_needed',
  'equipment_name',
  'equipment_needed',
  'place_name',
  'place_needed',
  'opportunity_name',
  'opportunity_needed',
];

function cleanText(value: unknown, maxLength = 220): string {
  return typeof value === 'string'
    ? value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeLocale(value: unknown): Locale {
  return value === 'en' ? 'en' : 'id';
}

function normalizeIntent(value: unknown): Intent | null {
  return value === 'offer' || value === 'request' ? value : null;
}

function trimBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function formatIdr(value: unknown): string {
  const raw =
    typeof value === 'number'
      ? value
      : Number(String(value || '').replace(/[^\d]/g, ''));
  if (!Number.isFinite(raw) || raw <= 0) return '';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(raw);
}

function cleanValues(values: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (key.length > 80 || key === '__proto__' || key === 'constructor')
      continue;
    if (typeof value === 'boolean') cleaned[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value))
      cleaned[key] = value;
    else if (Array.isArray(value)) {
      const items = value
        .map(item => cleanText(item, 80))
        .filter(Boolean)
        .slice(0, 16);
      if (items.length > 0) cleaned[key] = items;
    } else {
      const text = cleanText(value, 260);
      if (text) cleaned[key] = text;
    }
  }
  return cleaned;
}

function cleanFields(fields: unknown): CopyInput['fields'] {
  if (!Array.isArray(fields)) return [];
  return fields
    .map((field: FieldLabel) => {
      const key = cleanText(field?.key, 80);
      if (!key) return null;
      return {
        key,
        labelId: cleanText(field?.labelId, 80),
        labelEn: cleanText(field?.labelEn, 80),
      };
    })
    .filter((field): field is CopyInput['fields'][number] => Boolean(field));
}

function fieldLabel(
  fields: CopyInput['fields'],
  key: string,
  locale: Locale,
): string {
  const field = fields.find(item => item.key === key);
  if (field)
    return locale === 'id'
      ? field.labelId || field.labelEn
      : field.labelEn || field.labelId;
  const fallback = FIELD_FALLBACK_LABELS[key];
  if (fallback) return locale === 'id' ? fallback.id : fallback.en;
  return key.replace(/_/g, ' ');
}

function displayValue(key: string, value: unknown, locale: Locale): string {
  if (typeof value === 'boolean')
    return value ? (locale === 'id' ? 'ya' : 'yes') : '';
  if (Array.isArray(value)) {
    return value
      .map(item => cleanText(item, 80).replace(/_/g, ' '))
      .filter(Boolean)
      .join(', ');
  }
  if (
    key === 'price_amount' ||
    key === 'budget_amount' ||
    key === 'capital_budget'
  ) {
    return formatIdr(value);
  }
  const cleaned = cleanText(value, 220);
  if (!cleaned) return '';
  if (key === 'unit') return UNIT_LABELS[cleaned] || cleaned;
  if (key === 'stock_status') {
    const stock = STOCK_LABELS[cleaned];
    if (stock) return locale === 'id' ? stock.id : stock.en;
  }
  return cleaned;
}

function primaryName(values: Record<string, unknown>): string {
  for (const key of PRIMARY_KEYS) {
    const value = cleanText(values[key], 100);
    if (value) return value;
  }
  return cleanText(values.title, 100);
}

function collectFacts(input: CopyInput) {
  return Object.entries(input.values)
    .filter(([key]) => key !== 'title' && key !== 'summary')
    .map(([key, value]) => ({
      key,
      label: fieldLabel(input.fields, key, input.locale),
      value: displayValue(key, value, input.locale),
    }))
    .filter(item => item.value)
    .slice(0, 16);
}

function sentenceJoin(items: string[], locale: Locale): string {
  const clean = items.map(item => item.trim()).filter(Boolean);
  if (clean.length <= 1) return clean[0] || '';
  const last = clean[clean.length - 1];
  return `${clean.slice(0, -1).join(', ')}${locale === 'id' ? ', dan ' : ', and '}${last}`;
}

function buildLocalCopy(input: CopyInput): ListingCopy {
  const name = primaryName(input.values);
  const location =
    displayValue('location', input.values.location, input.locale) ||
    displayValue('service_area', input.values.service_area, input.locale) ||
    displayValue('address', input.values.address, input.locale);
  const unit = displayValue('unit', input.values.unit, input.locale);
  const quantity =
    displayValue(
      'quantity_needed',
      input.values.quantity_needed,
      input.locale,
    ) ||
    displayValue('quantity', input.values.quantity, input.locale) ||
    displayValue('minimum_order', input.values.minimum_order, input.locale);
  const quantityWithUnit = quantity
    ? `${quantity}${unit ? ` ${unit}` : ''}`
    : '';
  const price =
    displayValue('price_amount', input.values.price_amount, input.locale) ||
    displayValue('budget_amount', input.values.budget_amount, input.locale) ||
    displayValue('capital_budget', input.values.capital_budget, input.locale);
  const facts = collectFacts(input)
    .filter(item => !PRIMARY_KEYS.includes(item.key))
    .filter(item => item.key !== 'price_amount' && item.key !== 'budget_amount')
    .slice(0, 5);
  const factText = sentenceJoin(
    facts.map(item => `${item.label}: ${item.value}`),
    input.locale,
  );

  const titleBase =
    input.intent === 'request'
      ? input.locale === 'id'
        ? `Butuh ${name}${quantityWithUnit ? ` ${quantityWithUnit}` : ''}`
        : `Need ${name}${quantityWithUnit ? ` ${quantityWithUnit}` : ''}`
      : `${name}${unit ? ` per ${unit}` : ''}`;
  const title = `${titleBase}${location ? ` - ${location}` : ''}`.slice(0, 120);

  const summaryStart =
    input.intent === 'request'
      ? input.locale === 'id'
        ? `${name} sedang dibutuhkan${quantity ? ` dengan jumlah ${quantity}` : ''}${price ? ` dan budget ${price}` : ''}.`
        : `${name} is needed${quantity ? ` with quantity ${quantity}` : ''}${price ? ` and budget ${price}` : ''}.`
      : input.locale === 'id'
        ? `${name} tersedia${unit ? ` dengan satuan ${unit}` : ''}${price ? `, harga ${price}` : ''}.`
        : `${name} is available${unit ? ` by ${unit}` : ''}${price ? `, price ${price}` : ''}.`;
  const locationText = location
    ? input.locale === 'id'
      ? ` Berlaku untuk area ${location}.`
      : ` Applies to ${location}.`
    : '';
  const details = factText ? ` ${factText}.` : '';

  return {
    provider: 'local-rules',
    title: title.trim(),
    summary: `${summaryStart}${locationText}${details}`.trim().slice(0, 280),
  };
}

function parseJsonObject(text: string): Record<string, unknown> | null {
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

async function buildOllamaCopy(
  input: CopyInput,
  fallback: ListingCopy,
): Promise<ListingCopy> {
  if (!USE_OLLAMA) return fallback;
  const facts = collectFacts(input);
  const prompt = `
You write concise marketplace listing copy for Lajukan.
Rules:
- Use only the provided facts.
- Do not invent supplier names, prices, stock, location, certification, delivery, verification, or guarantees.
- Return valid JSON only: {"title":"...","summary":"..."}.
- title max 90 characters, summary max 260 characters.
- Language: ${input.locale === 'id' ? 'Indonesian' : 'English'}.

Context:
${JSON.stringify(
  {
    intent: input.intent,
    categorySlug: input.categorySlug,
    subcategorySlug: input.subcategorySlug,
    industryIds: input.industryIds,
    facts,
  },
  null,
  2,
)}
`;

  try {
    const response = await fetch(`${trimBaseUrl(OLLAMA_URL)}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.2 },
      }),
    });
    if (!response.ok) return fallback;
    const payload = asRecord(await response.json().catch(() => ({})));
    const parsed = parseJsonObject(cleanText(payload.response, 1200));
    const title = cleanText(parsed?.title, 120);
    const summary = cleanText(parsed?.summary, 280);
    if (!title || !summary) return fallback;
    return { provider: 'ollama+rules', title, summary };
  } catch {
    return fallback;
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const rateLimit = await enforceRateLimit({
    key: `ai:create-listing-copy:${auth.ctx.userId}:${getClientIp(req)}`,
    limit: 20,
    windowSeconds: 60 * 60,
    message: 'Terlalu banyak permintaan AI. Coba lagi nanti.',
  });
  if (!rateLimit.ok) return rateLimit.response;

  const body = asRecord(await req.json().catch(() => ({})));
  const intent = normalizeIntent(body.intent);
  const values = cleanValues(asRecord(body.values));
  const input: CopyInput = {
    locale: normalizeLocale(body.locale),
    intent: intent || 'offer',
    categorySlug: cleanText(body.categorySlug, 80),
    subcategorySlug: cleanText(body.subcategorySlug, 80),
    industryIds: Array.isArray(body.industryIds)
      ? body.industryIds
          .map(item => cleanText(item, 80))
          .filter(Boolean)
          .slice(0, 12)
      : [],
    values,
    fields: cleanFields(body.fields),
  };

  if (
    !intent ||
    !input.categorySlug ||
    !input.subcategorySlug ||
    input.industryIds.length === 0
  ) {
    return NextResponse.json(
      { error: 'Konteks listing belum lengkap.' },
      { status: 400 },
    );
  }

  const name = primaryName(values);
  const facts = collectFacts(input).filter(
    item => item.key !== 'title' && item.key !== 'summary',
  );
  if (!name || facts.length < 2) {
    return NextResponse.json(
      { error: 'Isi nama barang/jasa dan minimal satu detail utama dulu.' },
      { status: 400 },
    );
  }

  const local = buildLocalCopy(input);
  const copy = await buildOllamaCopy(input, local);

  return NextResponse.json(copy);
}
