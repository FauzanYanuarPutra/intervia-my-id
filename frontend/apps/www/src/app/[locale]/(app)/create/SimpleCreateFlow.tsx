'use client';

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import NextImage from 'next/image';
import { useLocale } from 'next-intl';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { UmkmLocationPicker } from '@/components/super-app/UmkmLocationPicker';
import { normalizeContentMediaUrl } from '@/lib/content/catalog';
import { buildContentHref } from '@/lib/content/routes';
import type { ListingSide } from '@/lib/content/listingSide';
import { prepareUploadFiles } from '@/lib/media/prepareUploadMedia';
import type { LatLng } from '@/lib/super-app/maps';
import { cn } from '@/lib/utils';
import {
  CREATE_BUSINESS_CATEGORIES,
  buildCreateBusinessCategoryHref,
  getCreateBusinessCategoryImage,
  getCreateBusinessCategoryById,
  type CreateBusinessCategory,
  type CreateBusinessCategoryId,
  type CreateBusinessClassificationChoice,
  type CreateBusinessField,
} from './createBusinessData';

type SimpleCreateFlowProps = {
  entryMode?: 'demand' | 'supply';
  categoryId?: CreateBusinessCategoryId;
};

type SubmitResponse = {
  id?: string;
  title?: string;
  slug?: string;
  error?: string;
  issues?: string[];
};

type DraftImage = {
  id: string;
  file?: File;
  name: string;
  size: number;
  preview: string;
  url?: string;
  uploading?: boolean;
};

type DraftDocument = {
  id: string;
  file?: File;
  name: string;
  size: number;
  mime?: string;
  url?: string;
  uploading?: boolean;
};

type AiImageFieldSuggestion = {
  key: string;
  value: string;
  confidence: number;
  reason?: string;
};

type AiImageAssistResult = {
  readable: boolean;
  confidence: number;
  fields: AiImageFieldSuggestion[];
  notes?: string;
  warnings: string[];
  questions: string[];
  model?: string;
  provider?: string;
  fallback?: boolean;
  provider_errors?: string[];
  learning_event_id?: string;
};

type AiImageAssistReview = 'accurate' | 'needs_fix' | null;

type OwnedUmkmStore = {
  id: string;
  name: string;
  slug?: string;
  city?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  phone?: string | null;
  is_active?: boolean;
  online_order_enabled?: boolean;
  offline_order_enabled?: boolean;
  metadata?: Record<string, unknown> | null;
};

type StoreAvailabilityStatus =
  | 'available'
  | 'limited'
  | 'out_of_stock'
  | 'preorder';

const MAX_IMAGES = 8;
const MAX_DOCUMENTS = 6;
const MAX_LINKED_UMKM_STORES = 12;
const AI_ASSIST_MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const AI_ASSIST_MAX_UPLOAD_BYTES = 2.5 * 1024 * 1024;
const AI_ASSIST_MAX_IMAGE_SIDE = 1280;
const AI_ASSIST_JPEG_QUALITY = 0.82;
const IMAGE_AI_ASSIST_ENABLED =
  process.env.NEXT_PUBLIC_IMAGE_AI_ASSIST_ENABLED === 'true';
const PURPOSE_IMAGE_BY_SIDE: Record<ListingSide, string> = {
  demand: '/images/create/kategori/cari.png',
  supply: '/images/create/kategori/tawar.png',
};
const STEP_PANEL_CLASS =
  'mt-4 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm';
const STEP_PANEL_HEADER_CLASS =
  'border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5';
const STEP_PANEL_BODY_CLASS = 'px-4 py-4 sm:px-6 sm:py-5';

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function createUploadId(file: File): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${file.name}-${file.size}-${random}`;
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 KB';
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

async function prepareImageForAiAssist(file: File): Promise<File> {
  if (typeof window === 'undefined') return file;
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  try {
    const longestSide = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(
      1,
      AI_ASSIST_MAX_IMAGE_SIDE / Math.max(1, longestSide),
    );
    if (scale >= 1 && file.size <= AI_ASSIST_MAX_UPLOAD_BYTES) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
    });
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(resolve, 'image/jpeg', AI_ASSIST_JPEG_QUALITY);
    });
    if (!blob || blob.size >= file.size) return file;

    return new File(
      [blob],
      `${file.name.replace(/\.[^.]+$/, '') || 'lajukan-photo'}-ai.jpg`,
      {
        type: 'image/jpeg',
        lastModified: file.lastModified,
      },
    );
  } finally {
    bitmap.close();
  }
}

function parsePriceToCents(value: string): number | undefined {
  const number = Number(value.replace(/[^\d]/g, ''));
  if (!Number.isFinite(number) || number <= 0) return undefined;
  return Math.round(number * 100);
}

function parseNumberValue(value: string): number | undefined {
  const number = Number(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function parseIntegerValue(value: string): number | undefined {
  const number = parseNumberValue(value);
  return number ? Math.max(1, Math.round(number)) : undefined;
}

function parseStockQuantity(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const number = Number(trimmed.replace(/[^\d]/g, ''));
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.min(999_999, Math.round(number));
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const cleaned = cleanText(value);
    if (cleaned) return cleaned;
  }
  return '';
}

function joinTexts(...values: unknown[]): string {
  return values.map(cleanText).filter(Boolean).join('\n');
}

function normalizeProductCondition(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized.includes('baru')) return 'new';
  if (normalized.includes('rekondisi') || normalized.includes('refurb')) {
    return 'refurbished';
  }
  if (normalized.includes('bekas') || normalized.includes('sewa'))
    return 'good';
  if (normalized.includes('cukup')) return 'fair';
  return normalized ? 'good' : 'new';
}

function resolveCreateContentType(
  category: CreateBusinessCategory,
): CreateBusinessCategory['contentType'] {
  if (category.id === 'equipment') return 'product';
  return category.contentType;
}

function resolveContentStatus(
  contentType: CreateBusinessCategory['contentType'],
  side: ListingSide,
): 'active' | 'draft' {
  if (contentType === 'tool_rental' && side === 'supply') return 'draft';
  return 'active';
}

function resolvePriceUnit(
  contentType: CreateBusinessCategory['contentType'],
  side: ListingSide,
  priceCents?: number,
): string | undefined {
  if (!priceCents) return undefined;
  if (contentType === 'property') return 'month';
  if (contentType === 'tool_rental') return 'day';
  if (contentType === 'business_transfer') return 'deal';
  if (contentType === 'product') return side === 'demand' ? 'shipment' : 'pcs';
  return 'project';
}

function requiresSupplyImageForActive(
  contentType: CreateBusinessCategory['contentType'],
  side: ListingSide,
): boolean {
  return (
    side === 'supply' &&
    (contentType === 'product' || contentType === 'property')
  );
}

function isInventoryAwareCategory(
  category: CreateBusinessCategory,
  side: ListingSide,
): boolean {
  return (
    side === 'supply' &&
    (category.id === 'equipment' ||
      category.id === 'supplies' ||
      category.id === 'nearby')
  );
}

function extractOwnedStores(payload: unknown): OwnedUmkmStore[] {
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  const data = record.data;
  const dataRecord =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  const candidates = Array.isArray(dataRecord?.items)
    ? dataRecord.items
    : Array.isArray(dataRecord?.stores)
      ? dataRecord.stores
      : Array.isArray(record.items)
        ? record.items
        : Array.isArray(record.stores)
          ? record.stores
          : [];

  return candidates
    .map((item): OwnedUmkmStore | null => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const store = item as Record<string, unknown>;
      const id = cleanText(store.id);
      const name = cleanText(store.name);
      if (!id || !name) return null;
      return {
        id,
        name,
        slug: cleanText(store.slug) || undefined,
        city: cleanText(store.city) || null,
        address: cleanText(store.address) || null,
        lat: typeof store.lat === 'number' ? store.lat : null,
        lng: typeof store.lng === 'number' ? store.lng : null,
        phone: cleanText(store.phone) || null,
        is_active:
          typeof store.is_active === 'boolean' ? store.is_active : undefined,
        online_order_enabled:
          typeof store.online_order_enabled === 'boolean'
            ? store.online_order_enabled
            : undefined,
        offline_order_enabled:
          typeof store.offline_order_enabled === 'boolean'
            ? store.offline_order_enabled
            : undefined,
        metadata:
          store.metadata &&
          typeof store.metadata === 'object' &&
          !Array.isArray(store.metadata)
            ? (store.metadata as Record<string, unknown>)
            : null,
      };
    })
    .filter((store): store is OwnedUmkmStore => Boolean(store));
}

function buildCategoryMetadata({
  category,
  contentType,
  side,
  locale,
  values,
  locationPoint,
  imageUrls,
  coverImage,
  documents,
  priceCents,
  classification,
}: {
  category: CreateBusinessCategory;
  contentType: CreateBusinessCategory['contentType'];
  side: ListingSide;
  locale: 'id' | 'en';
  values: Record<string, string>;
  locationPoint?: LatLng | null;
  imageUrls: string[];
  coverImage?: string;
  documents: Array<{ name: string; url: string; size?: number; mime?: string }>;
  priceCents?: number;
  classification?: CreateBusinessClassificationChoice | null;
}): Record<string, unknown> {
  const location = firstText(values.location);
  const mainName = firstText(
    values.equipment_name,
    values.product_name,
    values.service_needed,
    values.place_type,
    values.business_match,
    values.opportunity_type,
    getCategoryTitle(category, locale),
  );
  const notes = firstText(values.notes);
  const base: Record<string, unknown> = {
    listing_mode: 'simple',
    create_mode: 'guided_business_create',
    market_side: side,
    listing_side: side,
    market_role: side === 'demand' ? 'seeker' : 'provider',
    create_category: category.id,
    marketplace_category_slug: category.slugEn,
    marketplace_subcategory_slug: classification?.subcategorySlug,
    marketplace_subcategory_label_id: classification?.subcategoryLabelId,
    marketplace_subcategory_label_en: classification?.subcategoryLabelEn,
    create_type_slug: classification?.slug,
    create_type_label_id: classification?.typeLabelId,
    create_type_label_en: classification?.typeLabelEn,
    product_family_slug: classification?.slug,
    product_family_label:
      classification &&
      (locale === 'id'
        ? classification.typeLabelId
        : classification.typeLabelEn),
    classification_path: classification
      ? [
          locale === 'id' ? category.titleId : category.titleEn,
          locale === 'id'
            ? classification.subcategoryLabelId
            : classification.subcategoryLabelEn,
          locale === 'id'
            ? classification.typeLabelId
            : classification.typeLabelEn,
        ]
      : [locale === 'id' ? category.titleId : category.titleEn],
    classification_examples: classification
      ? locale === 'id'
        ? classification.examplesId
        : classification.examplesEn
      : [],
    business_discovery_category: category.id,
    create_category_label: getCategoryTitle(category, locale),
    location,
    location_precision: locationPoint
      ? 'map_point'
      : location
        ? 'area_text'
        : 'unspecified',
    has_precise_location: Boolean(locationPoint),
    target_date: firstText(values.deadline),
    images: imageUrls,
    image_urls: imageUrls,
    gallery_images: imageUrls,
    cover_image: coverImage,
    documents,
    notes,
    ...values,
  };
  if (locationPoint) {
    base.latitude = locationPoint.lat;
    base.longitude = locationPoint.lng;
    base.lat = locationPoint.lat;
    base.lng = locationPoint.lng;
    base.location_point = locationPoint;
    base.map_provider = 'openstreetmap';
  }
  if (side === 'demand') {
    const budgetLabel = firstText(values.budget, values.capital_range);
    if (budgetLabel) base.budget_label = budgetLabel;
    if (priceCents) base.budget_cents = priceCents;
  }

  if (contentType === 'product') {
    const productName = firstText(
      values.product_name,
      values.equipment_name,
      mainName,
    );
    const specification = joinTexts(
      values.specification,
      values.grade_spec,
      values.capacity,
      values.packaging,
      values.certification_need,
    );
    return {
      ...base,
      product_name: productName,
      brand: firstText(values.brand, productName, 'Tidak disebutkan'),
      sku: firstText(
        values.sku,
        values.asset_identity_code,
        `${category.id}-${Date.now()}`,
      ),
      condition: normalizeProductCondition(
        firstText(values.equipment_condition, values.condition),
      ),
      availability: side === 'supply' ? 'in_stock' : 'needed',
      seller_type:
        side === 'supply'
          ? firstText(
              values.supplier_role,
              category.id === 'supplies'
                ? 'supplier_first_hand'
                : 'product_only',
            )
          : 'buyer_request',
      preferred_supplier_type:
        side === 'demand' ? firstText(values.supplier_role) : '',
      product_form: firstText(values.product_form),
      stock:
        parseIntegerValue(firstText(values.stock)) ||
        (side === 'supply' ? 1 : undefined),
      quantity_needed:
        side === 'demand'
          ? firstText(values.quantity, values.minimum_order)
          : '',
      minimum_order: firstText(values.quantity, values.minimum_order),
      unit: firstText(values.unit),
      specs: specification || productName,
      delivery_estimate: firstText(
        values.shipping_need,
        values.delivery_installation,
        values.deadline,
        'Disesuaikan',
      ),
      shipping_method: firstText(values.shipping_method, 'pickup'),
      power_watt: parseIntegerValue(firstText(values.power_watt)),
      dimensions: {
        width_cm: parseNumberValue(firstText(values.width_cm)),
        length_cm: parseNumberValue(firstText(values.length_cm)),
        height_cm: parseNumberValue(firstText(values.height_cm)),
        weight_kg: parseNumberValue(firstText(values.weight_kg)),
      },
    };
  }

  if (contentType === 'property') {
    return {
      ...base,
      property_type: firstText(values.place_type, 'commercial_space'),
      listing_purpose: side === 'demand' ? 'looking' : 'rent',
      availability_status: side === 'demand' ? 'needed' : 'available',
      size: firstText(values.size),
      area_sqm: parseNumberValue(firstText(values.area_sqm)),
      front_width_m: parseNumberValue(firstText(values.front_width_m)),
      electricity_watt: parseIntegerValue(firstText(values.electricity_watt)),
      facilities: firstText(values.facilities),
      lease_term: firstText(values.rent_duration, values.deadline),
      preferred_period:
        side === 'demand'
          ? firstText(values.rent_duration, values.deadline)
          : '',
      traffic_notes: firstText(values.traffic_notes),
    };
  }

  if (contentType === 'tool_rental') {
    const replacementValue =
      parsePriceToCents(firstText(values.replacement_value)) ||
      priceCents ||
      100;
    const deposit =
      parsePriceToCents(firstText(values.deposit)) ||
      Math.max(100, Math.round(replacementValue * 0.2));
    return {
      ...base,
      brand: firstText(values.brand, mainName, 'Tidak disebutkan'),
      model_name: firstText(values.model_name, values.equipment_name, mainName),
      asset_identity_code: firstText(
        values.asset_identity_code,
        `${category.id}-${Date.now()}`,
      ),
      specs: firstText(values.specification, mainName),
      condition: 'good',
      condition_notes: firstText(
        values.equipment_condition,
        values.specification,
        'Kondisi akan diverifikasi Lajukan.',
      ),
      known_defects: firstText(
        values.known_defects,
        'Tidak ada yang diketahui.',
      ),
      included_items: firstText(
        values.included_items,
        'Unit utama dan aksesoris standar.',
      ),
      operating_instructions: firstText(
        values.operating_instructions,
        'Instruksi akan diberikan saat serah terima.',
      ),
      usage_restrictions: firstText(
        values.usage_restrictions,
        'Tidak boleh dipindahtangankan tanpa persetujuan.',
      ),
      rental_rate_type: 'day',
      deposit_amount_cents: deposit,
      replacement_value_cents: Math.max(replacementValue, deposit),
      minimum_rental_days:
        parseIntegerValue(firstText(values.minimum_rental_days)) || 1,
      late_fee_cents_per_day:
        parsePriceToCents(firstText(values.late_fee)) ||
        Math.max(100, Math.round((priceCents || 100) * 0.5)),
      pickup_location: location,
      return_location: location,
      availability_status: 'available',
      inspection_checklist: firstText(
        values.inspection_checklist,
        'Foto kondisi, kelengkapan, fungsi utama, dan nomor aset.',
      ),
      complaint_window_hours:
        parseIntegerValue(firstText(values.complaint_window_hours)) || 24,
      identity_requirements: firstText(
        values.identity_requirements,
        'KTP dan verifikasi akun Lajukan.',
      ),
      ownership_proof: firstText(
        values.ownership_proof,
        'Bukti kepemilikan akan dicek Lajukan.',
      ),
      cancellation_policy: firstText(
        values.cancellation_policy,
        'Pembatalan mengikuti kebijakan Lajukan.',
      ),
      return_terms: firstText(
        values.return_terms,
        'Barang dikembalikan sesuai kondisi serah terima.',
      ),
      dispute_process: firstText(
        values.dispute_process,
        'Sengketa diproses berdasarkan bukti foto/video dan checklist.',
      ),
      requires_video_checkin: 'required',
      requires_video_checkout: 'required',
      requires_photo_inventory: 'required',
      lajukan_rental_review: {
        review_state: 'pending_lajukan_review',
        public_visibility: 'hidden_until_approved',
        custody_mode: 'lajukan_physical_hold',
        return_shipping_payer_if_rejected: 'owner_sender',
      },
    };
  }

  return {
    ...base,
    work_mode: firstText(
      values.work_mode,
      side === 'demand' ? 'onsite' : 'remote',
    ),
    service_scope: firstText(
      values.scope,
      values.collaboration_goal,
      values.support_needed,
      values.requirements,
      mainName,
    ),
    deliverables: firstText(
      values.deliverables,
      values.support_needed,
      'Output disesuaikan kebutuhan.',
    ),
    rate_type: firstText(values.rate_type, 'project'),
    availability: firstText(
      values.availability,
      values.deadline,
      'Disesuaikan',
    ),
    area_served: firstText(values.location, values.territory, 'Indonesia'),
    delivery_time: firstText(values.deadline, 'Disesuaikan'),
    revisions_included:
      parseIntegerValue(firstText(values.revision_count)) || 1,
    opportunity_type: firstText(values.opportunity_type),
    business_model: firstText(values.business_model, values.commercial_model),
    capital_range: firstText(values.capital_range),
  };
}

function extractUploadedImageUrls(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  const raw = Array.isArray(record.urls)
    ? record.urls
    : Array.isArray(record.images)
      ? record.images
      : [];
  return raw
    .map(item => {
      if (typeof item === 'string') return normalizeContentMediaUrl(item);
      if (item && typeof item === 'object') {
        const image = item as Record<string, unknown>;
        return normalizeContentMediaUrl(
          cleanText(image.url) || cleanText(image.src) || cleanText(image.path),
        );
      }
      return '';
    })
    .filter(Boolean);
}

function extractUploadedDocuments(payload: unknown): DraftDocument[] {
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  const raw = Array.isArray(record.files)
    ? record.files
    : Array.isArray(record.documents)
      ? record.documents
      : Array.isArray(record.urls)
        ? record.urls
        : [];
  const documents: DraftDocument[] = [];
  raw.forEach((item, index) => {
    if (typeof item === 'string') {
      const url = normalizeContentMediaUrl(item);
      if (!url) return;
      documents.push({
        id: `${url}-${index}`,
        name: url.split('/').pop() || `document-${index + 1}`,
        size: 0,
        url,
      });
      return;
    }

    if (!item || typeof item !== 'object') return;
    const document = item as Record<string, unknown>;
    const url = normalizeContentMediaUrl(
      cleanText(document.url) ||
        cleanText(document.src) ||
        cleanText(document.path),
    );
    if (!url) return;
    documents.push({
      id: `${url}-${index}`,
      name:
        cleanText(document.name) ||
        url.split('/').pop() ||
        `document-${index + 1}`,
      size: typeof document.size === 'number' ? document.size : 0,
      mime: cleanText(document.mime) || cleanText(document.type),
      url,
    });
  });
  return documents;
}

function getFieldLabel(
  field: CreateBusinessField,
  locale: 'id' | 'en',
): string {
  return locale === 'id' ? field.labelId : field.labelEn;
}

function getFieldPlaceholder(
  field: CreateBusinessField,
  locale: 'id' | 'en',
): string {
  return locale === 'id' ? field.placeholderId : field.placeholderEn;
}

function getSideAwareFieldLabel(
  field: CreateBusinessField,
  locale: 'id' | 'en',
  side?: ListingSide,
): string {
  if (field.key === 'product_name') {
    if (locale === 'id') {
      return side === 'demand'
        ? 'Bahan / produk yang dicari'
        : 'Bahan / produk yang ditawarkan';
    }
    return side === 'demand'
      ? 'Supply / product needed'
      : 'Supply / product offered';
  }
  if (field.key === 'supplier_role') {
    if (locale === 'id') {
      return side === 'demand'
        ? 'Tipe penyedia yang dicari'
        : 'Tipe penjual / penyedia';
    }
    return side === 'demand'
      ? 'Provider type needed'
      : 'Seller / provider type';
  }
  if (field.key === 'location') {
    if (locale === 'id') {
      return side === 'demand' ? 'Area kebutuhan' : 'Lokasi penawaran';
    }
    return side === 'demand' ? 'Need area' : 'Offer location';
  }
  if (field.key === 'budget') {
    if (locale === 'id') {
      return side === 'demand' ? 'Budget acuan' : 'Harga / kisaran harga';
    }
    return side === 'demand' ? 'Reference budget' : 'Price / price range';
  }
  if (field.key === 'deadline') {
    if (locale === 'id') {
      return side === 'demand' ? 'Target dibutuhkan' : 'Tanggal tersedia';
    }
    return side === 'demand' ? 'Needed by' : 'Available date';
  }
  return getFieldLabel(field, locale);
}

function getSideAwareFieldPlaceholder(
  field: CreateBusinessField,
  locale: 'id' | 'en',
  side?: ListingSide,
): string {
  if (field.key === 'product_name') {
    if (locale === 'id') {
      return side === 'demand'
        ? 'Contoh: ayam potong, ayam fillet, tepung, cup plastik'
        : 'Contoh: ayam potong, ayam fillet, tepung, cup plastik';
    }
    return side === 'demand'
      ? 'Example: chicken cuts, chicken fillet, flour, plastic cups'
      : 'Example: chicken cuts, chicken fillet, flour, plastic cups';
  }
  if (field.key === 'supplier_role') {
    if (locale === 'id') {
      return side === 'demand'
        ? 'Contoh: supplier ayam potong, distributor frozen, produsen langsung'
        : 'Contoh: supplier, distributor, peternakan, produsen langsung';
    }
    return side === 'demand'
      ? 'Example: chicken supplier, frozen distributor, direct producer'
      : 'Example: supplier, distributor, farm, direct producer';
  }
  if (field.key === 'location') {
    if (locale === 'id') {
      return side === 'demand'
        ? 'Cukup kota/area: Bandung, Cimahi, Jabodetabek'
        : 'Alamat/cabang/pickup point penawaran';
    }
    return side === 'demand'
      ? 'City or area: Bandung, Cimahi, Jabodetabek'
      : 'Offer address, branch, or pickup point';
  }
  if (field.key === 'budget') {
    if (locale === 'id') {
      return side === 'demand'
        ? 'Contoh: fleksibel, Rp 5 juta, atau minta quotation'
        : 'Contoh: Rp 5.000.000 atau mulai dari Rp 500.000';
    }
    return side === 'demand'
      ? 'Example: flexible, IDR 5M, or quote needed'
      : 'Example: IDR 5,000,000 or starts from IDR 500,000';
  }
  if (field.key === 'deadline') {
    if (locale === 'id') {
      return side === 'demand'
        ? 'Kapan paling lambat dibutuhkan?'
        : 'Kapan mulai tersedia?';
    }
    return side === 'demand' ? 'When do you need it by?' : 'Available from?';
  }
  return getFieldPlaceholder(field, locale);
}

function getCategoryTitle(
  category: CreateBusinessCategory,
  locale: 'id' | 'en',
): string {
  return locale === 'id' ? category.titleId : category.titleEn;
}

function getClassificationSubcategoryLabel(
  choice: CreateBusinessClassificationChoice,
  locale: 'id' | 'en',
): string {
  return locale === 'id'
    ? choice.subcategoryLabelId
    : choice.subcategoryLabelEn;
}

function getClassificationTypeLabel(
  choice: CreateBusinessClassificationChoice,
  locale: 'id' | 'en',
): string {
  return locale === 'id' ? choice.typeLabelId : choice.typeLabelEn;
}

function getClassificationDescription(
  choice: CreateBusinessClassificationChoice,
  locale: 'id' | 'en',
): string {
  return locale === 'id' ? choice.descriptionId : choice.descriptionEn;
}

function getClassificationUseWhen(
  choice: CreateBusinessClassificationChoice,
  locale: 'id' | 'en',
): string {
  return locale === 'id' ? choice.useWhenId : choice.useWhenEn;
}

function getClassificationExamples(
  choice: CreateBusinessClassificationChoice,
  locale: 'id' | 'en',
): string[] {
  return locale === 'id' ? choice.examplesId : choice.examplesEn;
}

function getClassificationPath(
  category: CreateBusinessCategory,
  choice: CreateBusinessClassificationChoice,
  locale: 'id' | 'en',
): string {
  return [
    getCategoryTitle(category, locale),
    getClassificationSubcategoryLabel(choice, locale),
    getClassificationTypeLabel(choice, locale),
  ].join(' > ');
}

function getCategoryDescription(
  category: CreateBusinessCategory,
  locale: 'id' | 'en',
  side?: ListingSide,
): string {
  if (side === 'demand') {
    const descriptions: Record<CreateBusinessCategoryId, string> =
      locale === 'id'
        ? {
            supplies:
              'Jelaskan bahan, stok, supplier, atau kemasan yang kamu cari.',
            service:
              'Jelaskan jasa, output, deadline, dan kriteria vendor yang kamu butuhkan.',
            equipment:
              'Jelaskan mesin atau alat yang kamu cari, termasuk spesifikasi dan konteks pemakaian.',
            property:
              'Jelaskan jenis tempat, area, ukuran, dan syarat lokasi yang dibutuhkan.',
            nearby:
              'Jelaskan area sekitar, jenis usaha, atau layanan lokal yang kamu cari.',
            opportunity:
              'Jelaskan peluang usaha, kemitraan, reseller, atau partner yang kamu cari.',
          }
        : {
            supplies:
              'Describe the materials, stock, supplier, or packaging you need.',
            service:
              'Describe the service, output, timeline, and vendor criteria you need.',
            equipment:
              'Describe the machine or tool you need, including specs and usage context.',
            property:
              'Describe the place type, area, size, and location requirements.',
            nearby:
              'Describe the nearby area, local business, or local service you need.',
            opportunity:
              'Describe the business opportunity, partnership, reseller, or partner you need.',
          };
    return descriptions[category.id];
  }
  if (side === 'supply') {
    const descriptions: Record<CreateBusinessCategoryId, string> =
      locale === 'id'
        ? {
            supplies:
              'Pasang penawaran bahan, stok, supplier, kemasan, atau produk untuk pembeli.',
            service:
              'Pasang penawaran jasa dengan scope, output, timeline, dan cara kerja.',
            equipment:
              'Pasang penawaran mesin atau alat dengan spesifikasi, kondisi, dan dukungan.',
            property:
              'Pasang penawaran tempat usaha dengan lokasi, fasilitas, dan syarat sewa.',
            nearby:
              'Pasang penawaran usaha sekitar agar calon pembeli mudah menemukan cabangmu.',
            opportunity:
              'Pasang penawaran peluang usaha, kemitraan, franchise, atau reseller.',
          }
        : {
            supplies:
              'Post an offer for materials, stock, suppliers, packaging, or products.',
            service:
              'Post a service offer with scope, output, timeline, and work mode.',
            equipment:
              'Post a machine or tool offer with specs, condition, and support.',
            property:
              'Post a business place offer with location, facilities, and rental terms.',
            nearby:
              'Post a nearby business offer so buyers can find your branch.',
            opportunity:
              'Post a business opportunity, partnership, franchise, or reseller offer.',
          };
    return descriptions[category.id];
  }
  return locale === 'id' ? category.descriptionId : category.descriptionEn;
}

function CreateStepPanel({
  eyebrow,
  title,
  description,
  children,
  className,
  bodyClassName,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn(STEP_PANEL_CLASS, className)}>
      <div className={STEP_PANEL_HEADER_CLASS}>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-lg font-bold tracking-[-0.03em] text-slate-950 sm:text-xl">
          {title}
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
          {description}
        </p>
      </div>
      <div className={cn(STEP_PANEL_BODY_CLASS, bodyClassName)}>{children}</div>
    </section>
  );
}

function ClassificationPicker({
  category,
  side,
  locale,
  selectedSlug,
  onSelect,
}: {
  category: CreateBusinessCategory;
  side: ListingSide;
  locale: 'id' | 'en';
  selectedSlug: string;
  onSelect: (slug: string) => void;
}) {
  const isDemand = side === 'demand';
  const selectedChoice =
    category.classificationChoices.find(item => item.slug === selectedSlug) ||
    null;

  return (
    <section className="mb-4 rounded-[24px] border border-slate-200 bg-white p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">
            {locale === 'id' ? 'Bantu klasifikasi' : 'Classification assist'}
          </p>
          <h2 className="mt-1 text-base font-bold tracking-[-0.03em] text-slate-950">
            {locale === 'id'
              ? 'Pilih jenis paling dekat'
              : 'Choose the closest type'}
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
            {locale === 'id'
              ? 'Kategori besar sudah dipilih. Sekarang tentukan jenis yang paling mirip agar orang tidak perlu menebak ini masuk tipe, kategori, atau deskripsi.'
              : 'The broad category is set. Now choose the closest type so people do not need to guess whether this belongs in type, category, or description.'}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 ring-1 ring-slate-200 lg:max-w-[330px]">
          <span className="font-bold text-slate-800">
            {locale === 'id' ? 'Aturan cepat: ' : 'Quick rule: '}
          </span>
          {locale === 'id'
            ? 'nama usaha masuk identitas penjual, barang/jasa masuk field utama, dan pilihan di sini membantu search.'
            : 'business name goes to seller identity, item/service goes to the main field, and this choice helps search.'}
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {category.classificationChoices.map(choice => {
          const selected = choice.slug === selectedSlug;
          return (
            <button
              key={choice.slug}
              type="button"
              onClick={() => onSelect(choice.slug)}
              aria-pressed={selected}
              className={cn(
                'min-h-[150px] rounded-2xl border p-3 text-left transition focus:outline-none focus:ring-4 focus:ring-emerald-100',
                selected
                  ? 'border-emerald-300 bg-emerald-50 shadow-sm'
                  : 'border-slate-200 bg-slate-50 hover:border-emerald-200 hover:bg-white',
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-950">
                    {getClassificationTypeLabel(choice, locale)}
                  </span>
                  <span className="mt-1 block text-[11px] font-bold text-emerald-700">
                    {getClassificationSubcategoryLabel(choice, locale)}
                  </span>
                </span>
                {selected ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : null}
              </span>
              <span className="mt-2 block text-xs leading-5 text-slate-600">
                {getClassificationDescription(choice, locale)}
              </span>
              <span className="mt-3 flex flex-wrap gap-1.5">
                {getClassificationExamples(choice, locale)
                  .slice(0, 3)
                  .map(example => (
                    <span
                      key={example}
                      className={cn(
                        'rounded-full px-2 py-1 text-[10px] font-bold',
                        selected
                          ? 'bg-white text-emerald-700 ring-1 ring-emerald-100'
                          : 'bg-white text-slate-500 ring-1 ring-slate-200',
                      )}
                    >
                      {example}
                    </span>
                  ))}
              </span>
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          'mt-4 rounded-2xl border px-3 py-3 text-xs leading-5',
          selectedChoice
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : 'border-dashed border-slate-200 bg-slate-50 text-slate-600',
        )}
      >
        {selectedChoice ? (
          <>
            <p className="font-bold">
              {locale === 'id' ? 'Tersimpan sebagai: ' : 'Saved as: '}
              {getClassificationPath(category, selectedChoice, locale)}
            </p>
            <p className="mt-1 text-emerald-800/85">
              {getClassificationUseWhen(selectedChoice, locale)}
            </p>
            {category.id === 'supplies' &&
            selectedChoice.slug === 'meat-poultry' ? (
              <p className="mt-2 rounded-xl bg-white px-3 py-2 text-emerald-900 ring-1 ring-emerald-100">
                {locale === 'id'
                  ? isDemand
                    ? 'Contoh AyamQu: kalau kamu mencari supplier ayam untuk restoran, tulis barangnya "ayam potong / ayam fillet", bukan menjadikan AyamQu sebagai kategori.'
                    : 'Contoh AyamQu: nama usahanya AyamQu, jenisnya Daging & Unggas, tipe penjualnya bisa supplier/distributor, dan barangnya ayam utuh, fillet, paha, dada, atau frozen.'
                  : isDemand
                    ? 'AyamQu example: if you are looking for a chicken supplier for a restaurant, write the item as chicken cuts or fillets instead of making AyamQu the category.'
                    : 'AyamQu example: the business name is AyamQu, the type is Meat & Poultry, seller type can be supplier/distributor, and items can be whole chicken, fillet, thighs, breast, or frozen.'}
              </p>
            ) : null}
          </>
        ) : (
          <p>
            {locale === 'id'
              ? 'Pilih satu jenis. Kalau belum pas, pilih yang paling dekat lalu jelaskan detailnya di field utama.'
              : 'Choose one type. If none is perfect, choose the closest one and explain the detail in the main field.'}
          </p>
        )}
      </div>
    </section>
  );
}

function PurposeCard({
  side,
  locale,
}: {
  side: ListingSide;
  locale: 'id' | 'en';
}) {
  const isDemand = side === 'demand';
  const imageSrc = PURPOSE_IMAGE_BY_SIDE[side];
  const href = isDemand
    ? locale === 'en'
      ? '/create/need'
      : '/create/butuh'
    : locale === 'en'
      ? '/create/sell'
      : '/create/jual';
  const examples =
    locale === 'id'
      ? isDemand
        ? ['supplier', 'jasa', 'tempat']
        : ['produk', 'jasa', 'peluang']
      : isDemand
        ? ['supplier', 'service', 'place']
        : ['product', 'service', 'opportunity'];

  return (
    <Link
      href={href}
      className="group grid min-h-[260px] overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-white hover:shadow-md sm:grid-cols-[minmax(0,1fr)_210px]"
    >
      <span className="flex min-h-[220px] flex-col justify-between p-5">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700 ring-1 ring-emerald-100">
          {isDemand
            ? locale === 'id'
              ? 'Cari kebutuhan'
              : 'Find needs'
            : locale === 'id'
              ? 'Pasang penawaran'
              : 'Post offer'}
        </span>
        <span className="mt-5 block">
          <span className="block text-2xl font-bold tracking-[-0.04em] text-slate-950 sm:text-[28px]">
            {isDemand
              ? locale === 'id'
                ? 'Saya butuh sesuatu'
                : 'I need something'
              : locale === 'id'
                ? 'Saya mau jual / tawarkan'
                : 'I want to sell / offer'}
          </span>
          <span className="mt-2 block max-w-xl text-sm leading-6 text-slate-600">
            {isDemand
              ? locale === 'id'
                ? 'Buat permintaan supplier, jasa, tempat, atau peluang usaha agar penyedia yang cocok bisa merespons.'
                : 'Create a request for suppliers, services, places, or opportunities so suitable providers can respond.'
              : locale === 'id'
                ? 'Pasang penawaran produk, jasa, tempat, atau peluang usaha dengan data yang mudah dipahami pembeli.'
                : 'Create an offer for products, services, places, or opportunities with buyer-friendly details.'}
          </span>
        </span>
        <span className="mt-5 flex flex-wrap items-center gap-2">
          {examples.map(example => (
            <span
              key={example}
              className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200"
            >
              {example}
            </span>
          ))}
          <span className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-white transition group-hover:translate-x-0.5">
            <ArrowRight className="h-4 w-4" />
          </span>
        </span>
      </span>
      <span className="relative min-h-[210px] overflow-hidden border-t border-slate-200 bg-white sm:border-l sm:border-t-0">
        <NextImage
          src={imageSrc}
          alt={
            isDemand
              ? locale === 'id'
                ? 'Ilustrasi mencari kebutuhan'
                : 'Need search illustration'
              : locale === 'id'
                ? 'Ilustrasi menawarkan produk'
                : 'Offer illustration'
          }
          fill
          sizes="(min-width: 640px) 210px, 100vw"
          className="object-cover object-center transition duration-300 group-hover:scale-[1.03]"
          priority
          draggable={false}
        />
      </span>
    </Link>
  );
}

function CategoryCard({
  category,
  side,
  locale,
}: {
  category: CreateBusinessCategory;
  side: ListingSide;
  locale: 'id' | 'en';
}) {
  const visual = getCreateBusinessCategoryImage(category.id);
  return (
    <Link
      href={buildCreateBusinessCategoryHref({ locale, side, category })}
      className="group flex min-h-[236px] flex-col justify-between overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-white hover:shadow-md"
    >
      <span className="flex min-h-[106px] items-start justify-between gap-3 border-b border-slate-200 bg-white p-4">
        <span className="min-w-0">
          <span className="block text-base font-bold text-slate-950">
            {getCategoryTitle(category, locale)}
          </span>
          <span className="mt-1 block text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">
            {locale === 'id' ? category.badgeId : category.badgeEn}
          </span>
        </span>
        <span className="relative h-[82px] w-[82px] shrink-0 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center',
              visual.containerClassName,
            )}
          >
            <NextImage
              src={visual.src}
              alt={getCategoryTitle(category, locale)}
              width={visual.imageSize}
              height={visual.imageSize}
              className="pointer-events-none select-none object-contain transition-transform duration-300 group-hover:scale-105"
              style={{
                width: visual.imageSize,
                height: visual.imageSize,
                transform: `scaleX(${visual.flip ? -1 : 1}) scale(${visual.scale}) rotate(${visual.rotate}deg)`,
              }}
              draggable={false}
            />
          </span>
        </span>
      </span>
      <span className="flex flex-1 flex-col justify-between p-4">
        <span className="line-clamp-3 text-sm leading-6 text-slate-600">
          {getCategoryDescription(category, locale, side)}
        </span>
        <span className="mt-4 block rounded-xl bg-white px-3 py-2 text-xs font-semibold leading-5 text-slate-600 ring-1 ring-slate-200">
          {locale === 'id' ? category.exampleId : category.exampleEn}
        </span>
        <span className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-3 text-xs font-bold text-white shadow-[0_14px_24px_-18px_rgba(22,163,74,0.55)]">
          {locale === 'id' ? 'Pakai kategori ini' : 'Use this category'}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </span>
      </span>
    </Link>
  );
}

function StepHeader({
  locale,
  side,
  category,
}: {
  locale: 'id' | 'en';
  side?: ListingSide;
  category?: CreateBusinessCategory | null;
}) {
  const activeStep = category ? 3 : side ? 2 : 1;
  const labels =
    locale === 'id'
      ? ['Tujuan', 'Kategori', 'Form']
      : ['Purpose', 'Category', 'Form'];

  return (
    <div className="w-full lg:max-w-[460px]">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
        {locale === 'id' ? 'Progress' : 'Progress'}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {labels.map((label, index) => {
          const active = index + 1 <= activeStep;
          const current = index + 1 === activeStep;
          return (
            <div
              key={label}
              className={cn(
                'min-h-[58px] rounded-2xl border px-3 py-2 transition',
                current
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm'
                  : active
                    ? 'border-emerald-100 bg-white text-slate-900'
                    : 'border-slate-200 bg-slate-50 text-slate-400',
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    active
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-slate-400 ring-1 ring-slate-200',
                  )}
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold">
                    {label}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] font-semibold opacity-70">
                    {current
                      ? locale === 'id'
                        ? 'Saat ini'
                        : 'Current'
                      : active
                        ? locale === 'id'
                          ? 'Selesai'
                          : 'Done'
                        : locale === 'id'
                          ? 'Berikutnya'
                          : 'Next'}
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SimpleCreateFlow({
  entryMode,
  categoryId,
}: SimpleCreateFlowProps) {
  const locale = useLocale() === 'en' ? 'en' : 'id';
  const { authFetch } = useAuth();
  const side = entryMode;
  const category = categoryId
    ? getCreateBusinessCategoryById(categoryId)
    : null;
  const classificationChoices = useMemo(
    () => category?.classificationChoices || [],
    [category],
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [selectedClassificationSlug, setSelectedClassificationSlug] =
    useState('');
  const [locationPoint, setLocationPoint] = useState<LatLng | null>(null);
  const [images, setImages] = useState<DraftImage[]>([]);
  const [documents, setDocuments] = useState<DraftDocument[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [error, setError] = useState('');
  const [successHref, setSuccessHref] = useState('');
  const [ownedStores, setOwnedStores] = useState<OwnedUmkmStore[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storesError, setStoresError] = useState('');
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [storeStockById, setStoreStockById] = useState<Record<string, string>>(
    {},
  );
  const [storeAvailabilityById, setStoreAvailabilityById] = useState<
    Record<string, StoreAvailabilityStatus>
  >({});
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [aiImageAssist, setAiImageAssist] =
    useState<AiImageAssistResult | null>(null);
  const [aiImageAssistLoading, setAiImageAssistLoading] = useState(false);
  const [aiImageAssistError, setAiImageAssistError] = useState('');
  const [aiImageAssistReview, setAiImageAssistReview] =
    useState<AiImageAssistReview>(null);
  const [aiAppliedFieldKeys, setAiAppliedFieldKeys] = useState<string[]>([]);

  const title = useMemo(() => {
    if (category) {
      return side === 'demand'
        ? locale === 'id'
          ? `Buat kebutuhan: ${category.titleId}`
          : `Create request: ${category.titleEn}`
        : locale === 'id'
          ? `Tawarkan: ${category.titleId}`
          : `Offer: ${category.titleEn}`;
    }
    if (side) {
      return side === 'demand'
        ? locale === 'id'
          ? 'Apa yang kamu butuhkan?'
          : 'What do you need?'
        : locale === 'id'
          ? 'Apa yang mau kamu tawarkan?'
          : 'What do you want to offer?';
    }
    return locale === 'id' ? 'Buat postingan baru' : 'Create a new post';
  }, [category, locale, side]);
  const isDemandFlow = side === 'demand';
  const selectedClassification = useMemo(
    () =>
      classificationChoices.find(
        item => item.slug === selectedClassificationSlug,
      ) || null,
    [classificationChoices, selectedClassificationSlug],
  );
  const requiresMapPoint = false;
  const shouldShowBusinessLinking = side === 'supply';
  const visibleCategoryFields = category
    ? category.fields.filter(field => showOptionalDetails || field.required)
    : [];
  const hiddenOptionalFieldCount = category
    ? category.fields.filter(field => !field.required).length
    : 0;

  useEffect(() => {
    setShowOptionalDetails(false);
    setSelectedClassificationSlug('');
  }, [category?.id, side]);

  function updateValue(key: string, value: string) {
    setValues(current => ({ ...current, [key]: value }));
  }

  function getFieldName(key: string) {
    if (key === 'notes') {
      return locale === 'id' ? 'Catatan tambahan' : 'Additional notes';
    }
    const field = category?.fields.find(item => item.key === key);
    if (!field) return key;
    return getSideAwareFieldLabel(field, locale, side);
  }

  function applyAiSuggestion(suggestion: AiImageFieldSuggestion) {
    setValues(current => ({
      ...current,
      [suggestion.key]: suggestion.value,
    }));
    setAiAppliedFieldKeys(current =>
      current.includes(suggestion.key) ? current : [...current, suggestion.key],
    );
  }

  function applyAiSuggestionsToEmptyFields() {
    if (!aiImageAssist) return;
    const applicable = aiImageAssist.fields.filter(
      suggestion =>
        suggestion.confidence >= 0.62 && !values[suggestion.key]?.trim(),
    );
    if (aiImageAssist.notes && !values.notes?.trim()) {
      applicable.push({
        key: 'notes',
        value: aiImageAssist.notes,
        confidence: aiImageAssist.confidence,
      });
    }
    if (applicable.length === 0) return;
    setValues(current => {
      const next = { ...current };
      applicable.forEach(suggestion => {
        if (!next[suggestion.key]?.trim()) {
          next[suggestion.key] = suggestion.value;
        }
      });
      return next;
    });
    setAiAppliedFieldKeys(current => {
      const next = new Set(current);
      applicable.forEach(suggestion => next.add(suggestion.key));
      return Array.from(next);
    });
  }

  async function sendAiImageAssistReview(
    review: Exclude<AiImageAssistReview, null>,
  ) {
    setAiImageAssistReview(review);
    if (!aiImageAssist?.learning_event_id) return;

    try {
      await authFetch('/api/ai/create-from-image/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: aiImageAssist.learning_event_id,
          review,
          locale,
          side,
          category_title: category ? getCategoryTitle(category, locale) : '',
          provider: aiImageAssist.provider,
          model: aiImageAssist.model,
          readable: aiImageAssist.readable,
          confidence: aiImageAssist.confidence,
          applied_field_keys: aiAppliedFieldKeys,
          final_values: values,
          suggested_fields: Object.fromEntries(
            aiImageAssist.fields.map(suggestion => [
              suggestion.key,
              suggestion.value,
            ]),
          ),
        }),
      });
    } catch (error) {
      console.warn('[AI_IMAGE_ASSIST_FEEDBACK_ERROR]', error);
    }
  }

  async function requestAiImageAssist() {
    if (!IMAGE_AI_ASSIST_ENABLED) {
      setAiImageAssist(null);
      setAiImageAssistError(
        locale === 'id'
          ? 'Bantuan AI baca foto sedang dimatikan sementara agar proses create tetap cepat.'
          : 'Photo reading AI is temporarily disabled so create stays fast.',
      );
      return;
    }
    if (!category || !side) return;
    const firstImage = images.find(item => item.file);
    if (!firstImage?.file) {
      setAiImageAssistError(
        locale === 'id'
          ? 'Upload satu foto dulu, lalu AI bisa bantu baca isi fotonya.'
          : 'Upload one photo first, then AI can help read it.',
      );
      return;
    }
    if (firstImage.file.size > AI_ASSIST_MAX_SOURCE_BYTES) {
      setAiImageAssistError(
        locale === 'id'
          ? 'Foto terlalu besar untuk bantuan cepat. Pakai foto di bawah 12 MB.'
          : 'The photo is too large for quick assist. Use an image under 12 MB.',
      );
      return;
    }

    setAiImageAssistLoading(true);
    setAiImageAssistError('');
    setAiImageAssistReview(null);
    setAiAppliedFieldKeys([]);

    try {
      const aiImageFile = await prepareImageForAiAssist(firstImage.file);
      if (aiImageFile.size > 4 * 1024 * 1024) {
        setAiImageAssistError(
          locale === 'id'
            ? 'Foto masih terlalu besar setelah diperkecil. Coba crop lebih dekat ke barangnya.'
            : 'The photo is still too large after compression. Try cropping closer to the item.',
        );
        return;
      }

      const formData = new FormData();
      formData.set('image', aiImageFile);
      formData.set('locale', locale);
      formData.set('side', side);
      formData.set('category_title', getCategoryTitle(category, locale));
      formData.set(
        'fields',
        JSON.stringify([
          ...category.fields.map(field => ({
            key: field.key,
            label: getSideAwareFieldLabel(field, locale, side),
            placeholder: getSideAwareFieldPlaceholder(field, locale, side),
            required: Boolean(field.required),
          })),
          {
            key: 'notes',
            label: locale === 'id' ? 'Catatan tambahan' : 'Additional notes',
            placeholder:
              locale === 'id'
                ? 'Detail lain yang terlihat di foto'
                : 'Other details visible in the image',
            required: false,
          },
        ]),
      );

      const response = await authFetch('/api/ai/create-from-image', {
        method: 'POST',
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        data?: AiImageAssistResult;
        error?: string;
      };
      if (!response.ok || !payload.data) {
        throw new Error(
          cleanText(payload.error) ||
            (locale === 'id'
              ? 'AI belum bisa membaca foto ini.'
              : 'AI could not read this photo.'),
        );
      }
      setAiImageAssist(payload.data);
    } catch (err) {
      setAiImageAssist(null);
      setAiImageAssistError(
        err instanceof Error
          ? err.message
          : locale === 'id'
            ? 'Bantuan AI foto gagal.'
            : 'Image AI assist failed.',
      );
    } finally {
      setAiImageAssistLoading(false);
    }
  }

  function toggleStore(storeId: string) {
    setSelectedStoreIds(current => {
      if (current.includes(storeId)) {
        setStoreStockById(stock => {
          const next = { ...stock };
          delete next[storeId];
          return next;
        });
        setStoreAvailabilityById(status => {
          const next = { ...status };
          delete next[storeId];
          return next;
        });
        return current.filter(id => id !== storeId);
      }
      if (current.length >= MAX_LINKED_UMKM_STORES) return current;
      return [...current, storeId];
    });
  }

  const selectedStores = useMemo(
    () =>
      selectedStoreIds
        .map(id => ownedStores.find(store => store.id === id))
        .filter((store): store is OwnedUmkmStore => Boolean(store)),
    [ownedStores, selectedStoreIds],
  );

  useEffect(() => {
    setValues({});
    setSelectedClassificationSlug('');
    setLocationPoint(null);
    setImages(current => {
      current.forEach(item => {
        if (item.preview?.startsWith('blob:'))
          URL.revokeObjectURL(item.preview);
      });
      return [];
    });
    setDocuments([]);
    setError('');
    setSuccessHref('');
    setSelectedStoreIds([]);
    setStoreStockById({});
    setStoreAvailabilityById({});
    setAiImageAssist(null);
    setAiImageAssistError('');
    setAiImageAssistReview(null);
    setAiAppliedFieldKeys([]);
  }, [category?.id, side]);

  useEffect(() => {
    let cancelled = false;

    async function loadOwnedStores() {
      setStoresLoading(true);
      setStoresError('');
      try {
        const response = await authFetch(
          `/api/super-app/umkm/stores?mine=1&limit=${MAX_LINKED_UMKM_STORES}`,
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            cleanText((payload as { error?: string }).error) ||
              (locale === 'id'
                ? 'Gagal memuat usaha milik Anda.'
                : 'Failed to load your businesses.'),
          );
        }
        if (!cancelled) {
          setOwnedStores(
            extractOwnedStores(payload).slice(0, MAX_LINKED_UMKM_STORES),
          );
        }
      } catch (err) {
        if (!cancelled) {
          setOwnedStores([]);
          setStoresError(
            err instanceof Error
              ? err.message
              : locale === 'id'
                ? 'Gagal memuat usaha milik Anda.'
                : 'Failed to load your businesses.',
          );
        }
      } finally {
        if (!cancelled) setStoresLoading(false);
      }
    }

    if (category && side === 'supply') {
      loadOwnedStores();
    } else {
      setOwnedStores([]);
      setStoresError('');
      setStoresLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [authFetch, category, locale, side]);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []).filter(file =>
      file.type.startsWith('image/'),
    );
    event.target.value = '';
    if (selected.length === 0) return;

    const remaining = Math.max(0, MAX_IMAGES - images.length);
    const accepted = selected.slice(0, remaining);
    if (accepted.length < selected.length) {
      setError(
        locale === 'id'
          ? `Maksimal ${MAX_IMAGES} gambar untuk satu postingan.`
          : `Maximum ${MAX_IMAGES} images for one post.`,
      );
    } else {
      setError('');
    }

    setImages(current => [
      ...current,
      ...accepted.map(file => ({
        id: createUploadId(file),
        file,
        name: file.name,
        size: file.size,
        preview: URL.createObjectURL(file),
      })),
    ]);
    setAiImageAssist(null);
    setAiImageAssistError('');
    setAiImageAssistReview(null);
    setAiAppliedFieldKeys([]);
  }

  function handleDocumentChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    if (selected.length === 0) return;

    const remaining = Math.max(0, MAX_DOCUMENTS - documents.length);
    const accepted = selected.slice(0, remaining);
    if (accepted.length < selected.length) {
      setError(
        locale === 'id'
          ? `Maksimal ${MAX_DOCUMENTS} dokumen pendukung.`
          : `Maximum ${MAX_DOCUMENTS} supporting documents.`,
      );
    } else {
      setError('');
    }

    setDocuments(current => [
      ...current,
      ...accepted.map(file => ({
        id: createUploadId(file),
        file,
        name: file.name,
        size: file.size,
        mime: file.type,
      })),
    ]);
  }

  function removeImage(id: string) {
    setImages(current => {
      const target = current.find(item => item.id === id);
      if (target?.preview?.startsWith('blob:'))
        URL.revokeObjectURL(target.preview);
      return current.filter(item => item.id !== id);
    });
    setAiImageAssist(null);
    setAiImageAssistError('');
    setAiImageAssistReview(null);
    setAiAppliedFieldKeys([]);
  }

  function removeDocument(id: string) {
    setDocuments(current => current.filter(item => item.id !== id));
  }

  async function uploadImages(): Promise<string[]> {
    const pending = images.filter(item => item.file && !item.url);
    if (pending.length === 0) {
      return images
        .map(item => normalizeContentMediaUrl(cleanText(item.url)))
        .filter(Boolean);
    }

    setImages(current =>
      current.map(item =>
        pending.some(pendingItem => pendingItem.id === item.id)
          ? { ...item, uploading: true }
          : item,
      ),
    );

    const optimizedFiles = await prepareUploadFiles(
      pending
        .map(item => item.file)
        .filter((file): file is File => Boolean(file)),
    );
    const formData = new FormData();
    optimizedFiles.forEach(file => formData.append('images', file));

    const response = await authFetch('/api/content/upload-images', {
      method: 'POST',
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        cleanText((payload as { error?: string }).error) ||
          (locale === 'id'
            ? 'Gagal upload gambar.'
            : 'Failed to upload images.'),
      );
    }

    const uploadedUrls = extractUploadedImageUrls(payload);
    if (uploadedUrls.length < pending.length) {
      throw new Error(
        locale === 'id'
          ? 'Sebagian gambar gagal diupload.'
          : 'Some images failed to upload.',
      );
    }

    const next = images.map(item => {
      const pendingIndex = pending.findIndex(
        pendingItem => pendingItem.id === item.id,
      );
      const nextUrl = pendingIndex >= 0 ? uploadedUrls[pendingIndex] : item.url;
      return {
        ...item,
        uploading: false,
        url: nextUrl,
        preview: nextUrl || item.preview,
      };
    });
    setImages(next);
    return next
      .map(item => normalizeContentMediaUrl(cleanText(item.url)))
      .filter(Boolean);
  }

  async function uploadDocuments(): Promise<
    Array<{ name: string; url: string; size?: number; mime?: string }>
  > {
    const pending = documents.filter(item => item.file && !item.url);
    if (pending.length === 0) {
      return documents
        .map(item => ({
          name: item.name,
          url: normalizeContentMediaUrl(cleanText(item.url)),
          size: item.size,
          mime: item.mime,
        }))
        .filter(item => Boolean(item.url));
    }

    setDocuments(current =>
      current.map(item =>
        pending.some(pendingItem => pendingItem.id === item.id)
          ? { ...item, uploading: true }
          : item,
      ),
    );

    const formData = new FormData();
    pending.forEach(item => {
      if (item.file) formData.append('files', item.file);
    });

    const response = await authFetch('/api/content/upload-files', {
      method: 'POST',
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        cleanText((payload as { error?: string }).error) ||
          (locale === 'id'
            ? 'Gagal upload dokumen.'
            : 'Failed to upload documents.'),
      );
    }

    const uploadedDocs = extractUploadedDocuments(payload);
    if (uploadedDocs.length < pending.length) {
      throw new Error(
        locale === 'id'
          ? 'Sebagian dokumen gagal diupload.'
          : 'Some documents failed to upload.',
      );
    }

    const next = documents.map(item => {
      const pendingIndex = pending.findIndex(
        pendingItem => pendingItem.id === item.id,
      );
      const uploaded = pendingIndex >= 0 ? uploadedDocs[pendingIndex] : item;
      return {
        ...item,
        uploading: false,
        url: uploaded?.url || item.url,
        name: uploaded?.name || item.name,
        size: uploaded?.size || item.size,
        mime: uploaded?.mime || item.mime,
      };
    });
    setDocuments(next);
    return next
      .map(item => ({
        name: item.name,
        url: normalizeContentMediaUrl(cleanText(item.url)),
        size: item.size,
        mime: item.mime,
      }))
      .filter(item => Boolean(item.url));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!side || !category) return;

    if (classificationChoices.length > 0 && !selectedClassification) {
      setError(
        locale === 'id'
          ? 'Pilih jenis paling dekat dulu agar postingan tidak masuk kategori yang terlalu umum.'
          : 'Choose the closest type first so the post is not filed too broadly.',
      );
      return;
    }

    const missing = category.fields.filter(
      field => field.required && !values[field.key]?.trim(),
    );
    if (missing.length > 0) {
      setError(
        locale === 'id'
          ? `Lengkapi ${missing
              .map(field => getSideAwareFieldLabel(field, locale, side))
              .join(', ')}.`
          : `Complete ${missing
              .map(field => getSideAwareFieldLabel(field, locale, side))
              .join(', ')}.`,
      );
      return;
    }
    if (requiresMapPoint && !locationPoint) {
      setError(
        locale === 'id'
          ? 'Pilih titik lokasi di peta agar latitude dan longitude tersimpan.'
          : 'Pick a map location so latitude and longitude are saved.',
      );
      return;
    }

    const mainValue =
      values.equipment_name ||
      values.product_name ||
      values.service_needed ||
      values.place_type ||
      values.business_match ||
      values.opportunity_type ||
      getCategoryTitle(category, locale);
    const actionLabel =
      side === 'demand'
        ? locale === 'id'
          ? 'Butuh'
          : 'Need'
        : locale === 'id'
          ? 'Tawarkan'
          : 'Offer';
    const titleValue = `${actionLabel} ${mainValue}`.slice(0, 160);
    const summaryValue =
      values.scope ||
      values.specification ||
      values.collaboration_goal ||
      getCategoryDescription(category, locale, side);
    const priceCents = parsePriceToCents(
      values.budget || values.capital_range || '',
    );
    const contentType = resolveCreateContentType(category);
    const contentStatus = resolveContentStatus(contentType, side);
    const fixedPriceCents = side === 'supply' ? priceCents : undefined;
    const pricingMode = fixedPriceCents ? 'fixed' : 'request';

    if (
      contentStatus === 'active' &&
      requiresSupplyImageForActive(contentType, side) &&
      images.length === 0
    ) {
      setError(
        locale === 'id'
          ? 'Upload minimal 1 gambar agar penawaran produk atau tempat usaha bisa dipublikasikan.'
          : 'Upload at least 1 image so the product or place offer can be published.',
      );
      return;
    }

    const inventoryAware = isInventoryAwareCategory(category, side);
    const selectedStoreInventory = selectedStores.map(store => {
      const availability = storeAvailabilityById[store.id] || 'available';
      const stockQty =
        availability === 'out_of_stock'
          ? 0
          : parseStockQuantity(storeStockById[store.id] || '');
      return {
        store_id: store.id,
        store_name: store.name,
        city: store.city || undefined,
        address: store.address || undefined,
        latitude: typeof store.lat === 'number' ? store.lat : undefined,
        longitude: typeof store.lng === 'number' ? store.lng : undefined,
        availability_status: availability,
        stock_qty: stockQty,
      };
    });

    if (
      inventoryAware &&
      selectedStoreInventory.length > 0 &&
      selectedStoreInventory.every(
        item => item.availability_status === 'out_of_stock',
      )
    ) {
      setError(
        locale === 'id'
          ? 'Minimal satu cabang harus tersedia. Kalau semua cabang habis, ubah status ke preorder atau jangan hubungkan usaha dulu.'
          : 'At least one branch must be available. If every branch is out of stock, use preorder or leave businesses unlinked.',
      );
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessHref('');

    try {
      setUploadingMedia(true);
      const imageUrls = await uploadImages();
      const uploadedDocuments = await uploadDocuments();
      const coverImage = imageUrls[0];
      const metadata = buildCategoryMetadata({
        category,
        contentType,
        side,
        locale,
        values,
        locationPoint,
        imageUrls,
        coverImage,
        documents: uploadedDocuments,
        priceCents,
        classification: selectedClassification,
      });
      if (aiImageAssist) {
        metadata.ai_image_assist = {
          source: 'create_form_photo',
          model: aiImageAssist.model,
          provider: aiImageAssist.provider,
          readable: aiImageAssist.readable,
          confidence: aiImageAssist.confidence,
          learning_event_id: aiImageAssist.learning_event_id,
          fallback: Boolean(aiImageAssist.fallback),
          provider_errors: aiImageAssist.provider_errors || [],
          applied_field_keys: aiAppliedFieldKeys,
          user_review: aiImageAssistReview || 'not_reviewed',
          warnings: aiImageAssist.warnings,
          questions: aiImageAssist.questions,
          suggestions: aiImageAssist.fields.map(suggestion => ({
            key: suggestion.key,
            value: suggestion.value,
            confidence: suggestion.confidence,
            reason: suggestion.reason,
            applied: aiAppliedFieldKeys.includes(suggestion.key),
            final_value: values[suggestion.key] || '',
          })),
        };
      }
      if (side === 'supply' && selectedStores.length > 0) {
        metadata.linked_umkm_store_ids = selectedStoreIds;
        metadata.primary_umkm_store_id = selectedStoreIds[0];
        metadata.linked_umkm_stores = selectedStores.map(store => ({
          id: store.id,
          name: store.name,
          slug: store.slug,
          city: store.city,
          address: store.address,
          latitude: store.lat,
          longitude: store.lng,
          phone: store.phone,
          is_active: store.is_active,
          online_order_enabled: store.online_order_enabled,
          offline_order_enabled: store.offline_order_enabled,
        }));
        metadata.umkm_store_inventory = selectedStoreInventory;
        metadata.inventory_policy =
          selectedStoreInventory.length > 1
            ? 'branch_specific'
            : 'single_store';
        metadata.has_branch_specific_inventory =
          selectedStoreInventory.length > 1;
      } else if (side === 'supply') {
        metadata.inventory_policy = 'global_listing';
      }
      const response = await authFetch('/api/content/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_type: contentType,
          title: titleValue,
          summary: summaryValue,
          body:
            values.notes ||
            (side === 'demand'
              ? `${titleValue}. ${summaryValue}. ${values.location ? `Area kebutuhan: ${values.location}.` : ''}`
              : `${titleValue}. ${summaryValue}. ${values.location ? `Area: ${values.location}.` : ''}`),
          pricing_mode: pricingMode,
          price_cents: fixedPriceCents,
          price_unit: resolvePriceUnit(contentType, side, fixedPriceCents),
          content_status: contentStatus,
          category: contentType,
          cover_image: coverImage,
          image_urls: imageUrls,
          gallery_images: imageUrls,
          tags: [
            category.slugId,
            selectedClassification?.subcategorySlug,
            selectedClassification
              ? getClassificationTypeLabel(selectedClassification, 'id')
              : '',
            side === 'demand' ? 'butuh' : 'jual',
            getCategoryTitle(category, 'id'),
          ].filter(Boolean),
          metadata,
        }),
      });
      const payload = (await response
        .json()
        .catch(() => ({}))) as SubmitResponse;
      if (!response.ok) {
        throw new Error(
          payload.issues?.join(', ') ||
            payload.error ||
            (locale === 'id'
              ? 'Gagal membuat postingan.'
              : 'Failed to create post.'),
        );
      }
      if (payload.id) {
        setSuccessHref(
          buildContentHref(
            payload.id,
            payload.title || titleValue,
            payload.slug,
          ),
        );
      } else {
        setSuccessHref('/my-listings');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : locale === 'id'
            ? 'Gagal membuat postingan.'
            : 'Failed to create post.',
      );
    } finally {
      setUploadingMedia(false);
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-transparent px-3 py-3 sm:px-5 sm:py-5 lg:px-8">
      <div className="mx-auto w-full max-w-[1440px]">
        <section className="sticky top-[calc(env(safe-area-inset-top)+0.5rem)] z-30 rounded-[28px] border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur sm:p-6 lg:static lg:bg-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <Link
                href="/create"
                className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700"
              >
                Lajukan Create
              </Link>
              <h1 className="mt-2 text-2xl font-bold tracking-[-0.05em] text-slate-950 sm:text-4xl">
                {title}
              </h1>
              <p className="mt-2 hidden max-w-2xl text-sm leading-6 text-slate-500 sm:block">
                {isDemandFlow
                  ? locale === 'id'
                    ? 'Tulis kebutuhan sebagai brief ringkas. Gambar, dokumen, dan titik peta bisa ditambahkan kalau memang membantu.'
                    : 'Write the need as a short brief. Images, documents, and map pins can be added when they help.'
                  : locale === 'id'
                    ? 'Alur dibuat sederhana: pilih tujuan, pilih kategori, isi data penting, lalu postingan langsung dipublikasikan.'
                    : 'Simple flow: choose purpose, choose category, fill key data, then publish the post.'}
              </p>
            </div>
            <StepHeader locale={locale} side={side} category={category} />
          </div>
        </section>

        {!side ? (
          <CreateStepPanel
            eyebrow={locale === 'id' ? 'Langkah 1 dari 3' : 'Step 1 of 3'}
            title={
              locale === 'id'
                ? 'Pilih tujuan postingan'
                : 'Choose posting purpose'
            }
            description={
              locale === 'id'
                ? 'Mulai dari arah yang benar dulu. Setelah itu kategori, contoh, dan field akan menyesuaikan.'
                : 'Start from the right direction. Category, examples, and fields will adapt after this.'
            }
          >
            <div className="grid gap-3 lg:grid-cols-2">
              <PurposeCard side="supply" locale={locale} />
              <PurposeCard side="demand" locale={locale} />
            </div>
          </CreateStepPanel>
        ) : !category ? (
          <CreateStepPanel
            eyebrow={locale === 'id' ? 'Langkah 2 dari 3' : 'Step 2 of 3'}
            title={
              locale === 'id'
                ? 'Pilih kategori paling dekat'
                : 'Choose the closest category'
            }
            description={
              locale === 'id'
                ? 'Setiap kategori punya isian berbeda: ukuran, berat, lokasi, budget, dokumen, dan kebutuhan teknis akan menyesuaikan.'
                : 'Each category has different fields: size, weight, location, budget, documents, and technical needs adapt automatically.'
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CREATE_BUSINESS_CATEGORIES.map(item => (
                <CategoryCard
                  key={item.id}
                  category={item}
                  side={side}
                  locale={locale}
                />
              ))}
            </div>
          </CreateStepPanel>
        ) : (
          <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <form
              onSubmit={handleSubmit}
              className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
            >
              <div className={STEP_PANEL_HEADER_CLASS}>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
                  {side === 'demand'
                    ? locale === 'id'
                      ? 'Langkah 3 dari 3'
                      : 'Step 3 of 3'
                    : locale === 'id'
                      ? 'Langkah 3 dari 3'
                      : 'Step 3 of 3'}
                </p>
                <h2 className="mt-1 text-lg font-bold tracking-[-0.03em] text-slate-950 sm:text-xl">
                  {side === 'demand'
                    ? locale === 'id'
                      ? `Lengkapi kebutuhan: ${getCategoryTitle(category, locale)}`
                      : `Complete request: ${getCategoryTitle(category, locale)}`
                    : locale === 'id'
                      ? `Lengkapi penawaran: ${getCategoryTitle(category, locale)}`
                      : `Complete offer: ${getCategoryTitle(category, locale)}`}
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                  {isDemandFlow
                    ? locale === 'id'
                      ? 'Isi kebutuhan inti dulu. Area teks cukup; lampiran dan titik peta bersifat opsional.'
                      : 'Fill the core need first. A text area is enough; attachments and map pins are optional.'
                    : locale === 'id'
                      ? 'Isi yang wajib dulu. Detail lain bisa ditambah setelah postingan dasar siap.'
                      : 'Fill the required fields first. Extra details can be added after the basic post is ready.'}
                </p>
              </div>

              <div className={STEP_PANEL_BODY_CLASS}>
                <ClassificationPicker
                  category={category}
                  side={side}
                  locale={locale}
                  selectedSlug={selectedClassificationSlug}
                  onSelect={setSelectedClassificationSlug}
                />

                <section className="mb-4 rounded-[24px] border border-emerald-100 bg-slate-50 p-3 sm:p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-950">
                        <Sparkles className="h-4 w-4 text-emerald-600" />
                        {isDemandFlow
                          ? locale === 'id'
                            ? 'Lampiran referensi opsional'
                            : 'Optional reference attachments'
                          : locale === 'id'
                            ? 'Mulai dari foto dulu'
                            : 'Start with a photo'}
                      </h2>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        {isDemandFlow
                          ? IMAGE_AI_ASSIST_ENABLED
                            ? locale === 'id'
                              ? 'Kalau punya foto contoh, catatan, brosur, atau screenshot, upload sebagai konteks. Kalau tidak ada, brief teks tetap cukup.'
                              : 'Upload a sample photo, note, brochure, or screenshot for context if you have one. A text brief is enough without it.'
                            : locale === 'id'
                              ? 'Kalau punya foto contoh, catatan, brosur, atau screenshot, upload sebagai konteks. Kalau tidak ada, brief teks tetap cukup.'
                              : 'Upload a sample photo, note, brochure, or screenshot for context if you have one. A text brief is enough without it.'
                          : IMAGE_AI_ASSIST_ENABLED
                            ? locale === 'id'
                              ? 'Upload foto produk, alat, brosur, lokasi, atau catatan. AI akan bantu isi kalau datanya kebaca jelas.'
                              : 'Upload a product, tool, brochure, place, or note photo. AI will help fill fields only when the data is clear.'
                            : locale === 'id'
                              ? 'Upload foto produk, alat, brosur, lokasi, atau catatan. Untuk sekarang foto dipakai sebagai bukti dan preview, bukan dibaca AI otomatis.'
                              : 'Upload a product, tool, brochure, place, or note photo. For now photos are used as proof and previews, not read by AI automatically.'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-3 text-xs font-bold text-emerald-700">
                        <UploadCloud className="h-4 w-4" />
                        {images.length > 0
                          ? locale === 'id'
                            ? 'Tambah foto'
                            : 'Add photo'
                          : isDemandFlow
                            ? locale === 'id'
                              ? 'Tambah referensi'
                              : 'Add reference'
                            : locale === 'id'
                              ? 'Upload foto'
                              : 'Upload photo'}
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="sr-only"
                          onChange={handleImageChange}
                          disabled={submitting}
                        />
                      </label>
                      {IMAGE_AI_ASSIST_ENABLED ? (
                        <button
                          type="button"
                          onClick={() => void requestAiImageAssist()}
                          disabled={
                            aiImageAssistLoading ||
                            images.length === 0 ||
                            submitting
                          }
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {aiImageAssistLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                          {locale === 'id' ? 'Bantu isi' : 'Assist'}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {images.length > 0 ? (
                    <div className="mt-3 flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
                      {images.slice(0, 5).map(item => (
                        <div
                          key={item.id}
                          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white"
                        >
                          <NextImage
                            src={item.preview}
                            alt={item.name}
                            fill
                            unoptimized
                            sizes="56px"
                            className="object-cover"
                          />
                        </div>
                      ))}
                      {IMAGE_AI_ASSIST_ENABLED && aiImageAssist ? (
                        <div
                          className={cn(
                            'min-w-[180px] rounded-xl border bg-white px-3 py-2',
                            aiImageAssist.readable &&
                              aiImageAssist.fields.length > 0
                              ? 'border-emerald-100'
                              : 'border-amber-200',
                          )}
                        >
                          <p
                            className={cn(
                              'text-[11px] font-bold',
                              aiImageAssist.readable &&
                                aiImageAssist.fields.length > 0
                                ? 'text-emerald-700'
                                : 'text-amber-700',
                            )}
                          >
                            {aiImageAssist.readable &&
                            aiImageAssist.fields.length > 0
                              ? locale === 'id'
                                ? `${aiImageAssist.fields.length} saran siap`
                                : `${aiImageAssist.fields.length} suggestions ready`
                              : locale === 'id'
                                ? 'Foto perlu dicek'
                                : 'Photo needs review'}
                          </p>
                          {aiImageAssist.fields.length > 0 ? (
                            <button
                              type="button"
                              onClick={applyAiSuggestionsToEmptyFields}
                              className="mt-1 text-[11px] font-bold text-slate-700 underline"
                            >
                              {locale === 'id'
                                ? 'Pakai untuk field kosong'
                                : 'Fill empty fields'}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {IMAGE_AI_ASSIST_ENABLED && aiImageAssistError ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
                      {aiImageAssistError}
                    </div>
                  ) : null}
                </section>

                <div className="grid gap-3 sm:grid-cols-2">
                  {visibleCategoryFields.map(field => {
                    const inputClass =
                      'mt-1 min-h-[46px] w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100';
                    return (
                      <label
                        key={field.key}
                        className={cn(field.multiline ? 'sm:col-span-2' : '')}
                      >
                        <span className="text-xs font-bold text-slate-700">
                          {getSideAwareFieldLabel(field, locale, side)}
                          {field.required ? (
                            <span className="text-rose-500"> *</span>
                          ) : null}
                        </span>
                        {field.multiline ? (
                          <textarea
                            value={values[field.key] || ''}
                            onChange={event =>
                              updateValue(field.key, event.target.value)
                            }
                            placeholder={getSideAwareFieldPlaceholder(
                              field,
                              locale,
                              side,
                            )}
                            className={`${inputClass} min-h-[108px] py-3`}
                          />
                        ) : (
                          <input
                            type={field.type || 'text'}
                            value={values[field.key] || ''}
                            onChange={event =>
                              updateValue(field.key, event.target.value)
                            }
                            placeholder={getSideAwareFieldPlaceholder(
                              field,
                              locale,
                              side,
                            )}
                            className={inputClass}
                          />
                        )}
                      </label>
                    );
                  })}
                  <div className="sm:col-span-2 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-950">
                          {locale === 'id'
                            ? 'Cukup isi yang wajib dulu'
                            : 'Fill only required fields first'}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          {showOptionalDetails
                            ? locale === 'id'
                              ? 'Detail tambahan sedang dibuka. Kosongkan yang belum siap.'
                              : 'Optional details are open. Leave anything unfinished blank.'
                            : locale === 'id'
                              ? `${hiddenOptionalFieldCount + 4} detail tambahan disimpan di bawah, tapi tidak wajib untuk mulai.`
                              : `${hiddenOptionalFieldCount + 4} extra details are tucked below, but not required to start.`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowOptionalDetails(value => !value)}
                        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-3 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200"
                      >
                        {showOptionalDetails
                          ? locale === 'id'
                            ? 'Sembunyikan detail'
                            : 'Hide details'
                          : locale === 'id'
                            ? 'Tambah detail'
                            : 'Add details'}
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 transition',
                            showOptionalDetails && 'rotate-180',
                          )}
                        />
                      </button>
                    </div>
                  </div>
                  {showOptionalDetails ? (
                    <label className="sm:col-span-2">
                      <span className="text-xs font-bold text-slate-700">
                        {locale === 'id'
                          ? 'Catatan tambahan'
                          : 'Additional notes'}
                      </span>
                      <textarea
                        value={values.notes || ''}
                        onChange={event =>
                          updateValue('notes', event.target.value)
                        }
                        placeholder={
                          locale === 'id'
                            ? 'Tambahkan syarat, preferensi, atau detail lain.'
                            : 'Add requirements, preferences, or other details.'
                        }
                        className="mt-1 min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      />
                    </label>
                  ) : null}
                </div>

                {showOptionalDetails ? (
                  <>
                    {shouldShowBusinessLinking ? (
                      <section className="mt-4 rounded-[24px] border border-emerald-100 bg-emerald-50/60 p-3 sm:p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h2 className="text-sm font-bold text-slate-950">
                              {locale === 'id'
                                ? 'Hubungkan ke usaha / cabang'
                                : 'Link to business / branch'}
                            </h2>
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                              {locale === 'id'
                                ? 'Opsional. Pilih satu atau beberapa usaha dari halaman UMKM agar postingan punya relasi cabang dan stok per lokasi.'
                                : 'Optional. Choose one or more UMKM businesses so the post keeps branch and location-specific stock data.'}
                            </p>
                          </div>
                          <Link
                            href="/umkm"
                            className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-white px-3 text-xs font-bold text-emerald-700"
                          >
                            {locale === 'id' ? 'Kelola UMKM' : 'Manage UMKM'}
                          </Link>
                        </div>

                        {storesLoading ? (
                          <div className="mt-3 flex min-h-[86px] items-center justify-center rounded-2xl border border-emerald-100 bg-white text-sm font-semibold text-slate-500">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-600" />
                            {locale === 'id'
                              ? 'Memuat usaha Anda...'
                              : 'Loading your businesses...'}
                          </div>
                        ) : storesError ? (
                          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                            {storesError}
                          </div>
                        ) : ownedStores.length > 0 ? (
                          <div className="mt-3 grid gap-2">
                            {ownedStores.map(store => {
                              const selected = selectedStoreIds.includes(
                                store.id,
                              );
                              const availability =
                                storeAvailabilityById[store.id] || 'available';
                              return (
                                <div
                                  key={store.id}
                                  className={cn(
                                    'rounded-2xl border bg-white p-3 transition',
                                    selected
                                      ? 'border-emerald-300 ring-2 ring-emerald-100'
                                      : 'border-slate-200',
                                  )}
                                >
                                  <label className="flex cursor-pointer items-start gap-3">
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      onChange={() => toggleStore(store.id)}
                                      className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span className="min-w-0 flex-1">
                                      <span className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-bold text-slate-950">
                                          {store.name}
                                        </span>
                                        {store.is_active === false ? (
                                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">
                                            {locale === 'id'
                                              ? 'Nonaktif'
                                              : 'Inactive'}
                                          </span>
                                        ) : null}
                                      </span>
                                      <span className="mt-0.5 block truncate text-xs font-medium text-slate-500">
                                        {[store.city, store.address]
                                          .filter(Boolean)
                                          .join(' - ') ||
                                          (locale === 'id'
                                            ? 'Alamat belum lengkap'
                                            : 'Address incomplete')}
                                      </span>
                                    </span>
                                  </label>

                                  {selected &&
                                  isInventoryAwareCategory(category, side) ? (
                                    <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
                                      <label>
                                        <span className="text-[11px] font-bold text-slate-600">
                                          {locale === 'id'
                                            ? 'Stok di cabang ini'
                                            : 'Stock in this branch'}
                                        </span>
                                        <input
                                          type="number"
                                          min={0}
                                          inputMode="numeric"
                                          value={storeStockById[store.id] || ''}
                                          onChange={event =>
                                            setStoreStockById(current => ({
                                              ...current,
                                              [store.id]: event.target.value,
                                            }))
                                          }
                                          placeholder={
                                            locale === 'id'
                                              ? 'Contoh: 25'
                                              : 'Example: 25'
                                          }
                                          disabled={
                                            availability === 'out_of_stock'
                                          }
                                          className="mt-1 min-h-[42px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:opacity-60"
                                        />
                                      </label>
                                      <label>
                                        <span className="text-[11px] font-bold text-slate-600">
                                          {locale === 'id'
                                            ? 'Status'
                                            : 'Status'}
                                        </span>
                                        <select
                                          value={availability}
                                          onChange={event =>
                                            setStoreAvailabilityById(
                                              current => ({
                                                ...current,
                                                [store.id]: event.target
                                                  .value as StoreAvailabilityStatus,
                                              }),
                                            )
                                          }
                                          className="mt-1 min-h-[42px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                                        >
                                          <option value="available">
                                            {locale === 'id'
                                              ? 'Tersedia'
                                              : 'Available'}
                                          </option>
                                          <option value="limited">
                                            {locale === 'id'
                                              ? 'Terbatas'
                                              : 'Limited'}
                                          </option>
                                          <option value="preorder">
                                            {locale === 'id'
                                              ? 'Preorder'
                                              : 'Preorder'}
                                          </option>
                                          <option value="out_of_stock">
                                            {locale === 'id'
                                              ? 'Habis'
                                              : 'Out of stock'}
                                          </option>
                                        </select>
                                      </label>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="mt-3 rounded-2xl border border-dashed border-emerald-200 bg-white px-4 py-4 text-sm text-slate-600">
                            {locale === 'id'
                              ? 'Belum ada usaha yang bisa dihubungkan. Postingan tetap bisa dipublikasikan, atau buat usaha dulu dari halaman UMKM.'
                              : 'No business is available to link yet. You can still publish the post, or create a business from UMKM first.'}
                          </div>
                        )}
                      </section>
                    ) : null}

                    <section className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50 p-3 sm:p-4">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h2 className="text-sm font-bold text-slate-950">
                            {isDemandFlow
                              ? locale === 'id'
                                ? 'Area dan titik opsional'
                                : 'Area and optional pin'
                              : locale === 'id'
                                ? 'Titik lokasi'
                                : 'Location pin'}
                          </h2>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {isDemandFlow
                              ? locale === 'id'
                                ? 'Untuk kebutuhan, kota/area sudah cukup. Tambahkan pin hanya kalau radius atau lokasi benar-benar penting.'
                                : 'For needs, a city or area is enough. Add a pin only when radius or exact location matters.'
                              : locale === 'id'
                                ? 'Cari alamat, tap peta, atau geser marker. Lat/long ikut disimpan di postingan.'
                                : 'Search an address, tap the map, or drag the marker. Lat/lng is saved to the post.'}
                          </p>
                        </div>
                        {locationPoint ? (
                          <span className="inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
                            {locationPoint.lat.toFixed(5)},{' '}
                            {locationPoint.lng.toFixed(5)}
                          </span>
                        ) : isDemandFlow ? (
                          <span className="inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                            {locale === 'id' ? 'Opsional' : 'Optional'}
                          </span>
                        ) : null}
                      </div>
                      <UmkmLocationPicker
                        value={locationPoint}
                        onChange={setLocationPoint}
                        isId={locale === 'id'}
                        markerLabel={
                          isDemandFlow
                            ? locale === 'id'
                              ? 'Titik kebutuhan opsional'
                              : 'Optional need point'
                            : locale === 'id'
                              ? 'Titik penawaran'
                              : 'Offer location'
                        }
                        className="mt-3 rounded-[20px]"
                      />
                    </section>

                    <section className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h2 className="text-sm font-bold text-slate-950">
                              {isDemandFlow
                                ? locale === 'id'
                                  ? 'Referensi gambar'
                                  : 'Image references'
                                : locale === 'id'
                                  ? 'Gambar'
                                  : 'Images'}
                            </h2>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {isDemandFlow
                                ? locale === 'id'
                                  ? 'Opsional. Pakai untuk contoh barang, gaya hasil, lokasi, atau masalah yang ingin diselesaikan.'
                                  : 'Optional. Use this for sample goods, expected style, location, or the problem to solve.'
                                : locale === 'id'
                                  ? 'Foto produk, lokasi, contoh hasil, kondisi alat, atau referensi.'
                                  : 'Product, place, sample output, tool condition, or reference photos.'}
                            </p>
                          </div>
                          <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700">
                            <UploadCloud className="h-4 w-4" />
                            {locale === 'id' ? 'Upload' : 'Upload'}
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="sr-only"
                              onChange={handleImageChange}
                              disabled={submitting}
                            />
                          </label>
                        </div>

                        {images.length > 0 ? (
                          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {images.map(item => (
                              <div
                                key={item.id}
                                className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                              >
                                <NextImage
                                  src={item.preview}
                                  alt={item.name}
                                  fill
                                  unoptimized
                                  sizes="(min-width: 640px) 160px, 45vw"
                                  className="h-full w-full object-cover"
                                />
                                {item.uploading ? (
                                  <div className="absolute inset-0 grid place-items-center bg-slate-950/45 text-white">
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                  </div>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => removeImage(item.id)}
                                  className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/95 text-slate-700 shadow-sm"
                                  aria-label={
                                    locale === 'id'
                                      ? 'Hapus gambar'
                                      : 'Remove image'
                                  }
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-4 flex min-h-[132px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500">
                            <ImageIcon className="mb-2 h-6 w-6 text-slate-300" />
                            {locale === 'id'
                              ? isDemandFlow
                                ? 'Tidak ada gambar tidak masalah. Brief teks tetap bisa dipublikasikan.'
                                : 'Belum ada gambar. Postingan tetap bisa dibuat, tapi gambar membantu calon partner paham konteks.'
                              : isDemandFlow
                                ? 'No image is fine. A text brief can still be published.'
                                : 'No images yet. The post can still be created, but images help partners understand the context.'}
                          </div>
                        )}

                        {IMAGE_AI_ASSIST_ENABLED ? (
                          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-950">
                                  <Sparkles className="h-4 w-4 text-emerald-600" />
                                  {locale === 'id'
                                    ? 'AI bantu isi dari foto'
                                    : 'AI fill from photo'}
                                </h3>
                                <p className="mt-1 text-xs leading-5 text-slate-600">
                                  {locale === 'id'
                                    ? 'AI hanya memberi saran dari foto yang jelas. Data tetap perlu kamu cek sebelum publish.'
                                    : 'AI only suggests from clear photos. You still review the data before publishing.'}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => void requestAiImageAssist()}
                                disabled={
                                  aiImageAssistLoading ||
                                  images.length === 0 ||
                                  submitting
                                }
                                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-3 text-xs font-bold text-white shadow-[0_14px_24px_-18px_rgba(22,163,74,0.55)] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {aiImageAssistLoading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Sparkles className="h-4 w-4" />
                                )}
                                {aiImageAssistLoading
                                  ? locale === 'id'
                                    ? 'Membaca...'
                                    : 'Reading...'
                                  : locale === 'id'
                                    ? 'Bantu isi'
                                    : 'Assist'}
                              </button>
                            </div>

                            {aiImageAssistError ? (
                              <div className="mt-3 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
                                {aiImageAssistError}
                              </div>
                            ) : null}

                            {aiImageAssist ? (
                              <div className="mt-3 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-white px-3 py-2">
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-900">
                                      {aiImageAssist.readable
                                        ? locale === 'id'
                                          ? 'Foto terbaca'
                                          : 'Photo readable'
                                        : locale === 'id'
                                          ? 'Foto kurang jelas'
                                          : 'Photo unclear'}
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-slate-500">
                                      {locale === 'id'
                                        ? 'Keyakinan AI'
                                        : 'AI confidence'}{' '}
                                      {Math.round(
                                        aiImageAssist.confidence * 100,
                                      )}
                                      %
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={applyAiSuggestionsToEmptyFields}
                                    disabled={aiImageAssist.fields.length === 0}
                                    className="inline-flex min-h-8 items-center rounded-full bg-emerald-50 px-3 text-[11px] font-bold text-emerald-700 disabled:opacity-50"
                                  >
                                    {locale === 'id'
                                      ? 'Pakai semua field kosong'
                                      : 'Fill empty fields'}
                                  </button>
                                </div>

                                {aiImageAssist.fields.length > 0 ? (
                                  <div className="grid gap-2">
                                    {aiImageAssist.fields.map(suggestion => {
                                      const applied =
                                        values[suggestion.key] ===
                                          suggestion.value ||
                                        aiAppliedFieldKeys.includes(
                                          suggestion.key,
                                        );
                                      return (
                                        <div
                                          key={`${suggestion.key}-${suggestion.value}`}
                                          className="rounded-xl border border-slate-200 bg-white p-3"
                                        >
                                          <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div className="min-w-0">
                                              <p className="text-xs font-bold text-slate-900">
                                                {getFieldName(suggestion.key)}
                                              </p>
                                              <p className="mt-1 text-sm font-semibold leading-5 text-slate-700">
                                                {suggestion.value}
                                              </p>
                                              {suggestion.reason ? (
                                                <p className="mt-1 text-[11px] leading-4 text-slate-500">
                                                  {suggestion.reason}
                                                </p>
                                              ) : null}
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                applyAiSuggestion(suggestion)
                                              }
                                              className={cn(
                                                'inline-flex min-h-8 shrink-0 items-center rounded-full px-3 text-[11px] font-bold',
                                                applied
                                                  ? 'bg-emerald-100 text-emerald-700'
                                                  : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700',
                                              )}
                                            >
                                              {applied
                                                ? locale === 'id'
                                                  ? 'Dipakai'
                                                  : 'Applied'
                                                : locale === 'id'
                                                  ? 'Pakai'
                                                  : 'Use'}
                                            </button>
                                          </div>
                                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                                            <span
                                              className="block h-full rounded-full bg-emerald-500"
                                              style={{
                                                width: `${Math.round(suggestion.confidence * 100)}%`,
                                              }}
                                            />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="rounded-xl border border-dashed border-amber-200 bg-white px-3 py-3 text-xs font-semibold leading-5 text-amber-800">
                                    {locale === 'id'
                                      ? 'AI belum menemukan data yang cukup aman untuk diisi. Coba foto lebih terang, dekat, dan tidak blur.'
                                      : 'AI did not find enough safe data to fill. Try a brighter, closer, non-blurry photo.'}
                                  </div>
                                )}

                                {aiImageAssist.notes ? (
                                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600">
                                    <span className="font-bold text-slate-800">
                                      {locale === 'id'
                                        ? 'Catatan AI: '
                                        : 'AI note: '}
                                    </span>
                                    {aiImageAssist.notes}
                                  </div>
                                ) : null}

                                {[
                                  ...aiImageAssist.warnings,
                                  ...aiImageAssist.questions,
                                ].length > 0 ? (
                                  <div className="grid gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-4 text-amber-800">
                                    {[
                                      ...aiImageAssist.warnings,
                                      ...aiImageAssist.questions,
                                    ]
                                      .slice(0, 5)
                                      .map(item => (
                                        <p key={item}>- {item}</p>
                                      ))}
                                  </div>
                                ) : null}

                                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                                  <span className="text-[11px] font-semibold text-slate-500">
                                    {locale === 'id'
                                      ? 'Menurut kamu saran AI ini?'
                                      : 'How was this AI suggestion?'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void sendAiImageAssistReview('accurate')
                                    }
                                    className={cn(
                                      'inline-flex min-h-8 items-center rounded-full px-3 text-[11px] font-bold',
                                      aiImageAssistReview === 'accurate'
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-emerald-50 text-emerald-700',
                                    )}
                                  >
                                    {locale === 'id' ? 'Benar' : 'Accurate'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void sendAiImageAssistReview('needs_fix')
                                    }
                                    className={cn(
                                      'inline-flex min-h-8 items-center rounded-full px-3 text-[11px] font-bold',
                                      aiImageAssistReview === 'needs_fix'
                                        ? 'bg-amber-600 text-white'
                                        : 'bg-amber-50 text-amber-700',
                                    )}
                                  >
                                    {locale === 'id'
                                      ? 'Perlu diperbaiki'
                                      : 'Needs fixing'}
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h2 className="text-sm font-bold text-slate-950">
                              {isDemandFlow
                                ? locale === 'id'
                                  ? 'Brief / dokumen opsional'
                                  : 'Optional brief / documents'
                                : locale === 'id'
                                  ? 'Dokumen pendukung'
                                  : 'Supporting documents'}
                            </h2>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {isDemandFlow
                                ? locale === 'id'
                                  ? 'Tambahkan spek, brief, contoh PO, atau file referensi hanya jika sudah ada.'
                                  : 'Add specs, briefs, sample purchase orders, or reference files only if available.'
                                : locale === 'id'
                                  ? 'Spesifikasi, contoh kontrak, menu, katalog, denah, izin, atau brief.'
                                  : 'Specs, sample contract, menu, catalog, floor plan, permits, or brief.'}
                            </p>
                          </div>
                          <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700">
                            <UploadCloud className="h-4 w-4" />
                            {locale === 'id' ? 'Tambah' : 'Add'}
                            <input
                              type="file"
                              multiple
                              className="sr-only"
                              onChange={handleDocumentChange}
                              disabled={submitting}
                            />
                          </label>
                        </div>

                        {documents.length > 0 ? (
                          <div className="mt-4 space-y-2">
                            {documents.map(item => (
                              <div
                                key={item.id}
                                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3"
                              >
                                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-emerald-700">
                                  {item.uploading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <FileText className="h-4 w-4" />
                                  )}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-bold text-slate-800">
                                    {item.name}
                                  </span>
                                  <span className="block text-xs text-slate-500">
                                    {formatBytes(item.size)}
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeDocument(item.id)}
                                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-slate-500"
                                  aria-label={
                                    locale === 'id'
                                      ? 'Hapus dokumen'
                                      : 'Remove document'
                                  }
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-4 flex min-h-[132px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500">
                            <FileText className="mb-2 h-6 w-6 text-slate-300" />
                            {locale === 'id'
                              ? isDemandFlow
                                ? 'Belum ada dokumen. Tidak wajib untuk posting kebutuhan awal.'
                                : 'Belum ada dokumen. Tambahkan kalau kategori ini butuh brief, spek, atau legalitas.'
                              : isDemandFlow
                                ? 'No documents yet. They are not required for an initial need post.'
                                : 'No documents yet. Add them when this category needs a brief, spec, or permits.'}
                          </div>
                        )}
                      </div>
                    </section>
                  </>
                ) : null}

                {error ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    {error}
                  </div>
                ) : null}
                {successHref ? (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p>
                          {isDemandFlow
                            ? locale === 'id'
                              ? 'Kebutuhan berhasil dipublikasikan.'
                              : 'Need published successfully.'
                            : locale === 'id'
                              ? 'Postingan berhasil dipublikasikan.'
                              : 'Post published successfully.'}
                        </p>
                        <Link
                          href={successHref}
                          className="mt-1 inline-flex text-emerald-700 underline"
                        >
                          {locale === 'id' ? 'Buka postingan' : 'Open post'}
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="sticky bottom-3 z-20 mt-5 flex flex-col-reverse gap-2 rounded-[24px] border border-slate-200 bg-white/95 p-2 shadow-[0_18px_38px_-28px_rgba(15,23,42,0.28)]  sm:static sm:flex-row sm:items-center sm:justify-between sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
                  <Link
                    href={
                      side === 'demand'
                        ? locale === 'en'
                          ? '/create/need'
                          : '/create/butuh'
                        : locale === 'en'
                          ? '/create/sell'
                          : '/create/jual'
                    }
                    className="inline-flex min-h-[46px] items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-700"
                  >
                    {locale === 'id' ? 'Ganti kategori' : 'Change category'}
                  </Link>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-[0_16px_28px_-20px_rgba(22,163,74,0.55)] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {uploadingMedia
                      ? locale === 'id'
                        ? 'Upload lampiran...'
                        : 'Uploading media...'
                      : isDemandFlow
                        ? locale === 'id'
                          ? 'Publikasikan kebutuhan'
                          : 'Publish need'
                        : locale === 'id'
                          ? 'Publikasikan penawaran'
                          : 'Publish offer'}
                  </button>
                </div>
              </div>
            </form>

            <aside className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:sticky lg:top-5 lg:self-start">
              <div
                className={cn(
                  'relative inline-flex h-16 w-16 items-center justify-center rounded-2xl border shadow-sm',
                  getCreateBusinessCategoryImage(category.id)
                    .containerClassName,
                )}
              >
                {(() => {
                  const visual = getCreateBusinessCategoryImage(category.id);
                  return (
                    <span
                      className="absolute aspect-square"
                      style={{
                        width: visual.imageSize,
                        right: visual.offsetX,
                        bottom: visual.offsetY,
                        transform: `scaleX(${visual.flip ? -1 : 1}) scale(${visual.scale}) rotate(${visual.rotate}deg)`,
                      }}
                    >
                      <NextImage
                        src={visual.src}
                        alt={getCategoryTitle(category, locale)}
                        width={visual.imageSize}
                        height={visual.imageSize}
                        className="pointer-events-none h-full w-full select-none object-contain"
                        draggable={false}
                      />
                    </span>
                  );
                })()}
              </div>
              <h2 className="mt-4 text-lg font-bold text-slate-950">
                {getCategoryTitle(category, locale)}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {getCategoryDescription(category, locale, side)}
              </p>
              <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                {locale === 'id' ? category.exampleId : category.exampleEn}
              </div>
              {selectedClassification ? (
                <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-900">
                  <p className="font-bold">
                    {locale === 'id' ? 'Path kategori' : 'Category path'}
                  </p>
                  <p className="mt-1">
                    {getClassificationPath(
                      category,
                      selectedClassification,
                      locale,
                    )}
                  </p>
                </div>
              ) : null}
              <Link
                href={category.searchHref}
                className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-700"
              >
                {locale === 'id'
                  ? 'Lihat contoh hasil search'
                  : 'See search examples'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </aside>
          </section>
        )}
      </div>
    </main>
  );
}
