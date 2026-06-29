import type { SectorField } from '@/data/sectorFields';
import { normalizeContentMediaUrl } from '@/lib/content/catalog';
import type { ListingSide } from '@/lib/content/listingSide';

export interface ImageFile {
  id?: string;
  file?: File;
  preview: string;
  uploading?: boolean;
  url?: string;
  error?: string;
  persisted?: boolean;
}

export interface DocumentFile {
  id?: string;
  name: string;
  file?: File;
  url?: string;
  size?: number;
  mime?: string;
  uploading?: boolean;
  error?: string;
}

export interface ContentItem {
  id: string;
  owner_id?: string;
  type?: string;
  content_type?: string;
  slug?: string;
  title?: string;
  summary?: string | null;
  body?: string | null;
  price_cents?: number | null;
  price_unit?: string | null;
  tags?: string[] | null;
  cover_image?: string | null;
  metadata?: Record<string, unknown> | null;
  content_status?: string;
  status?: string;
}

export type ListingTypeId =
  | 'product'
  | 'service'
  | 'job'
  | 'property'
  | 'auction'
  | 'tender'
  | 'tool_rental'
  | 'business_transfer'
  | 'company';

export type CreateFlowIntent = 'demand' | 'supply';

export const TOTAL_STEPS = 1;
export const DOC_ACCEPT =
  '.pdf,.txt,.csv,.rtf,.doc,.docx,.odt,.xls,.xlsx,.ods,.ppt,.pptx,.odp,.zip,.rar,.7z';
export const DOC_MAX_FILES = 8;
export const DOC_MAX_BYTES = 80 * 1024 * 1024;
export const DEFAULT_STEP_LABELS_ID = ['Info dasar', 'Detail', 'Foto', 'Promo'];
export const DEFAULT_STEP_LABELS_EN = [
  'Basic info',
  'Details',
  'Photos',
  'Promo',
];

const DOC_ALLOWED_MIME = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/rtf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/x-zip-compressed',
]);

const DOC_ALLOWED_EXT = new Set([
  '.pdf',
  '.txt',
  '.csv',
  '.rtf',
  '.doc',
  '.docx',
  '.odt',
  '.xls',
  '.xlsx',
  '.ods',
  '.ppt',
  '.pptx',
  '.odp',
  '.zip',
  '.rar',
  '.7z',
]);

export function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export function makeUploadDraftId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
}

export function revokePreviewUrl(url?: string) {
  if (typeof url === 'string' && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

export function extractContentId(value: string): string {
  const clean = value.trim();
  if (!clean) return '';
  const match = clean.match(
    /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i,
  );
  return match ? match[1] : '';
}

export function compactSubmissionValue(value: unknown): unknown {
  if (value == null) return undefined;
  if (Array.isArray(value)) {
    return value
      .map(entry => compactSubmissionValue(entry))
      .filter(entry => entry !== undefined);
  }
  if (typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(
      value as Record<string, unknown>,
    )) {
      const normalized = compactSubmissionValue(entry);
      if (normalized !== undefined) {
        next[key] = normalized;
      }
    }
    return next;
  }
  return value;
}

export function formatListingIssueForUi(issue: string, locale: string): string {
  const isId = locale === 'id';
  const normalized = issue.trim();
  if (!normalized) {
    return isId
      ? 'Masih ada data yang belum pas.'
      : 'Some listing data is invalid.';
  }
  if (normalized === 'title is required') {
    return isId ? 'Judulnya belum diisi.' : 'Title is required.';
  }
  if (normalized === 'invalid price_cents') {
    return isId ? 'Angka harganya belum pas.' : 'Price is invalid.';
  }
  if (normalized === 'invalid original_price_cents') {
    return isId
      ? 'Harga asli buat promonya belum pas.'
      : 'Original promotion price is invalid.';
  }
  if (normalized === 'fixed pricing_mode requires price_cents') {
    return isId
      ? 'Kalau pakai harga fix, nominalnya wajib diisi.'
      : 'Fixed pricing mode requires a price.';
  }
  if (normalized === 'promo_end_at must be after promo_start_at') {
    return isId
      ? 'Tanggal akhir promo harus lewat dari tanggal mulai.'
      : 'Promotion end date must be after the start date.';
  }
  if (
    normalized ===
    'company listing cannot set price_cents or original_price_cents'
  ) {
    return isId
      ? 'Profil usaha nggak pakai harga listing.'
      : 'Company listings cannot set listing prices.';
  }
  if (normalized === 'company listing cannot use fixed pricing_mode') {
    return isId
      ? 'Profil usaha nggak pakai mode harga tetap.'
      : 'Company listings cannot use fixed pricing.';
  }
  if (
    normalized ===
    'business_transfer listing requires fixed price_cents as asking price'
  ) {
    return isId
      ? 'Isi harga oper usaha dulu. Boleh tulis nego di detail.'
      : 'Add the business transfer asking price first. You can mention negotiation in the details.';
  }
  if (
    normalized === 'business_transfer listing cannot use request pricing_mode'
  ) {
    return isId
      ? 'Oper usaha perlu harga acuan, bukan mode minta harga.'
      : 'Business transfers need a reference asking price, not request pricing.';
  }
  if (
    normalized.startsWith('metadata.') &&
    normalized.endsWith(' is required for business_transfer listing')
  ) {
    return isId
      ? 'Detail oper usaha masih ada yang wajib diisi biar aman dicek.'
      : 'Some required business transfer details are still missing.';
  }
  if (normalized === 'active simple listing requires at least one image') {
    return isId
      ? 'Masukin minimal 1 foto dulu sebelum tayang.'
      : 'Add at least 1 image before publishing.';
  }
  if (
    normalized.startsWith('simple listing mode is not allowed for ') &&
    normalized.endsWith('; use detail mode')
  ) {
    return isId
      ? 'Tipe ini harus pakai mode lengkap.'
      : 'This type must use detail mode.';
  }
  if (normalized.startsWith('invalid listing type: ')) {
    return isId
      ? 'Tipe listingnya belum kebaca.'
      : 'Listing type is not recognized.';
  }
  if (normalized === 'metadata must be an object') {
    return isId
      ? 'Data tambahan listingnya belum pas.'
      : 'Listing metadata is invalid.';
  }
  return normalized;
}

export function formatListingIssuesForUi(
  issues: string[],
  locale: string,
): string {
  return issues
    .map(issue => formatListingIssueForUi(issue, locale))
    .filter(Boolean)
    .join('\n');
}

export function clampStep(step: number): number {
  if (!Number.isFinite(step)) return 1;
  return Math.min(TOTAL_STEPS, Math.max(1, Math.floor(step)));
}

export function normalizeListingSideParam(
  value: string | null | undefined,
): ListingSide | null {
  const normalized = cleanText(value).toLowerCase();
  if (normalized === 'demand' || normalized === 'supply') return normalized;
  return null;
}

const CREATE_FLOW_SEGMENTS: Record<
  CreateFlowIntent,
  { id: string; en: string; aliases: string[] }
> = {
  demand: {
    id: 'butuh',
    en: 'need',
    aliases: ['butuh', 'need', 'demand', 'brief'],
  },
  supply: {
    id: 'jual',
    en: 'sell',
    aliases: ['jual', 'sell', 'supply', 'listing'],
  },
};

const CREATE_TYPE_SEGMENTS: Record<
  ListingTypeId,
  { id: string; en: string; aliases: string[] }
> = {
  product: {
    id: 'produk',
    en: 'products',
    aliases: ['produk', 'product', 'products'],
  },
  service: {
    id: 'jasa',
    en: 'services',
    aliases: ['jasa', 'service', 'services'],
  },
  job: {
    id: 'lowongan',
    en: 'jobs',
    aliases: ['lowongan', 'job', 'jobs', 'hiring'],
  },
  property: {
    id: 'properti',
    en: 'property',
    aliases: ['properti', 'property', 'properties'],
  },
  auction: {
    id: 'lelang',
    en: 'auction',
    aliases: ['lelang', 'auction', 'auctions', 'bidding'],
  },
  tender: {
    id: 'tender',
    en: 'tender',
    aliases: ['tender', 'tenders', 'bid', 'bidding-request'],
  },
  tool_rental: {
    id: 'sewa-alat',
    en: 'tool-rental',
    aliases: ['sewa-alat', 'tool-rental', 'tool_rental', 'rental'],
  },
  business_transfer: {
    id: 'oper-usaha',
    en: 'business-transfer',
    aliases: [
      'oper-usaha',
      'business-transfer',
      'business_transfer',
      'handover',
      'takeover',
      'jual-usaha',
      'usaha-berjalan',
    ],
  },
  company: {
    id: 'profil-usaha',
    en: 'business-profile',
    aliases: ['profil-usaha', 'business-profile', 'company', 'company-profile'],
  },
};

export function resolveCreateFlowFromSide(
  side: ListingSide | null | undefined,
): CreateFlowIntent | null {
  if (side === 'demand') return 'demand';
  if (side === 'supply') return 'supply';
  return null;
}

export function normalizeCreateFlowSegment(
  value: string | null | undefined,
): CreateFlowIntent | null {
  const normalized = cleanText(value).toLowerCase();
  if (!normalized) return null;
  for (const [intent, config] of Object.entries(CREATE_FLOW_SEGMENTS)) {
    if (config.aliases.includes(normalized)) {
      return intent as CreateFlowIntent;
    }
  }
  return null;
}

export function normalizeCreateTypeSegment(
  value: string | null | undefined,
): ListingTypeId | '' {
  const normalized = cleanText(value).toLowerCase();
  if (!normalized) return '';
  for (const [typeId, config] of Object.entries(CREATE_TYPE_SEGMENTS)) {
    if (config.aliases.includes(normalized)) {
      return typeId as ListingTypeId;
    }
  }
  return '';
}

export function buildCreateBasePath({
  locale,
  sideId,
  typeId,
}: {
  locale: string;
  sideId?: ListingSide | null;
  typeId?: string;
}): string {
  const flow = resolveCreateFlowFromSide(sideId);
  if (!flow) return '/create';

  const preferredFlow =
    locale === 'en'
      ? CREATE_FLOW_SEGMENTS[flow].en
      : CREATE_FLOW_SEGMENTS[flow].id;
  const normalizedType = cleanText(typeId).toLowerCase() as ListingTypeId;
  if (
    normalizedType &&
    Object.prototype.hasOwnProperty.call(CREATE_TYPE_SEGMENTS, normalizedType)
  ) {
    const preferredType =
      locale === 'en'
        ? CREATE_TYPE_SEGMENTS[normalizedType].en
        : CREATE_TYPE_SEGMENTS[normalizedType].id;
    return `/create/${preferredFlow}/${preferredType}`;
  }

  return `/create/${preferredFlow}`;
}

export function buildCreateHrefFromSearch(
  searchParamsLike: { toString(): string },
  {
    locale,
    draftId,
    step,
    typeId,
    sideId,
  }: {
    locale: string;
    draftId?: string | null;
    step?: number;
    typeId?: string;
    sideId?: ListingSide | null;
  },
): string {
  const params = new URLSearchParams(searchParamsLike.toString());
  const normalizedStep = clampStep(step ?? 1);
  const nextTypeId = cleanText(typeId).toLowerCase();
  const basePath = buildCreateBasePath({ locale, sideId, typeId: nextTypeId });

  params.delete('type');
  params.delete('side');
  if (draftId) params.set('draft', draftId);
  else params.delete('draft');
  if (draftId || normalizedStep > 1) {
    params.set('step', String(normalizedStep));
  } else {
    params.delete('step');
  }
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function parseDocuments(raw: unknown): DocumentFile[] {
  if (!Array.isArray(raw)) return [];
  const mapped: Array<DocumentFile | null> = raw.map((entry, idx) => {
    if (typeof entry === 'string') {
      const url = normalizeContentMediaUrl(entry);
      if (!url) return null;
      return { name: `Document ${idx + 1}`, url };
    }
    if (!entry || typeof entry !== 'object') return null;
    const doc = entry as Record<string, unknown>;
    const url = normalizeContentMediaUrl(cleanText(doc.url));
    if (!url) return null;
    return {
      name: cleanText(doc.name) || `Document ${idx + 1}`,
      url,
      size: typeof doc.size === 'number' ? doc.size : undefined,
      mime: cleanText(doc.mime) || undefined,
    };
  });
  return mapped.filter((entry): entry is DocumentFile => entry !== null);
}

export function isAllowedDocument(file: File): boolean {
  const lower = file.name.toLowerCase();
  const ext = lower.includes('.') ? `.${lower.split('.').pop()}` : '';
  if (DOC_ALLOWED_MIME.has(file.type)) return true;
  return DOC_ALLOWED_EXT.has(ext);
}

export function formatFileSize(bytes?: number): string {
  if (!Number.isFinite(bytes as number) || !bytes) return '-';
  if ((bytes as number) < 1024) return `${bytes} B`;
  if ((bytes as number) < 1024 * 1024) {
    return `${((bytes as number) / 1024).toFixed(1)} KB`;
  }
  return `${((bytes as number) / (1024 * 1024)).toFixed(1)} MB`;
}

export function supportsSectorClassification(type: string): boolean {
  return type === 'product' || type === 'service';
}

export function extractListingMediaUrls(
  metadata: Record<string, unknown>,
): string[] {
  const candidates: string[] = [];
  for (const key of ['cover_image', 'image', 'thumbnail']) {
    const value = normalizeContentMediaUrl(cleanText(metadata[key]));
    if (value) candidates.push(value);
  }
  for (const key of ['image_urls', 'images', 'gallery', 'gallery_images']) {
    const raw = metadata[key];
    if (!Array.isArray(raw)) continue;
    for (const entry of raw) {
      const value = normalizeContentMediaUrl(cleanText(entry));
      if (value) candidates.push(value);
    }
  }
  return [...new Set(candidates)];
}

export function collectImageUrls(images: ImageFile[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const image of images) {
    const value = normalizeContentMediaUrl(cleanText(image.url));
    if (!value) continue;
    const dedupKey = value.toLowerCase();
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    urls.push(value);
  }
  return urls;
}

export type FieldOverrideMaps = Record<string, Record<string, FieldOverride>>;

type FieldOverride = {
  labelId?: string;
  labelEn?: string;
};

export function resolveDisplayFieldLabel(
  field: SectorField,
  activeType: string,
  listingSide: ListingSide,
  locale: string,
  fieldOverrides: FieldOverrideMaps,
  demandFieldOverrides: FieldOverrideMaps,
): string {
  const override = fieldOverrides[activeType]?.[field.key];
  const sideOverride =
    listingSide === 'demand'
      ? demandFieldOverrides[activeType]?.[field.key]
      : undefined;
  return locale === 'id'
    ? sideOverride?.labelId || override?.labelId || field.labelId
    : sideOverride?.labelEn || override?.labelEn || field.labelEn;
}
