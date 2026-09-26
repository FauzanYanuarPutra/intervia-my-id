import type { ContentItem } from './catalog';
import { resolveListingSide } from './listingSide';

type LocaleCode = 'id' | 'en';

const UNIT_LABELS: Record<string, { id: string; en: string }> = {
  pcs: { id: 'pcs', en: 'pc' },
  unit: { id: 'unit', en: 'unit' },
  pack: { id: 'paket', en: 'pack' },
  bal: { id: 'bal', en: 'bale' },
  box: { id: 'box', en: 'box' },
  carton: { id: 'karton', en: 'carton' },
  ton: { id: 'ton', en: 'ton' },
  ml: { id: 'ml', en: 'ml' },
  dozen: { id: 'lusin', en: 'dozen' },
  set: { id: 'set', en: 'set' },
  kg: { id: 'kg', en: 'kg' },
  gram: { id: 'gram', en: 'gram' },
  liter: { id: 'liter', en: 'liter' },
  meter: { id: 'meter', en: 'meter' },
  sqm: { id: 'm2', en: 'sqm' },
  m3: { id: 'm3', en: 'm3' },
  sak: { id: 'sak', en: 'sack' },
  karung: { id: 'karung', en: 'sack' },
  roll: { id: 'roll', en: 'roll' },
  lembar: { id: 'lembar', en: 'sheet' },
  batang: { id: 'batang', en: 'bar' },
  ikat: { id: 'ikat', en: 'bundle' },
  kodi: { id: 'kodi', en: 'kodi' },
  rim: { id: 'rim', en: 'ream' },
  pallet: { id: 'pallet', en: 'pallet' },
  kontainer: { id: 'kontainer', en: 'container' },
  pasang: { id: 'pasang', en: 'pair' },
  hour: { id: 'jam', en: 'hour' },
  day: { id: 'hari', en: 'day' },
  week: { id: 'minggu', en: 'week' },
  month: { id: 'bulan', en: 'month' },
  year: { id: 'tahun', en: 'year' },
  session: { id: 'sesi', en: 'session' },
  project: { id: 'proyek', en: 'project' },
  shipment: { id: 'pengiriman', en: 'shipment' },
  event: { id: 'event', en: 'event' },
  order: { id: 'order', en: 'order' },
  orang: { id: 'orang', en: 'person' },
  deal: { id: 'deal', en: 'deal' },
  nego: { id: 'nego', en: 'negotiable' },
  custom: { id: 'custom', en: 'custom' },
};

function text(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function normalizePriceUnit(value: unknown): string {
  const raw = text(value).toLowerCase();
  if (!raw) return '';
  const normalized = raw
    .replace(/^per\s+/i, '')
    .replace(/\//g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return '';
  if (/\b(pcs?|pieces?|buah|item)\b/.test(normalized)) return 'pcs';
  if (/\b(unit)\b/.test(normalized)) return 'unit';
  if (/\b(paket|pack|package|bundles?)\b/.test(normalized)) return 'pack';
  if (/\b(bal|bale)\b/.test(normalized)) return 'bal';
  if (/\b(box|dus)\b/.test(normalized)) return 'box';
  if (/\b(karton|carton|kartus)\b/.test(normalized)) return 'carton';
  if (/\b(ton|tonne|tonel)\b/.test(normalized)) return 'ton';
  if (/\b(ml|milliliter|millilitre)\b/.test(normalized)) return 'ml';
  if (/\b(lusin|dozen|dz)\b/.test(normalized)) return 'dozen';
  if (/\b(set)\b/.test(normalized)) return 'set';
  if (/\b(kg|kilogram)\b/.test(normalized)) return 'kg';
  if (/\b(gr|gram)\b/.test(normalized)) return 'gram';
  if (/\b(liter|litre|ltr)\b/.test(normalized)) return 'liter';
  if (/\b(meter|metre)\b/.test(normalized)) return 'meter';
  if (/\b(m2|sqm|luas|square meter)\b/.test(normalized)) return 'sqm';
  if (/\b(m3|cubic meter|meter kubik)\b/.test(normalized)) return 'm3';
  if (/\b(sak|sack)\b/.test(normalized)) return 'sak';
  if (/\b(karung|bag)\b/.test(normalized)) return 'karung';
  if (/\b(roll)\b/.test(normalized)) return 'roll';
  if (/\b(lembar|sheet)\b/.test(normalized)) return 'lembar';
  if (/\b(batang|stick|bar)\b/.test(normalized)) return 'batang';
  if (/\b(ikat|bundle)\b/.test(normalized)) return 'ikat';
  if (/\b(kodi)\b/.test(normalized)) return 'kodi';
  if (/\b(rim|ream)\b/.test(normalized)) return 'rim';
  if (/\b(pallet)\b/.test(normalized)) return 'pallet';
  if (/\b(kontainer|container)\b/.test(normalized)) return 'kontainer';
  if (/\b(pasang|pair)\b/.test(normalized)) return 'pasang';
  if (/\b(jam|hour|hourly)\b/.test(normalized)) return 'hour';
  if (/\b(hari|day|daily|harian)\b/.test(normalized)) return 'day';
  if (/\b(minggu|week|weekly|mingguan)\b/.test(normalized)) return 'week';
  if (/\b(bulan|month|monthly|bulanan)\b/.test(normalized)) return 'month';
  if (/\b(tahun|year|annual|annually|tahunan)\b/.test(normalized))
    return 'year';
  if (/\b(sesi|session|meeting|live)\b/.test(normalized)) return 'session';
  if (/\b(proyek|project|brief|job|pekerjaan)\b/.test(normalized))
    return 'project';
  if (/\b(pengiriman|shipment|delivery|kirim)\b/.test(normalized))
    return 'shipment';
  if (/\b(event|acara)\b/.test(normalized)) return 'event';
  if (/\b(deal|handover|oper usaha|transfer)\b/.test(normalized)) return 'deal';
  if (/\b(order|pesanan)\b/.test(normalized)) return 'order';
  if (/\b(orang|person|pax)\b/.test(normalized)) return 'orang';
  if (/\b(nego|negotiable|negoisasi)\b/.test(normalized)) return 'nego';
  if (/\b(custom|lainnya|other)\b/.test(normalized)) return 'custom';

  return normalized
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

export function priceUnitLabel(unit: unknown, locale: LocaleCode): string {
  const normalized = normalizePriceUnit(unit);
  if (!normalized) return '';
  const mapped = UNIT_LABELS[normalized];
  if (mapped) return mapped[locale];
  return normalized.replace(/_/g, ' ');
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function resolveNestedUnit(source: Record<string, unknown>): string {
  const nestedCandidates = [
    source.unit,
    source.unit_label,
    source.price_unit,
    source.price_basis,
    source.quantity_unit,
    source.required_unit,
    source.need_unit,
    source.rate_unit,
  ];

  return nestedCandidates.map(normalizePriceUnit).find(Boolean) || '';
}

function isDemandContent(item: ContentItem, metadata: Record<string, unknown>): boolean {
  return (
    resolveListingSide({
      type: item.content_type || item.category,
      metadata,
      title: item.title,
      summary: item.summary,
    }) === 'demand'
  );
}

export function resolveContentPriceUnit(item: ContentItem): string {
  const metadata = metadataRecord(item.metadata);
  const nestedAttributes = [
    metadataRecord(metadata.attributes),
    metadataRecord(metadata.values),
    metadataRecord(metadata.form_values),
    metadataRecord(metadata.listing_values),
  ];

  const nestedUnit =
    nestedAttributes.map(resolveNestedUnit).find(Boolean) || '';

  const demandUnit =
    [
      metadata.quantity_unit,
      metadata.required_unit,
      metadata.need_unit,
      metadata.unit,
      metadata.unit_label,
      metadata.price_unit,
      metadata.rate_unit,
      ...nestedAttributes.flatMap(source => [
        source.quantity_unit,
        source.required_unit,
        source.need_unit,
        source.unit,
        source.unit_label,
        source.price_unit,
        source.rate_unit,
      ]),
      nestedUnit,
    ]
      .map(normalizePriceUnit)
      .find(Boolean) || '';

  const supplyUnit =
    [
      item.price_unit,
      metadata.price_unit,
      metadata.unit,
      metadata.unit_label,
      metadata.price_basis,
      metadata.rate_type,
      metadata.rental_rate_type,
      metadata.rental_period,
      metadata.lease_term,
      metadata.compensation_period,
      metadata.salary_period,
      metadata.minimum_order,
      ...nestedAttributes.flatMap(source => [
        source.price_unit,
        source.unit,
        source.unit_label,
        source.price_basis,
        source.rate_type,
        source.rate_unit,
      ]),
      nestedUnit,
    ]
      .map(normalizePriceUnit)
      .find(Boolean) || '';

  const direct = isDemandContent(item, metadata)
    ? demandUnit || supplyUnit
    : supplyUnit || demandUnit;

  if (direct) return direct;

  const type = text(item.content_type || item.category).toLowerCase();
  if (type === 'property') return 'month';
  if (type === 'tool_rental') return 'day';
  if (type === 'job') return 'month';
  if (type === 'freelancer') return 'project';
  if (type === 'service') return 'project';
  if (type === 'business_transfer') return 'deal';
  if (type === 'product') return 'pcs';
  return '';
}

export function resolveContentPriceUnitLabel(
  item: ContentItem,
  locale: LocaleCode,
): string {
  return priceUnitLabel(resolveContentPriceUnit(item), locale);
}

export function formatPriceWithUnit(
  priceLabel: string,
  unitLabel: string,
): string {
  if (!unitLabel) return priceLabel;
  const trimmed = priceLabel.trim();
  if (
    !trimmed ||
    trimmed === '-' ||
    /nego|request|menyesuaikan|hubungi|contact/i.test(trimmed) ||
    /budget\s+(fleksibel|maksimal|tetap|range|rentang)|^(flexible|fixed|maximum)\s+budget$/i.test(trimmed) ||
    /(^|[\s(])per\s+\S+|\/\s*\S+/i.test(trimmed) ||
    /^(nego|custom)$/i.test(unitLabel.trim())
  ) {
    return trimmed;
  }
  return `${trimmed}/${unitLabel}`;
}
