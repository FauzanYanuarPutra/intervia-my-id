'use client';

import Image from 'next/image';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  FileText,
  Images,
  Loader2,
  MapPin,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

import { NeedSearchCard } from '@/components/search/result-cards/NeedSearchCard';
import { ProductSearchCard } from '@/components/search/result-cards/ProductSearchCard';
import { ServiceSearchCard } from '@/components/search/result-cards/ServiceSearchCard';
import { LocationAutocomplete } from '@/components/location/LocationAutocomplete';
import {
  UmkmLocationPicker,
  type LocationPickerSuggestion,
} from '@/components/super-app/UmkmLocationPicker';

import { useAuth } from '@/context/AuthContext';

import type { LatLng } from '@/lib/super-app/maps';
import type { SelectedLocation } from '@/lib/location/location.types';

import {
  buildBusinessLocationSuggestion,
  isSelectedLocation,
} from '@/lib/location/location.utils';

import {
  CREATE_BUSINESS_CATEGORIES,
  getCreateBusinessCategoryById,
  getCreateBusinessCategoryImage,
  type CreateBusinessCategory,
  type CreateBusinessCategoryId,
} from './createBusinessData';

import {
  makeUploadDraftId,
  type ContentItem,
  type CreateFlowIntent,
} from './createPageUtils';

import {
  buildListingFieldSchema,
  CREATE_STEPS,
  fieldsForStep,
  type CreateIntent,
  type ListingFieldSchema,
} from '@/lib/create/createListingSchema';

import {
  clearTemporaryCreateDraft,
  createEmptyTemporaryDraft,
  hasTemporaryCreateDraftProgress,
  readTemporaryCreateDraft,
  writeTemporaryCreateDraft,
  type DraftMedia,
  type TemporaryCreateDraft,
} from '@/lib/create/createDraftStorage';

import {
  FALLBACK_CREATE_INDUSTRIES,
  FALLBACK_CREATE_SUBCATEGORIES,
  mergeCreateTaxonomyItems,
  type CreateTaxonomyItem,
} from '@/lib/create/createTaxonomyFallbacks';

import type { GlobalSearchItem } from '@/lib/search/globalSearch';
import { normalizeContentMediaUrl } from '@/lib/content/catalog';
import { activeListingNeedsPrimaryImage } from '@/lib/content/listingFlowRules';
import { trackLajukanEvent } from '@/lib/analytics/lajukanEvents';

import { mapCreationDraftToListingPrefill } from '@/lib/creation-drafts/adapters';
import type { AICreationDraft } from '@/lib/creation-drafts/types';

import { cn } from '@/lib/utils';

type CreateListingWizardProps = {
  entryMode?: CreateFlowIntent;
  categoryId?: CreateBusinessCategoryId;
};

type TaxonomyItem = CreateTaxonomyItem;

type SaveStatus =
  | 'idle'
  | 'dirty'
  | 'saving'
  | 'saved'
  | 'offline'
  | 'error';

type ServerDraft = {
  id: string;
  draft_version?: number;
  current_step?: number;
};

type ListingDraftPayload = ServerDraft & {
  listing_intent?: string | null;
  category_slug?: string | null;
  subcategory_slug?: string | null;
  industry_ids?: string[] | null;
  values?: Record<string, unknown> | null;
  media?: DraftMedia[] | null;
  title?: string | null;
  summary?: string | null;
  body?: string | null;
  price_cents?: number | null;
  price_unit?: string | null;
  cover_image?: string | null;
  last_saved_at?: string | null;
  updated_at?: string | null;
};

type OwnedStoreLocation = {
  id: string;
  name?: string;
  city?: string | null;
  address?: string | null;
  lat?: number;
  lng?: number;
};

type ListingCopyAiResponse = {
  title?: string;
  summary?: string;
  provider?: string;
  error?: string;
};

const STEP_COUNT = CREATE_STEPS.length;

const DEFAULT_INDUSTRY_SLUG = 'other';

const GENERATED_COPY_FIELD_KEYS = new Set([
  'title',
  'summary',
]);

const PRICE_FIELD_KEYS = new Set([
  'price_mode',
  'budget_mode',
  'price_amount',
]);

const STRUCTURED_LOCATION_FIELD_KEYS = new Set([
  'location',
  'address',
]);

const MAX_UPLOAD_FILES = 8;

const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const DEFAULT_CREATE_LOCATION_POINT: LatLng = {
  lat: -6.2,
  lng: 106.816666,
};

const categorySlugByLegacyId: Record<string, string> = {
  supplies: 'materials-suppliers',
  service: 'services',
  equipment: 'machines-tools',
  property: 'business-places',
  opportunity: 'business-opportunities',
};

const categoryLegacyBySlug = Object.fromEntries(
  Object.entries(categorySlugByLegacyId).map(([id, slug]) => [
    slug,
    id,
  ]),
);

function toIntent(
  mode?: CreateFlowIntent,
): CreateIntent | undefined {
  if (mode === 'demand') return 'request';
  if (mode === 'supply') return 'offer';
  return undefined;
}

function text(
  locale: 'id' | 'en',
  id: string,
  en: string,
) {
  return locale === 'id' ? id : en;
}

function valueAsString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function valueAsRecord(
  value: unknown,
): Record<string, unknown> {
  return value &&
    typeof value === 'object' &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function valueAsStringList(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,;\n]/)
      : [];

  return Array.from(
    new Set(
      values
        .map(item => String(item ?? '').trim())
        .filter(Boolean),
    ),
  );
}

function valueAsBool(value: unknown): boolean {
  return value === true || value === 'true';
}

function readNumber(value: unknown): number | null {
  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === 'string' &&
    value.trim()
  ) {
    const parsed = Number(value);
    return Number.isFinite(parsed)
      ? parsed
      : null;
  }

  return null;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function parseRupiahInput(
  value: string,
): number | undefined {
  const digits = digitsOnly(value);

  if (!digits) return undefined;

  const amount = Number.parseInt(
    digits,
    10,
  );

  return Number.isFinite(amount)
    ? amount
    : undefined;
}

function numericQuantityInput(value: string): string {
  return value.replace(
    /[^\d.,]/g,
    '',
  );
}

function formatRupiahNumber(
  value: unknown,
): string {
  const raw =
    typeof value === 'number'
      ? String(value)
      : digitsOnly(
          valueAsString(value),
        );

  if (!raw) return '';

  const amount = Number.parseInt(
    raw,
    10,
  );

  if (!Number.isFinite(amount)) {
    return '';
  }

  return new Intl.NumberFormat(
    'id-ID',
    {
      maximumFractionDigits: 0,
    },
  ).format(amount);
}

function formatRupiahLabel(
  value: unknown,
): string {
  const formatted =
    formatRupiahNumber(value);

  return formatted
    ? `Rp ${formatted}`
    : '';
}

function submissionIndustryIds(
  industryIds: string[],
): string[] {
  return industryIds.length
    ? industryIds
    : [DEFAULT_INDUSTRY_SLUG];
}

function labelFor(
  locale: 'id' | 'en',
  item: TaxonomyItem,
) {
  return (
    (
      locale === 'id'
        ? item.name_id || item.label_id
        : item.name_en || item.label_en
    ) || item.slug
  );
}

function normalizedOptionValues(
  field: ListingFieldSchema,
  value: unknown,
): string[] {
  return valueAsStringList(value).map(
    item => {
      const normalized =
        item.toLowerCase();

      const match =
        field.options?.find(
          option =>
            option.value.toLowerCase() ===
              normalized ||
            option.labelId.toLowerCase() ===
              normalized ||
            option.labelEn.toLowerCase() ===
              normalized,
        );

      return match?.value || item;
    },
  );
}

function resolveApiPricingMode(
  intent: CreateIntent | undefined,
  amount: number | undefined,
): 'fixed' | 'request' {
  if (intent === 'request') {
    return 'request';
  }

  return amount && amount > 0
    ? 'fixed'
    : 'request';
}

function requestBudgetLabel(
  locale: 'id' | 'en',
  values: Record<string, unknown>,
): string {
  const amount =
    formatRupiahLabel(
      values.price_amount,
    );

  if (amount) return amount;

  const mode = valueAsString(
    values.budget_mode,
  );

  if (mode === 'undetermined') {
    return text(
      locale,
      'Budget belum ditentukan',
      'Budget not decided',
    );
  }

  if (mode === 'negotiable') {
    return text(
      locale,
      'Budget bisa dibicarakan',
      'Budget negotiable',
    );
  }

  return text(
    locale,
    'Budget fleksibel',
    'Flexible budget',
  );
}

function readLatLngFromValues(
  values: Record<string, unknown>,
): LatLng | null {
  const nested =
    values.location_point;

  if (
    nested &&
    typeof nested === 'object' &&
    !Array.isArray(nested)
  ) {
    const record =
      nested as Record<
        string,
        unknown
      >;

    const lat = readNumber(
      record.lat,
    );

    const lng = readNumber(
      record.lng,
    );

    if (
      lat !== null &&
      lng !== null
    ) {
      return {
        lat,
        lng,
      };
    }
  }

  const lat =
    readNumber(
      values.location_lat,
    ) ??
    readNumber(
      values.latitude,
    ) ??
    readNumber(values.lat);

  const lng =
    readNumber(
      values.location_lng,
    ) ??
    readNumber(
      values.longitude,
    ) ??
    readNumber(values.lng);

  return lat !== null &&
    lng !== null
    ? {
        lat,
        lng,
      }
    : null;
}

function readSelectedLocationFromValues(
  values: Record<string, unknown>,
): SelectedLocation | null {
  const structured =
    values.location_structured;

  return isSelectedLocation(
    structured,
  )
    ? structured
    : null;
}

function hasMeaningfulValue(
  value: unknown,
): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return (
      Number.isFinite(value) &&
      value > 0
    );
  }

  return (
    value !== undefined &&
    value !== null &&
    String(value).trim() !== ''
  );
}

function orderMainStepFields(
  fields: ListingFieldSchema[],
) {
  const detailFields =
    fields.filter(
      field =>
        !GENERATED_COPY_FIELD_KEYS.has(
          field.key,
        ) &&
        !PRICE_FIELD_KEYS.has(
          field.key,
        ),
    );

  const priceFields =
    fields.filter(field =>
      PRICE_FIELD_KEYS.has(
        field.key,
      ),
    );

  const copyFields =
    fields.filter(field =>
      GENERATED_COPY_FIELD_KEYS.has(
        field.key,
      ),
    );

  return [
    ...detailFields,
    ...priceFields,
    ...copyFields,
  ];
}

function normalizeMarketplaceCategorySlug(
  value: unknown,
): string | undefined {
  const cleaned =
    valueAsString(value)
      .toLowerCase()
      .trim();

  if (!cleaned) {
    return undefined;
  }

  return (
    categorySlugByLegacyId[
      cleaned
    ] || cleaned
  );
}

function normalizeDraftIntent(
  value: unknown,
): CreateIntent | undefined {
  const cleaned =
    valueAsString(value)
      .toLowerCase()
      .trim();

  if (
    cleaned === 'request' ||
    cleaned === 'demand' ||
    cleaned === 'seeker'
  ) {
    return 'request';
  }

  if (
    cleaned === 'offer' ||
    cleaned === 'supply' ||
    cleaned === 'provider'
  ) {
    return 'offer';
  }

  return undefined;
}

function normalizeDraftMedia(
  value: unknown,
  coverImage?: unknown,
): DraftMedia[] {
  const media =
    Array.isArray(value)
      ? value
      : [];

  const normalized =
    media
      .map(
        (entry): DraftMedia | null => {
          if (
            typeof entry ===
            'string'
          ) {
            const url =
              normalizeContentMediaUrl(
                entry,
              );

            return url
              ? {
                  id: makeUploadDraftId(
                    'image',
                  ),
                  url,
                  preview: url,
                  status: 'uploaded',
                }
              : null;
          }

          const record =
            valueAsRecord(entry);

          const status =
            valueAsString(
              record.status,
            );

          const url =
            normalizeContentMediaUrl(
              valueAsString(
                record.url,
              ) ||
                valueAsString(
                  record.preview,
                ),
            );

          if (
            !url &&
            !valueAsString(
              record.name,
            )
          ) {
            return null;
          }

          return {
            id:
              valueAsString(
                record.id,
              ) ||
              makeUploadDraftId(
                'image',
              ),
            url:
              url || undefined,
            preview:
              url ||
              valueAsString(
                record.preview,
              ) ||
              undefined,
            name:
              valueAsString(
                record.name,
              ) || undefined,
            status:
              status ===
                'pending' ||
              status ===
                'uploading' ||
              status ===
                'failed' ||
              status ===
                'deleted'
                ? status
                : 'uploaded',
            error:
              valueAsString(
                record.error,
              ) || undefined,
          };
        },
      )
      .filter(
        (
          entry,
        ): entry is DraftMedia =>
          Boolean(entry),
      );

  const coverUrl =
    normalizeContentMediaUrl(
      valueAsString(
        coverImage,
      ),
    );

  if (
    coverUrl &&
    !normalized.some(
      item => item.url === coverUrl,
    )
  ) {
    normalized.unshift({
      id: makeUploadDraftId(
        'image',
      ),
      url: coverUrl,
      preview: coverUrl,
      status: 'uploaded',
    });
  }

  return normalized;
}

function buildDraftFromListingPayload(
  payload: ListingDraftPayload,
): TemporaryCreateDraft {
  const values = {
    ...valueAsRecord(
      payload.values,
    ),
  };

  if (
    !valueAsString(values.title) &&
    valueAsString(payload.title)
  ) {
    values.title =
      valueAsString(
        payload.title,
      );
  }

  if (
    !valueAsString(
      values.summary,
    ) &&
    valueAsString(
      payload.summary,
    )
  ) {
    values.summary =
      valueAsString(
        payload.summary,
      );
  }

  if (
    !valueAsString(
      values.body,
    ) &&
    valueAsString(payload.body)
  ) {
    values.body =
      valueAsString(
        payload.body,
      );
  }

  if (
    !valueAsString(
      values.price_amount,
    ) &&
    payload.price_cents
  ) {
    values.price_amount =
      String(
        Math.floor(
          payload.price_cents /
            100,
        ),
      );
  }

  if (
    !valueAsString(
      values.unit,
    ) &&
    valueAsString(
      payload.price_unit,
    )
  ) {
    values.unit =
      valueAsString(
        payload.price_unit,
      );
  }

  const categorySlug =
    normalizeMarketplaceCategorySlug(
      payload.category_slug,
    );

  const subcategorySlug =
    valueAsString(
      payload.subcategory_slug,
    ) || undefined;

  const requestedStep =
    Number(
      payload.current_step,
    ) || 1;

  const inferredStep =
    subcategorySlug
      ? 4
      : categorySlug
        ? 3
        : payload.listing_intent
          ? 2
          : 1;

  const currentStep =
    Math.max(
      1,
      Math.min(
        STEP_COUNT,
        requestedStep ||
          inferredStep,
      ),
    );

  return {
    ...createEmptyTemporaryDraft(),
    draftId: payload.id,
    draftVersion:
      payload.draft_version,
    intent:
      normalizeDraftIntent(
        payload.listing_intent,
      ),
    categorySlug,
    subcategorySlug,
    industryIds:
      valueAsStringList(
        payload.industry_ids,
      ),
    currentStep,
    formValues: values,
    media: normalizeDraftMedia(
      payload.media,
      payload.cover_image,
    ),
    updatedAt:
      valueAsString(
        payload.last_saved_at,
      ) ||
      valueAsString(
        payload.updated_at,
      ) ||
      new Date().toISOString(),
  };
}

function buildDraftFromContentItem(
  item: ContentItem,
): TemporaryCreateDraft {
  const metadata =
    valueAsRecord(
      item.metadata,
    );

  const formValues =
    valueAsRecord(
      metadata.form_values,
    );

  const attributes =
    valueAsRecord(
      metadata.attributes,
    );

  const values = {
    ...attributes,
    ...formValues,
  };

  if (
    !valueAsString(values.title) &&
    valueAsString(item.title)
  ) {
    values.title =
      valueAsString(
        item.title,
      );
  }

  if (
    !valueAsString(
      values.summary,
    ) &&
    valueAsString(
      item.summary,
    )
  ) {
    values.summary =
      valueAsString(
        item.summary,
      );
  }

  if (
    !valueAsString(values.body) &&
    valueAsString(item.body)
  ) {
    values.body =
      valueAsString(
        item.body,
      );
  }

  if (
    !valueAsString(
      values.price_amount,
    ) &&
    item.price_cents
  ) {
    values.price_amount =
      String(
        Math.floor(
          item.price_cents /
            100,
        ),
      );
  }

  if (
    !valueAsString(
      values.unit,
    ) &&
    valueAsString(
      item.price_unit,
    )
  ) {
    values.unit =
      valueAsString(
        item.price_unit,
      );
  }

  const categorySlug =
    normalizeMarketplaceCategorySlug(
      metadata.marketplace_category_slug ||
        metadata.create_category ||
        metadata.business_discovery_category ||
        item.category,
    );

  const subcategorySlug =
    valueAsString(
      metadata.marketplace_subcategory_slug,
    ) ||
    valueAsString(
      metadata.subcategory,
    ) ||
    valueAsString(
      metadata.sub_category,
    ) ||
    undefined;

  const listingProgress =
    valueAsRecord(
      metadata.listing_progress,
    );

  const requestedStep =
    Number(
      item.current_step,
    ) ||
    Number(
      listingProgress.current_step,
    ) ||
    0;

  const inferredStep =
    subcategorySlug
      ? 4
      : categorySlug
        ? 3
        : 1;

  const currentStep =
    Math.max(
      1,
      Math.min(
        STEP_COUNT,
        requestedStep ||
          inferredStep,
      ),
    );

  return {
    ...createEmptyTemporaryDraft(),
    draftId: item.id,
    intent:
      normalizeDraftIntent(
        metadata.listing_intent,
      ) ||
      normalizeDraftIntent(
        metadata.intent,
      ) ||
      normalizeDraftIntent(
        metadata.listing_side,
      ) ||
      normalizeDraftIntent(
        metadata.market_side,
      ),
    categorySlug,
    subcategorySlug,
    industryIds:
      valueAsStringList(
        metadata.industry_ids ||
          metadata.industry_slugs ||
          metadata.industry_slug,
      ),
    currentStep,
    formValues: values,
    media: normalizeDraftMedia(
      metadata.media ||
        metadata.image_urls,
      item.cover_image,
    ),
    updatedAt:
      new Date().toISOString(),
  };
}

function categoryCopy(
  category: CreateBusinessCategory,
  intent: CreateIntent,
  locale: 'id' | 'en',
) {
  const data: Record<
    string,
    Record<
      CreateIntent,
      {
        id: string;
        en: string;
        exampleId: string;
        exampleEn: string;
      }
    >
  > = {
    supplies: {
      offer: {
        id: 'Tawarkan bahan baku, kemasan, stok grosir, atau produk jual ulang.',
        en: 'Offer raw materials, packaging, wholesale stock, or resale products.',
        exampleId:
          'Supplier biji kopi arabika untuk kedai dan reseller',
        exampleEn:
          'Arabica coffee bean supplier for cafes and resellers',
      },
      request: {
        id: 'Cari supplier bahan baku, kemasan, stok grosir, atau produk jual ulang.',
        en: 'Find suppliers for raw materials, packaging, wholesale stock, or resale products.',
        exampleId:
          'Butuh supplier biji kopi arabika 10 kg per minggu',
        exampleEn:
          'Need arabica coffee bean supplier, 10 kg weekly',
      },
    },

    service: {
      offer: {
        id: 'Tawarkan jasa operasional, kreatif, legal, digital, teknisi, atau lapangan.',
        en: 'Offer operational, creative, legal, digital, technician, or field services.',
        exampleId:
          'Jasa foto produk untuk katalog UMKM',
        exampleEn:
          'Product photography service for MSME catalogs',
      },
      request: {
        id: 'Cari jasa operasional, kreatif, legal, digital, teknisi, atau lapangan.',
        en: 'Find operational, creative, legal, digital, technician, or field services.',
        exampleId:
          'Cari jasa foto untuk 30 produk skincare',
        exampleEn:
          'Need product photography for 30 skincare products',
      },
    },

    equipment: {
      offer: {
        id: 'Tawarkan mesin, alat produksi, sewa alat, atau perlengkapan usaha.',
        en: 'Offer machines, production tools, rentals, or business equipment.',
        exampleId:
          'Mesin cup sealer otomatis siap kirim',
        exampleEn:
          'Automatic cup sealer ready to ship',
      },
      request: {
        id: 'Cari mesin, alat produksi, sewa alat, atau perlengkapan usaha.',
        en: 'Find machines, production tools, rentals, or business equipment.',
        exampleId:
          'Cari mesin cup sealer untuk produksi rumahan',
        exampleEn:
          'Need a cup sealer for home production',
      },
    },

    property: {
      offer: {
        id: 'Tawarkan ruko, kios, booth, gudang kecil, atau lokasi jualan.',
        en: 'Offer shophouses, kiosks, booths, small warehouses, or selling locations.',
        exampleId:
          'Ruko disewakan di Antapani',
        exampleEn:
          'Shophouse for rent in Antapani',
      },
      request: {
        id: 'Cari ruko, kios, booth, gudang kecil, atau lokasi jualan.',
        en: 'Find shophouses, kiosks, booths, small warehouses, or selling locations.',
        exampleId:
          'Cari kios dekat kampus di Bandung',
        exampleEn:
          'Looking for a kiosk near a campus in Bandung',
      },
    },

    opportunity: {
      offer: {
        id: 'Tawarkan franchise, kemitraan, reseller, distributor, atau peluang siap jalan.',
        en: 'Offer franchise, partnership, reseller, distributor, or ready-to-run opportunities.',
        exampleId:
          'Paket kemitraan minuman untuk area Jawa Barat',
        exampleEn:
          'Drink partnership package for West Java',
      },
      request: {
        id: 'Cari franchise, kemitraan, reseller, distributor, atau peluang siap jalan.',
        en: 'Find franchise, partnership, reseller, distributor, or ready-to-run opportunities.',
        exampleId:
          'Cari peluang reseller modal di bawah 5 juta',
        exampleEn:
          'Looking for reseller opportunity under IDR 5 million',
      },
    },
  };

  const fallback = {
    id: category.descriptionId,
    en: category.descriptionEn,
    exampleId: category.exampleId,
    exampleEn: category.exampleEn,
  };

  const copy =
    data[category.id]?.[intent] ||
    fallback;

  return {
    description: text(
      locale,
      copy.id,
      copy.en,
    ),
    example: text(
      locale,
      copy.exampleId,
      copy.exampleEn,
    ),
  };
}

function safeErrorMessage(
  error: unknown,
  locale: 'id' | 'en',
  fallbackId: string,
  fallbackEn: string,
) {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message;
  }

  return text(
    locale,
    fallbackId,
    fallbackEn,
  );
}

async function readResponseJson(
  response: Response,
): Promise<Record<string, unknown>> {
  const value =
    await response
      .json()
      .catch(() => ({}));

  return valueAsRecord(value);
}

function responseErrorMessage(
  payload: Record<string, unknown>,
  fallback: string,
): string {
  return (
    valueAsString(
      payload.error,
    ) ||
    valueAsString(
      payload.message,
    ) ||
    fallback
  );
}

function isVersionConflict(
  response: Response,
  payload: Record<string, unknown>,
): boolean {
  if (
    response.status === 409 ||
    response.status === 412
  ) {
    return true;
  }

  const message =
    responseErrorMessage(
      payload,
      '',
    ).toLowerCase();

  return (
    message.includes(
      'version',
    ) ||
    message.includes(
      'conflict',
    ) ||
    message.includes(
      'stale',
    )
  );
}

export default function CreateListingWizard({
  entryMode,
  categoryId,
}: CreateListingWizardProps) {
  const params =
    useParams<{
      locale?: string;
    }>();

  const router = useRouter();
  const searchParams =
    useSearchParams();

  const locale: 'id' | 'en' =
    params?.locale === 'en'
      ? 'en'
      : 'id';

  const {
    authFetch,
    isAuthenticated,
    loading: authLoading,
    user,
  } = useAuth();
  const draftOwnerId = user?.id?.trim() || '';

  const creationDraftId =
    searchParams
      .get('draft')
      ?.trim() || '';

  const sideParam =
    searchParams.get('side');

  const entryModeFromQuery:
    | CreateFlowIntent
    | undefined =
    sideParam ===
      'demand' ||
    sideParam === 'supply'
      ? sideParam
      : undefined;

  const effectiveEntryMode =
    entryMode ||
    entryModeFromQuery;

  const [hydrated, setHydrated] =
    useState(false);
  const [hydratedOwnerId, setHydratedOwnerId] =
    useState('');

  const [baseDraft, setBaseDraft] =
    useState<TemporaryCreateDraft>(
      () =>
        createEmptyTemporaryDraft(),
    );

  const [intent, setIntent] =
    useState<
      CreateIntent | undefined
    >(() =>
      toIntent(
        effectiveEntryMode,
      ),
    );

  const [categorySlug, setCategorySlug] =
    useState<
      string | undefined
    >(() => {
      const category =
        categoryId
          ? getCreateBusinessCategoryById(
              categoryId,
            )
          : null;

      return category
        ? category.slugEn
        : undefined;
    });

  const [subcategorySlug, setSubcategorySlug] =
    useState<
      string | undefined
    >();

  const [industryIds, setIndustryIds] =
    useState<string[]>([]);

  const [currentStep, setCurrentStep] =
    useState(1);

  const [values, setValues] =
    useState<
      Record<string, unknown>
    >({});

  const [media, setMedia] =
    useState<DraftMedia[]>([]);

  const [serverDraft, setServerDraft] =
    useState<ServerDraft | null>(
      null,
    );

  const [pendingStoredDraft, setPendingStoredDraft] =
    useState<TemporaryCreateDraft | null>(
      null,
    );

  const [saveStatus, setSaveStatus] =
    useState<SaveStatus>(
      'idle',
    );

  const [lastSavedAt, setLastSavedAt] =
    useState<
      string | undefined
    >();

  const [error, setError] =
    useState('');

  const [subcategories, setSubcategories] =
    useState<TaxonomyItem[]>([]);

  const [industries, setIndustries] =
    useState<TaxonomyItem[]>([]);

  const [taxonomyLoading, setTaxonomyLoading] =
    useState(false);

  const [showAllTaxonomy, setShowAllTaxonomy] =
    useState(false);

  const [showIndustryChoices, setShowIndustryChoices] =
    useState(false);

  const [taxonomyQuery, setTaxonomyQuery] =
    useState('');

  const [showMoreDetails, setShowMoreDetails] =
    useState(false);

  const [customOptionInputs, setCustomOptionInputs] =
    useState<
      Record<string, string>
    >({});

  const [aiCopyLoading, setAiCopyLoading] =
    useState(false);

  const [aiCopyError, setAiCopyError] =
    useState('');

  const [publishing, setPublishing] =
    useState(false);

  const [mapPickerFieldKey, setMapPickerFieldKey] =
    useState<
      string | null
    >(null);

  const [ownedStoreLocations, setOwnedStoreLocations] =
    useState<
      LocationPickerSuggestion[]
    >([]);

  const autosaveTimer =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const saveInFlightRef =
    useRef<Promise<void> | null>(
      null,
    );

  const saveRequestedRef =
    useRef(false);

  const draftVersionRef =
    useRef<
      number | undefined
    >(undefined);

  const serverDraftRef =
    useRef<ServerDraft | null>(
      null,
    );

  const importedCreationDraftRef =
    useRef('');

  const mountedRef =
    useRef(true);

  const localPreviewUrlsRef =
    useRef<Set<string>>(
      new Set(),
    );

  const category = useMemo(() => {
    const legacyId =
      categorySlug
        ? categoryLegacyBySlug[
            categorySlug
          ]
        : null;

    return legacyId
      ? getCreateBusinessCategoryById(
          legacyId,
        )
      : null;
  }, [categorySlug]);

  const fieldSchema = useMemo(
    () =>
      intent &&
      categorySlug
        ? buildListingFieldSchema(
            intent,
            categorySlug,
            subcategorySlug,
          )
        : [],
    [
      categorySlug,
      intent,
      subcategorySlug,
    ],
  );

  const requiresPrimaryImage = Boolean(
    category &&
      activeListingNeedsPrimaryImage(
        category.contentType,
        intent === 'request' ? 'demand' : 'supply',
      ),
  );
  const taxonomyLocked = Boolean(serverDraft?.id);

  const resetUiStateForDraft =
    useCallback(
      (
        draft: TemporaryCreateDraft,
      ) => {
        setBaseDraft(draft);
        setIntent(draft.intent);
        setCategorySlug(
          draft.categorySlug,
        );
        setSubcategorySlug(
          draft.subcategorySlug,
        );
        setIndustryIds(
          draft.industryIds,
        );
        const restoredStep = Math.max(
          1,
          Math.min(
            STEP_COUNT,
            draft.currentStep || 1,
          ),
        );
        setCurrentStep(
          draft.draftId
            ? Math.max(4, restoredStep)
            : restoredStep,
        );
        setValues(
          draft.formValues || {},
        );
        setMedia(
          draft.media || [],
        );

        const nextServerDraft =
          draft.draftId
            ? {
                id: draft.draftId,
                draft_version:
                  draft.draftVersion,
              }
            : null;

        setServerDraft(
          nextServerDraft,
        );

        serverDraftRef.current =
          nextServerDraft;

        draftVersionRef.current =
          draft.draftVersion;

        setLastSavedAt(
          draft.updatedAt,
        );

        setError('');
        setAiCopyError('');
        setTaxonomyQuery('');
        setShowAllTaxonomy(false);
        setShowMoreDetails(false);
        setCustomOptionInputs({});
      },
      [],
    );

  const buildFreshDraftForRoute =
    useCallback(() => {
      const initial =
        createEmptyTemporaryDraft();

      const seededCategory =
        categoryId
          ? getCreateBusinessCategoryById(
              categoryId,
            )
          : null;

      const seededIntent =
        toIntent(
          effectiveEntryMode,
        );

      return {
        ...initial,
        intent:
          seededIntent,
        categorySlug:
          seededCategory?.slugEn,
        currentStep:
          seededCategory
            ? 3
            : seededIntent
              ? 2
              : 1,
      };
    }, [
      categoryId,
      effectiveEntryMode,
    ]);

  const continueStoredDraft =
    useCallback(() => {
      if (!pendingStoredDraft) {
        return;
      }

      resetUiStateForDraft({
        ...pendingStoredDraft,
        intent:
          pendingStoredDraft.intent ||
          toIntent(
            effectiveEntryMode,
          ),
      });

      setPendingStoredDraft(
        null,
      );

      setSaveStatus(
        pendingStoredDraft.draftId
          ? 'saved'
          : 'idle',
      );
    }, [
      effectiveEntryMode,
      pendingStoredDraft,
      resetUiStateForDraft,
    ]);

  const startFreshDraft =
    useCallback(() => {
      if (!draftOwnerId) return;
      clearTemporaryCreateDraft(draftOwnerId);

      const fresh =
        writeTemporaryCreateDraft(
          draftOwnerId,
          buildFreshDraftForRoute(),
        );

      resetUiStateForDraft(
        fresh,
      );

      setPendingStoredDraft(
        null,
      );

      setSaveStatus('idle');
    }, [
      buildFreshDraftForRoute,
      draftOwnerId,
      resetUiStateForDraft,
    ]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      for (const url of localPreviewUrlsRef.current) {
        try {
          URL.revokeObjectURL(
            url,
          );
        } catch {
          // Ignore cleanup failures.
        }
      }

      localPreviewUrlsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (creationDraftId || authLoading || !draftOwnerId) {
      return;
    }

    const stored =
      readTemporaryCreateDraft(draftOwnerId);

    if (
      hasTemporaryCreateDraftProgress(
        stored,
      )
    ) {
      setPendingStoredDraft(
        stored,
      );

      resetUiStateForDraft(
        buildFreshDraftForRoute(),
      );

      setSaveStatus('idle');
      setHydrated(true);
      setHydratedOwnerId(draftOwnerId);
      return;
    }

    const fresh =
      effectiveEntryMode ||
      categoryId
        ? writeTemporaryCreateDraft(
            draftOwnerId,
            buildFreshDraftForRoute(),
          )
        : buildFreshDraftForRoute();

    resetUiStateForDraft(
      fresh,
    );

    setHydrated(true);
    setHydratedOwnerId(draftOwnerId);
  }, [
    buildFreshDraftForRoute,
    authLoading,
    categoryId,
    creationDraftId,
    draftOwnerId,
    effectiveEntryMode,
    resetUiStateForDraft,
  ]);

  useEffect(() => {
    if (
      !creationDraftId ||
      authLoading
    ) {
      return;
    }

    if (!isAuthenticated) {
      resetUiStateForDraft(
        buildFreshDraftForRoute(),
      );

      setError(
        text(
          locale,
          'Masuk dulu untuk membuka draft.',
          'Sign in first to open this draft.',
        ),
      );

      setHydrated(true);
      setHydratedOwnerId(draftOwnerId);
      return;
    }

    if (
      importedCreationDraftRef.current ===
      creationDraftId
    ) {
      return;
    }

    importedCreationDraftRef.current =
      creationDraftId;

    let cancelled = false;

    setHydrated(false);
    setHydratedOwnerId('');
    setError('');

    async function applyLoadedDraft(
      draft: TemporaryCreateDraft,
    ) {
      const routeIntent =
        toIntent(
          effectiveEntryMode,
        );

      if (
        routeIntent &&
        draft.intent &&
        routeIntent !== draft.intent
      ) {
        throw new Error(
          text(
            locale,
            'Tujuan draft tidak cocok dengan halaman ini.',
            'The draft purpose does not match this page.',
          ),
        );
      }

      if (
        categoryId &&
        draft.categorySlug
      ) {
        const expected =
          getCreateBusinessCategoryById(
            categoryId,
          );

        if (
          expected?.slugEn !==
          draft.categorySlug
        ) {
          throw new Error(
            text(
              locale,
              'Kategori draft tidak cocok dengan halaman ini.',
              'The draft category does not match this page.',
            ),
          );
        }
      }

      const normalized =
        writeTemporaryCreateDraft(
          draftOwnerId,
          {
            ...draft,
            intent:
              draft.intent ||
              routeIntent,
            currentStep:
              draft.currentStep >= 4 &&
              !draft.subcategorySlug
                ? 3
                : draft.currentStep,
          },
        );

      if (cancelled) return;

      resetUiStateForDraft(
        normalized,
      );

      setPendingStoredDraft(
        null,
      );

      setSaveStatus(
        normalized.draftId
          ? 'saved'
          : 'idle',
      );

      setHydrated(true);
      setHydratedOwnerId(draftOwnerId);
    }

    async function loadDraftFromParam() {
      const encoded =
        encodeURIComponent(
          creationDraftId,
        );

      /*
       * 1. Server listing draft
       */
      const listingDraftResponse =
        await authFetch(
          `/api/listing-drafts/${encoded}`,
          {
            cache: 'no-store',
          },
        );

      if (
        listingDraftResponse.ok
      ) {
        const payload =
          await readResponseJson(
            listingDraftResponse,
          );

        const draft =
          valueAsRecord(
            payload.draft,
          );

        if (
          valueAsString(
            draft.id,
          )
        ) {
          await applyLoadedDraft(
            buildDraftFromListingPayload(
              draft as unknown as ListingDraftPayload,
            ),
          );
          return;
        }
      }

      /*
       * 2. Existing content.
       *
       * Important:
       * ContentItem does not guarantee updated_at/created_at,
       * so this conversion intentionally uses the current time
       * for local display metadata.
       */
      const contentResponse =
        await authFetch(
          `/api/content/${encoded}`,
          {
            cache: 'no-store',
          },
        );

      if (
        contentResponse.ok
      ) {
        const content =
          (await contentResponse
            .json()
            .catch(
              () => null,
            )) as ContentItem | null;

        if (
          content?.id
        ) {
          if (
            user?.id &&
            content.owner_id &&
            content.owner_id !==
              user.id
          ) {
            throw new Error(
              text(
                locale,
                'Kamu tidak punya akses untuk mengedit postingan ini.',
                'You do not have access to edit this post.',
              ),
            );
          }

          await applyLoadedDraft(
            buildDraftFromContentItem(
              content,
            ),
          );

          return;
        }
      }

      /*
       * 3. AI creation draft
       */
      const creationDraftResponse =
        await authFetch(
          `/api/creation-drafts/${encoded}`,
          {
            cache: 'no-store',
          },
        );

      const payload =
        await readResponseJson(
          creationDraftResponse,
        );

      const aiDraft =
        payload.data as
          | AICreationDraft
          | undefined;

      if (
        !creationDraftResponse.ok ||
        !aiDraft
      ) {
        throw new Error(
          responseErrorMessage(
            payload,
            text(
              locale,
              'Draft tidak ditemukan atau sudah tidak tersedia.',
              'Draft was not found or is no longer available.',
            ),
          ),
        );
      }

      const prefill =
        mapCreationDraftToListingPrefill(
          aiDraft,
        );

      if (!prefill) {
        throw new Error(
          text(
            locale,
            'Jenis draft tidak cocok dengan form postingan.',
            'This draft type does not match the listing form.',
          ),
        );
      }

      const importedCategory =
        getCreateBusinessCategoryById(
          prefill.categoryId,
        );

      const readyForDetails =
        Boolean(
          prefill.subcategorySlug,
        );

      await applyLoadedDraft({
        ...createEmptyTemporaryDraft(),
        intent:
          prefill.intent,
        categorySlug:
          importedCategory?.slugEn,
        subcategorySlug:
          prefill.subcategorySlug,
        industryIds:
          prefill.industryIds,
        currentStep:
          readyForDetails
            ? 4
            : 3,
        formValues:
          prefill.values,
        media:
          prefill.media,
        updatedAt:
          new Date().toISOString(),
      });
    }

    loadDraftFromParam().catch(
      caught => {
        if (cancelled) {
          return;
        }

        setError(
          safeErrorMessage(
            caught,
            locale,
            'Draft gagal dibuka.',
            'The draft could not be opened.',
          ),
        );

        resetUiStateForDraft(
          buildFreshDraftForRoute(),
        );

        setHydrated(true);
        setHydratedOwnerId(draftOwnerId);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [
    authFetch,
    authLoading,
    buildFreshDraftForRoute,
    categoryId,
    creationDraftId,
    effectiveEntryMode,
    isAuthenticated,
    locale,
    resetUiStateForDraft,
    draftOwnerId,
  ]);

  /*
   * Local-first persistence.
   *
   * This runs independently from server autosave.
   * Even if the API is down, the user still has a local draft.
   */
  useEffect(() => {
    if (
      !hydrated ||
      pendingStoredDraft ||
      !draftOwnerId ||
      hydratedOwnerId !== draftOwnerId
    ) {
      return;
    }

    setBaseDraft(
      previous => {
        const next =
          writeTemporaryCreateDraft(
            draftOwnerId,
            {
              ...previous,
              intent,
              categorySlug,
              subcategorySlug,
              industryIds,
              currentStep,
              formValues: values,
              media: media.map(
                item => ({
                  id: item.id,
                  url: item.url,
                  name: item.name,
                  status:
                    item.status,
                  error: item.error,
                  preview:
                    item.preview,
                }),
              ),
              draftId:
                serverDraft?.id ||
                undefined,
              draftVersion:
                serverDraft
                  ?.draft_version,
              updatedAt:
                new Date().toISOString(),
            },
          );

        setLastSavedAt(
          next.updatedAt,
        );

        return next;
      },
    );
  }, [
    hydrated,
    hydratedOwnerId,
    pendingStoredDraft,
    draftOwnerId,
    intent,
    categorySlug,
    subcategorySlug,
    industryIds,
    currentStep,
    values,
    media,
    serverDraft?.id,
    serverDraft?.draft_version,
  ]);

  useEffect(() => {
    if (!categorySlug) {
      setSubcategories([]);
      setIndustries([]);
      return;
    }

    let cancelled = false;

    setTaxonomyLoading(
      true,
    );

    Promise.all([
      fetch(
        `/api/categories/${encodeURIComponent(
          categorySlug,
        )}/subcategories`,
        {
          cache: 'no-store',
        },
      )
        .then(
          response =>
            response.ok
              ? response.json()
              : {
                  items: [],
                },
        )
        .catch(
          () => ({
            items: [],
          }),
        ),

      fetch(
        '/api/industries?limit=80',
        {
          cache: 'no-store',
        },
      )
        .then(
          response =>
            response.ok
              ? response.json()
              : {
                  items: [],
                },
        )
        .catch(
          () => ({
            items: [],
          }),
        ),
    ])
      .then(
        ([sub, inds]) => {
          if (cancelled) {
            return;
          }

          const subItems =
            Array.isArray(
              sub?.items,
            )
              ? sub.items
              : [];

          const industryItems =
            Array.isArray(
              inds?.items,
            )
              ? inds.items
              : [];

          setSubcategories(
            mergeCreateTaxonomyItems(
              subItems,
              FALLBACK_CREATE_SUBCATEGORIES[
                categorySlug
              ] || [],
            ),
          );

          setIndustries(
            mergeCreateTaxonomyItems(
              industryItems,
              FALLBACK_CREATE_INDUSTRIES,
            ),
          );
        },
      )
      .finally(() => {
        if (!cancelled) {
          setTaxonomyLoading(
            false,
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [categorySlug]);

  useEffect(() => {
    if (!isAuthenticated) {
      setOwnedStoreLocations([]);
      return;
    }

    let cancelled = false;

    authFetch(
      '/api/super-app/umkm/stores?mine=1&limit=80',
      {
        cache: 'no-store',
      },
    )
      .then(
        response =>
          response.ok
            ? response.json()
            : {
                data: {},
              },
      )
      .then(
        (
          payload: {
            data?: {
              items?: OwnedStoreLocation[];
            };
          },
        ) => {
          if (cancelled) {
            return;
          }

          const items =
            payload.data
              ?.items || [];

          setOwnedStoreLocations(
            items
              .filter(
                item =>
                  Number.isFinite(
                    item.lat,
                  ) &&
                  Number.isFinite(
                    item.lng,
                  ) &&
                  Boolean(
                    item.name?.trim(),
                  ),
              )
              .map(item => ({
                ...buildBusinessLocationSuggestion(
                  {
                    id: item.id,
                    name:
                      item.name?.trim() ||
                      text(
                        locale,
                        'Lokasi usaha',
                        'Business location',
                      ),
                    address:
                      item.address,
                    city:
                      item.city,
                    lat:
                      item.lat as number,
                    lng:
                      item.lng as number,
                  },
                ),
                id: `business-${item.id}`,
                label:
                  item.name?.trim() ||
                  text(
                    locale,
                    'Lokasi usaha',
                    'Business location',
                  ),
                subtitle: [
                  item.address,
                  item.city,
                ]
                  .filter(Boolean)
                  .join(' • '),
                point: {
                  lat: Number(
                    (
                      item.lat as number
                    ).toFixed(6),
                  ),
                  lng: Number(
                    (
                      item.lng as number
                    ).toFixed(6),
                  ),
                },
                source:
                  'business' as const,
              })),
          );
        },
      )
      .catch(() => {
        if (!cancelled) {
          setOwnedStoreLocations(
            [],
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    authFetch,
    isAuthenticated,
    locale,
  ]);

  const syncServerDraftState =
    useCallback(
      (draft: ServerDraft) => {
        if (
          !mountedRef.current
        ) {
          return;
        }

        serverDraftRef.current =
          draft;

        draftVersionRef.current =
          draft.draft_version;

        setServerDraft(
          draft,
        );
      },
      [],
    );

  const createServerDraft =
    useCallback(
      async (): Promise<ServerDraft | null> => {
        if (
          !isAuthenticated ||
          !intent ||
          !categorySlug ||
          !subcategorySlug
        ) {
          return null;
        }

        if (
          serverDraftRef.current?.id
        ) {
          return serverDraftRef.current;
        }

        setSaveStatus(
          'saving',
        );

        const response =
          await authFetch(
            '/api/listing-drafts',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body: JSON.stringify({
                intent,
                category_slug:
                  categorySlug,
                subcategory_slug:
                  subcategorySlug,
                industry_ids:
                  submissionIndustryIds(
                    industryIds,
                  ),
                current_step:
                  currentStep,
                values,
                media,
                completion_percentage:
                  Math.round(
                    (currentStep /
                      STEP_COUNT) *
                      100,
                  ),
                idempotency_key:
                  baseDraft.idempotencyKey,
              }),
            },
          );

        const payload =
          await readResponseJson(
            response,
          );

        const draft =
          valueAsRecord(
            payload.draft,
          ) as unknown as ServerDraft;

        if (
          !response.ok ||
          !draft?.id
        ) {
          const message =
            responseErrorMessage(
              payload,
              text(
                locale,
                'Draft belum berhasil dibuat.',
                'The draft could not be created.',
              ),
            );

          setSaveStatus(
            navigator.onLine
              ? 'error'
              : 'offline',
          );

          throw new Error(
            message,
          );
        }

        syncServerDraftState(
          draft,
        );

        setSaveStatus(
          'saved',
        );

        setLastSavedAt(
          new Date().toISOString(),
        );

        return draft;
      },
      [
        authFetch,
        baseDraft.idempotencyKey,
        categorySlug,
        currentStep,
        industryIds,
        intent,
        isAuthenticated,
        locale,
        media,
        subcategorySlug,
        syncServerDraftState,
        values,
      ],
    );

  const buildSavePayload =
    useCallback(
      (
        step: number,
        nextValues: Record<
          string,
          unknown
        >,
        nextMedia: DraftMedia[],
      ) => {
        const submissionValues =
          intent === 'request'
            ? {
                budget_mode:
                  'undetermined',
                ...nextValues,
              }
            : nextValues;

        const title =
          valueAsString(
            submissionValues.title,
          ) ||
          valueAsString(
            submissionValues.item_name,
          ) ||
          valueAsString(
            submissionValues.item_needed,
          ) ||
          valueAsString(
            submissionValues.service_name,
          ) ||
          valueAsString(
            submissionValues.service_needed,
          ) ||
          valueAsString(
            submissionValues.equipment_name,
          ) ||
          valueAsString(
            submissionValues.equipment_needed,
          ) ||
          valueAsString(
            submissionValues.place_name,
          ) ||
          valueAsString(
            submissionValues.place_needed,
          ) ||
          valueAsString(
            submissionValues.opportunity_name,
          ) ||
          valueAsString(
            submissionValues.opportunity_needed,
          );

        const summary =
          valueAsString(
            submissionValues.summary,
          );

        const amount =
          parseRupiahInput(
            valueAsString(
              submissionValues.price_amount,
            ),
          );

        const pricingMode =
          resolveApiPricingMode(
            intent,
            amount,
          );

        const coverImage =
          nextMedia.find(
            item =>
              item.status ===
                'uploaded' &&
              Boolean(item.url),
          )?.url;

        return {
          expected_version:
            draftVersionRef.current,
          current_step: step,
          values:
            submissionValues,
          media: nextMedia,
          title,
          summary,
          body: summary,

          price_cents:
            pricingMode ===
            'fixed'
              ? Math.round(
                  (amount || 0) *
                    100,
                )
              : undefined,

          price_unit:
            pricingMode ===
            'request'
              ? undefined
              : valueAsString(
                  submissionValues.unit,
                ) ||
                undefined,

          pricing_mode:
            pricingMode,

          cover_image:
            coverImage,

          industry_ids:
            submissionIndustryIds(
              industryIds,
            ),

          completion_percentage:
            Math.round(
              (step /
                STEP_COUNT) *
                100,
            ),

          attributes:
            submissionValues,

          contact_snapshot: {
            display_as:
              submissionValues.display_as ||
              'personal',
            contact_channel:
              submissionValues.contact_channel ||
              'chat',
          },
        };
      },
      [
        industryIds,
        intent,
      ],
    );

  const saveServerDraft =
    useCallback(
      async (
        step = currentStep,
        nextValues = values,
        nextMedia = media,
      ): Promise<void> => {
        if (
          !isAuthenticated ||
          step < 4
        ) {
          return;
        }

        saveRequestedRef.current =
          false;

        /*
         * Serialize saves.
         * This avoids:
         *
         * PATCH v1
         * PATCH v1
         * PATCH v2
         *
         * finishing in the wrong order.
         */
        if (
          saveInFlightRef.current
        ) {
          saveRequestedRef.current =
            true;

          await saveInFlightRef.current;

          if (
            saveRequestedRef.current
          ) {
            return saveServerDraft(
              step,
              nextValues,
              nextMedia,
            );
          }

          return;
        }

        const execute =
          async () => {
            let draft =
              serverDraftRef.current;

            if (!draft?.id) {
              draft =
                await createServerDraft();
            }

            if (!draft?.id) {
              throw new Error(
                text(
                  locale,
                  'Draft belum siap disimpan.',
                  'The draft is not ready to be saved.',
                ),
              );
            }

            setSaveStatus(
              'saving',
            );

            let response =
              await authFetch(
                `/api/listing-drafts/${encodeURIComponent(
                  draft.id,
                )}`,
                {
                  method: 'PATCH',
                  headers: {
                    'Content-Type':
                      'application/json',
                  },
                  body:
                    JSON.stringify(
                      buildSavePayload(
                        step,
                        nextValues,
                        nextMedia,
                      ),
                    ),
                  },
              );

            let payload =
              await readResponseJson(
                response,
              );

            /*
             * One recovery attempt for
             * optimistic concurrency conflicts.
             */
            if (
              !response.ok &&
              isVersionConflict(
                response,
                payload,
              )
            ) {
              const reload =
                await authFetch(
                  `/api/listing-drafts/${encodeURIComponent(
                    draft.id,
                  )}`,
                  {
                    cache:
                      'no-store',
                  },
                );

              if (
                reload.ok
              ) {
                const reloadPayload =
                  await readResponseJson(
                    reload,
                  );

                const fresh =
                  valueAsRecord(
                    reloadPayload.draft,
                  ) as unknown as ServerDraft;

                if (
                  fresh.id
                ) {
                  syncServerDraftState(
                    fresh,
                  );

                  response =
                    await authFetch(
                      `/api/listing-drafts/${encodeURIComponent(
                        fresh.id,
                      )}`,
                      {
                        method:
                          'PATCH',
                        headers: {
                          'Content-Type':
                            'application/json',
                        },
                        body:
                          JSON.stringify(
                            buildSavePayload(
                              step,
                              nextValues,
                              nextMedia,
                            ),
                          ),
                      },
                    );

                  payload =
                    await readResponseJson(
                      response,
                    );
                }
              }
            }

            if (
              !response.ok
            ) {
              throw new Error(
                responseErrorMessage(
                  payload,
                  text(
                    locale,
                    'Draft belum berhasil disimpan.',
                    'The draft could not be saved.',
                  ),
                ),
              );
            }

            const nextDraft =
              valueAsRecord(
                payload.draft,
              ) as unknown as ServerDraft;

            if (
              nextDraft.id
            ) {
              syncServerDraftState(
                nextDraft,
              );
            } else {
              /*
               * Some APIs may return 204 or
               * a partial response.
               *
               * Keep the local draft version
               * when there is no returned draft.
               */
              const retained =
                serverDraftRef.current;

              if (
                retained
              ) {
                syncServerDraftState(
                  retained,
                );
              }
            }

            setSaveStatus(
              'saved',
            );

            setLastSavedAt(
              new Date().toISOString(),
            );
          };

        const promise =
          execute()
            .catch(error => {
              if (
                mountedRef.current
              ) {
                setSaveStatus(
                  navigator.onLine
                    ? 'error'
                    : 'offline',
                );
              }

              throw error;
            })
            .finally(() => {
              saveInFlightRef.current =
                null;
            });

        saveInFlightRef.current =
          promise;

        await promise;
      },
      [
        authFetch,
        buildSavePayload,
        createServerDraft,
        currentStep,
        isAuthenticated,
        locale,
        media,
        syncServerDraftState,
        values,
      ],
    );

  /*
   * Server autosave after the main-detail phase.
   *
   * Local storage remains immediate; server save is deliberately
   * delayed a little to avoid one API call per keystroke.
   */
  useEffect(() => {
    if (
      !hydrated ||
      pendingStoredDraft ||
      !isAuthenticated ||
      !draftOwnerId ||
      hydratedOwnerId !== draftOwnerId ||
      currentStep < 4 ||
      !serverDraftRef.current?.id
    ) {
      return;
    }

    setSaveStatus(
      navigator.onLine
        ? 'dirty'
        : 'offline',
    );

    if (
      autosaveTimer.current
    ) {
      clearTimeout(
        autosaveTimer.current,
      );
    }

    autosaveTimer.current =
      setTimeout(() => {
        void saveServerDraft().catch(
          () => undefined,
        );
      }, 900);

    return () => {
      if (
        autosaveTimer.current
      ) {
        clearTimeout(
          autosaveTimer.current,
        );
      }
    };
  }, [
    hydrated,
    hydratedOwnerId,
    draftOwnerId,
    pendingStoredDraft,
    isAuthenticated,
    currentStep,
    values,
    media,
    subcategorySlug,
    industryIds,
    saveServerDraft,
  ]);

  /*
   * Last chance local save.
   */
  useEffect(() => {
    const beforeUnload =
      () => {
        if (
          pendingStoredDraft ||
          !draftOwnerId ||
          hydratedOwnerId !== draftOwnerId
        ) {
          return;
        }

        writeTemporaryCreateDraft(
          draftOwnerId,
          {
            ...baseDraft,
            intent,
            categorySlug,
            subcategorySlug,
            industryIds,
            currentStep,
            formValues: values,
            media,
            draftId:
              serverDraftRef.current
                ?.id,
            draftVersion:
              draftVersionRef.current,
            updatedAt:
              new Date().toISOString(),
          },
        );
      };

    window.addEventListener(
      'beforeunload',
      beforeUnload,
    );

    return () =>
      window.removeEventListener(
        'beforeunload',
        beforeUnload,
      );
  }, [
    baseDraft,
    categorySlug,
    currentStep,
    draftOwnerId,
    hydratedOwnerId,
    industryIds,
    intent,
    media,
    pendingStoredDraft,
    subcategorySlug,
    values,
  ]);

  const setField = useCallback(
    (
      key: string,
      value: unknown,
    ) => {
      setValues(
        previous => ({
          ...previous,
          [key]: value,
        }),
      );

      setSaveStatus(
        'dirty',
      );
    },
    [],
  );

  const setLocationPoint =
    useCallback(
      (point: LatLng) => {
        setValues(
          previous => ({
            ...previous,
            location_lat:
              point.lat,
            location_lng:
              point.lng,
            latitude:
              point.lat,
            longitude:
              point.lng,
            lat:
              point.lat,
            lng:
              point.lng,
            location_point:
              point,
          }),
        );

        setSaveStatus(
          'dirty',
        );
      },
      [],
    );

  const setStructuredLocation =
    useCallback(
      (
        location: SelectedLocation | null,
        fieldKey?: string,
      ) => {
        setValues(
          previous => {
            const next = {
              ...previous,
            };

            if (!location) {
              delete next.location_structured;
              delete next.location_place_id;
              delete next.location_provider;
              delete next.location_lat;
              delete next.location_lng;
              delete next.latitude;
              delete next.longitude;
              delete next.lat;
              delete next.lng;
              delete next.location_point;

              return next;
            }

            const displayText =
              location.formattedAddress ||
              location.name;

            return {
              ...next,
              ...(fieldKey
                ? {
                    [fieldKey]:
                      displayText,
                  }
                : {}),
              location:
                displayText,
              location_structured:
                location,
              location_place_id:
                location.placeId,
              location_provider:
                location.provider ||
                'osm',
              location_lat:
                location.latitude,
              location_lng:
                location.longitude,
              latitude:
                location.latitude,
              longitude:
                location.longitude,
              lat:
                location.latitude,
              lng:
                location.longitude,
              location_point:
                {
                  lat:
                    location.latitude,
                  lng:
                    location.longitude,
                },
            };
          },
        );

        setSaveStatus(
          'dirty',
        );
      },
      [],
    );

  const validateStep =
    useCallback(
      (step: number): string => {
        if (
          step === 1 &&
          !intent
        ) {
          return text(
            locale,
            'Pilih dulu: mau menawarkan atau sedang mencari.',
            'Choose whether you want to offer something or request something.',
          );
        }

        if (
          step === 2 &&
          !categorySlug
        ) {
          return text(
            locale,
            'Pilih kategori dulu.',
            'Choose a category first.',
          );
        }

        if (
          step === 3 &&
          !subcategorySlug
        ) {
          return text(
            locale,
            'Pilih satu jenis yang paling sesuai.',
            'Choose the type that fits best.',
          );
        }

        const requiredFields =
          fieldSchema.filter(
            field =>
              field.step ===
                step &&
              field.required,
          );

        const missing =
          requiredFields.find(
            field => {
              if (
                field.type ===
                'toggle'
              ) {
                return false;
              }

              const value =
                values[
                  field.key
                ];

              if (
                Array.isArray(
                  value,
                )
              ) {
                return (
                  value.length === 0
                );
              }

              return (
                value ===
                  undefined ||
                value ===
                  null ||
                String(
                  value,
                ).trim() ===
                  ''
              );
            },
          );

        if (missing) {
          return text(
            locale,
            `Isi ${missing.labelId}.`,
            `Fill ${missing.labelEn}.`,
          );
        }

        const invalidLength = fieldSchema
          .filter(field => field.step === step)
          .find(field => {
            const value = values[field.key];
            if (typeof value !== 'string' || !value.trim()) return false;
            const length = value.trim().length;
            return Boolean(
              (field.validation?.minLength &&
                length < field.validation.minLength) ||
                (field.validation?.maxLength &&
                  length > field.validation.maxLength),
            );
          });

        if (invalidLength) {
          const length = String(values[invalidLength.key] || '').trim().length;
          const minimum = invalidLength.validation?.minLength;
          const maximum = invalidLength.validation?.maxLength;
          if (minimum && length < minimum) {
            return text(
              locale,
              `${invalidLength.labelId} minimal ${minimum} karakter.`,
              `${invalidLength.labelEn} must be at least ${minimum} characters.`,
            );
          }
          if (maximum && length > maximum) {
            return text(
              locale,
              `${invalidLength.labelId} maksimal ${maximum} karakter.`,
              `${invalidLength.labelEn} must be at most ${maximum} characters.`,
            );
          }
        }

        const locationField =
          requiredFields.find(
            field =>
              STRUCTURED_LOCATION_FIELD_KEYS.has(
                field.key,
              ),
          );

        if (
          locationField &&
          !readSelectedLocationFromValues(
            values,
          )
        ) {
          return text(
            locale,
            'Pilih lokasi dari hasil pencarian supaya alamat dan titik peta tersimpan dengan benar.',
            'Choose a location from the search results so the address and map point are saved correctly.',
          );
        }

        if (
          step === 6 &&
          requiresPrimaryImage &&
          media.filter(
            item =>
              item.status ===
              'uploaded',
          ).length === 0
        ) {
          return text(
            locale,
            'Tambahkan minimal satu foto produk atau referensi.',
            'Add at least one product or reference photo.',
          );
        }

        return '';
      },
      [
        categorySlug,
        fieldSchema,
        intent,
        locale,
        media,
        requiresPrimaryImage,
        subcategorySlug,
        values,
      ],
    );

  const ensureServerDraftForEditing =
    useCallback(
      async () => {
        if (
          serverDraftRef.current?.id
        ) {
          return serverDraftRef.current;
        }

        return createServerDraft();
      },
      [createServerDraft],
    );

  const goNext =
    useCallback(
      async () => {
        setError('');

        const message =
          validateStep(
            currentStep,
          );

        if (message) {
          setError(message);
          return;
        }

        if (
          currentStep === 3 &&
          isAuthenticated
        ) {
          try {
            await ensureServerDraftForEditing();
          } catch (
            caught
          ) {
            setError(
              safeErrorMessage(
                caught,
                locale,
                'Draft belum berhasil disiapkan. Data tetap tersimpan di perangkat.',
                'The server draft could not be prepared. Your data is still saved on this device.',
              ),
            );

            /*
             * Do not block the user.
             *
             * The local draft can continue.
             */
          }
        }

        if (
          currentStep >= 4 &&
          isAuthenticated &&
          serverDraftRef.current?.id
        ) {
          void saveServerDraft(
            currentStep,
          ).catch(
            () => undefined,
          );
        }

        setCurrentStep(step => {
          // Fast path: step 5 is optional detail. Keep it available via
          // "Tambah detail", but do not force every user through it.
          if (step === 4) return 6;
          return Math.min(STEP_COUNT, step + 1);
        });
      },
      [
        currentStep,
        ensureServerDraftForEditing,
        isAuthenticated,
        locale,
        saveServerDraft,
        validateStep,
      ],
    );

  const publishInFlightRef =
    useRef(false);

  const goBack = useCallback(() => {
    setCurrentStep(previous => {
      if (previous === 6) return 4;
      return Math.max(taxonomyLocked ? 4 : 1, previous - 1);
    });
  }, [taxonomyLocked]);

  const saveAndExit =
    useCallback(
      async () => {
        try {
          if (
            currentStep >= 3 &&
            isAuthenticated
          ) {
            await ensureServerDraftForEditing();
          }

          if (
            currentStep >= 4 &&
            isAuthenticated &&
            serverDraftRef.current
              ?.id
          ) {
            await saveServerDraft(
              currentStep,
              values,
              media,
            );
          }
        } catch (
          caught
        ) {
          if (
            navigator.onLine
          ) {
            setSaveStatus(
              'error',
            );
          } else {
            setSaveStatus(
              'offline',
            );
          }

          /*
           * We deliberately do NOT block the exit.
           * The local draft is already stored.
           */
        }

        router.push(
          `/${locale}/create/drafts`,
        );
      },
      [
        currentStep,
        ensureServerDraftForEditing,
        isAuthenticated,
        locale,
        media,
        router,
        saveServerDraft,
        values,
      ],
    );

  const uploadSelected =
    useCallback(
      async (
        files: FileList | null,
      ) => {
        if (
          !files?.length
        ) {
          return;
        }

        const selected =
          Array.from(
            files,
          )
            .filter(
              file =>
                ALLOWED_IMAGE_TYPES.has(
                  file.type,
                ),
            )
            .filter(
              file =>
                file.size <=
                MAX_UPLOAD_SIZE_BYTES,
            )
            .slice(
              0,
              MAX_UPLOAD_FILES,
            );

        if (
          !selected.length
        ) {
          setError(
            text(
              locale,
              'File harus berupa gambar JPG, PNG, WEBP, atau GIF dan maksimal 8 MB per foto.',
              'Files must be JPG, PNG, WEBP, or GIF images and no larger than 8 MB each.',
            ),
          );

          return;
        }

        if (
          selected.length <
          Math.min(
            files.length,
            MAX_UPLOAD_FILES,
          )
        ) {
          setError(
            text(
              locale,
              'Sebagian foto dilewati karena format, ukuran, atau jumlahnya tidak sesuai.',
              'Some photos were skipped because of their format, size, or total count.',
            ),
          );
        } else {
          setError('');
        }

        const incoming =
          selected.map(
            file => {
              const preview =
                URL.createObjectURL(
                  file,
                );

              localPreviewUrlsRef.current.add(
                preview,
              );

              return {
                id:
                  crypto.randomUUID(),
                name:
                  file.name,
                preview,
                status:
                  isAuthenticated
                    ? 'uploading'
                    : 'pending',
                file,
              };
            },
          );

        setMedia(
          previous => [
            ...previous,
            ...incoming.map(
              item =>
                ({
                  id:
                    item.id,
                  name:
                    item.name,
                  preview:
                    item.preview,
                  status:
                    item.status,
                }) as DraftMedia,
            ),
          ],
        );

        setSaveStatus(
          'dirty',
        );

        if (
          !isAuthenticated
        ) {
          return;
        }

        const form =
          new FormData();

        for (
          const item of incoming
        ) {
          form.append(
            'images',
            item.file,
          );
        }

        try {
          const response =
            await authFetch(
              '/api/content/upload-images',
              {
                method:
                  'POST',
                body: form,
              },
            );

          const payload =
            await readResponseJson(
              response,
            );

          if (
            !response.ok
          ) {
            throw new Error(
              responseErrorMessage(
                payload,
                text(
                  locale,
                  'Upload foto gagal.',
                  'Photo upload failed.',
                ),
              ),
            );
          }

          const rawUrls =
            Array.isArray(
              payload.urls,
            )
              ? payload.urls
              : Array.isArray(
                    payload.image_urls,
                  )
                ? payload.image_urls
                : Array.isArray(
                      payload.files,
                    )
                  ? payload.files
                      .map(
                        file =>
                          valueAsString(
                            valueAsRecord(
                              file,
                            ).url,
                          ),
                      )
                      .filter(
                        Boolean,
                      )
                  : [];

          const urls =
            rawUrls
              .map(
                value =>
                  normalizeContentMediaUrl(
                    value,
                  ),
              )
              .filter(
                (
                  value,
                ): value is string =>
                  Boolean(
                    value,
                  ),
              );

          setMedia(
            previous =>
              previous.map(
                item => {
                  const index =
                    incoming.findIndex(
                      upload =>
                        upload.id ===
                        item.id,
                    );

                  if (
                    index < 0
                  ) {
                    return item;
                  }

                  const uploadedUrl =
                    urls[index];

                  if (
                    uploadedUrl
                  ) {
                    return {
                      ...item,
                      url:
                        uploadedUrl,
                      preview:
                        uploadedUrl,
                      status:
                        'uploaded',
                      error:
                        undefined,
                    };
                  }

                  return {
                    ...item,
                    status:
                      'failed',
                    error:
                      text(
                        locale,
                        'Foto gagal diunggah.',
                        'Photo upload failed.',
                      ),
                  };
                },
              ),
          );

          setSaveStatus(
            'dirty',
          );
        } catch (
          caught
        ) {
          setMedia(
            previous =>
              previous.map(
                item =>
                  incoming.some(
                    upload =>
                      upload.id ===
                      item.id,
                  )
                    ? {
                        ...item,
                        status:
                          'failed',
                        error:
                          safeErrorMessage(
                            caught,
                            locale,
                            'Foto gagal diunggah.',
                            'Photo upload failed.',
                          ),
                      }
                    : item,
              ),
          );

          setSaveStatus(
            navigator.onLine
              ? 'error'
              : 'offline',
          );
        }
      },
      [
        authFetch,
        isAuthenticated,
        locale,
      ],
    );

  const removeMedia =
    useCallback(
      (mediaId: string) => {
        setMedia(
          previous => {
            const target =
              previous.find(
                item =>
                  item.id ===
                  mediaId,
              );

            if (
              target?.preview &&
              localPreviewUrlsRef.current.has(
                target.preview,
              )
            ) {
              try {
                URL.revokeObjectURL(
                  target.preview,
                );
              } catch {
                // Ignore.
              }

              localPreviewUrlsRef.current.delete(
                target.preview,
              );
            }

            return previous.filter(
              item =>
                item.id !==
                mediaId,
            );
          },
        );

        setSaveStatus(
          'dirty',
        );
      },
      [],
    );

  const generateListingCopy =
    useCallback(
      async () => {
        setAiCopyError('');

        if (
          !isAuthenticated
        ) {
          setAiCopyError(
            text(
              locale,
              'Masuk dulu untuk memakai bantuan AI.',
              'Sign in first to use AI assistance.',
            ),
          );
          return;
        }

        if (
          !intent ||
          !categorySlug ||
          !subcategorySlug
        ) {
          setAiCopyError(
            text(
              locale,
              'Pilih tujuan, kategori, dan jenis terlebih dahulu.',
              'Choose the purpose, category, and type first.',
            ),
          );
          return;
        }

        const filledContextCount =
          Object.entries(
            values,
          ).filter(
            ([key, value]) =>
              !GENERATED_COPY_FIELD_KEYS.has(
                key,
              ) &&
              hasMeaningfulValue(
                value,
              ),
          ).length;

        if (
          filledContextCount <
          2
        ) {
          setAiCopyError(
            text(
              locale,
              'Isi nama barang/jasa dan minimal satu detail utama dulu.',
              'Fill the item/service name and at least one main detail first.',
            ),
          );
          return;
        }

        setAiCopyLoading(
          true,
        );

        try {
          const response =
            await authFetch(
              '/api/ai/create-listing-copy',
              {
                method:
                  'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                body: JSON.stringify(
                  {
                    locale,
                    intent,
                    categorySlug,
                    subcategorySlug,
                    industryIds:
                      submissionIndustryIds(
                        industryIds,
                      ),
                    values,
                    fields:
                      fieldSchema.map(
                        field => ({
                          key:
                            field.key,
                          labelId:
                            field.labelId,
                          labelEn:
                            field.labelEn,
                        }),
                      ),
                  },
                ),
              },
            );

          const payload =
            (await readResponseJson(
              response,
            )) as ListingCopyAiResponse;

          if (
            !response.ok
          ) {
            throw new Error(
              responseErrorMessage(
                payload,
                text(
                  locale,
                  'AI belum bisa membuat judul dan ringkasan.',
                  'AI could not create the title and summary.',
                ),
              ),
            );
          }

          const nextValues = {
            ...values,
            ...(payload.title
              ? {
                  title:
                    payload.title,
                }
              : {}),
            ...(payload.summary
              ? {
                  summary:
                    payload.summary,
                }
              : {}),
          };

          setValues(
            nextValues,
          );

          setSaveStatus(
            'dirty',
          );

          if (
            serverDraftRef.current
              ?.id
          ) {
            void saveServerDraft(
              currentStep,
              nextValues,
              media,
            ).catch(
              () => undefined,
            );
          }
        } catch (
          caught
        ) {
          setAiCopyError(
            safeErrorMessage(
              caught,
              locale,
              'AI belum bisa membuat judul dan ringkasan.',
              'AI could not create the title and summary.',
            ),
          );
        } finally {
          setAiCopyLoading(
            false,
          );
        }
      },
      [
        authFetch,
        categorySlug,
        currentStep,
        fieldSchema,
        industryIds,
        intent,
        isAuthenticated,
        locale,
        media,
        saveServerDraft,
        subcategorySlug,
        values,
      ],
    );

  const publish =
    useCallback(
      async () => {
        if (publishInFlightRef.current) return;
        publishInFlightRef.current = true;
        setPublishing(true);

        try {
        setError('');

        for (
          let step = 1;
          step <= 8;
          step += 1
        ) {
          const message =
            validateStep(
              step,
            );

          if (message) {
            setCurrentStep(
              step,
            );
            setError(message);
            return;
          }
        }

        if (
          !isAuthenticated
        ) {
          setError(
            text(
              locale,
              'Masuk dulu untuk menerbitkan postingan.',
              'Sign in first to publish.',
            ),
          );
          return;
        }

        try {
          const draft =
            await ensureServerDraftForEditing();

          if (
            !draft?.id
          ) {
            throw new Error(
              text(
                locale,
                'Draft belum siap diterbitkan.',
                'The draft is not ready to publish.',
              ),
            );
          }

          await saveServerDraft(
            9,
            values,
            media,
          );

          const response =
            await authFetch(
              `/api/listing-drafts/${encodeURIComponent(
                draft.id,
              )}/publish`,
              {
                method:
                  'POST',
              },
            );

          const payload =
            await readResponseJson(
              response,
            );

          if (
            !response.ok
          ) {
            throw new Error(
              responseErrorMessage(
                payload,
                text(
                  locale,
                  'Postingan belum berhasil diterbitkan.',
                  'The post could not be published.',
                ),
              ),
            );
          }

          const listing =
            valueAsRecord(
              payload.listing,
            );

          const resourceId =
            valueAsString(
              listing.id,
            ) ||
            draft.id;

          const resourceSlug =
            valueAsString(
              listing.slug,
            ) ||
            resourceId;

          const resourceUrl =
            `/${locale}/content/${encodeURIComponent(
              resourceSlug,
            )}`;

          if (
            creationDraftId
          ) {
            await authFetch(
              `/api/creation-drafts/${encodeURIComponent(
                creationDraftId,
              )}/consume`,
              {
                method:
                  'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                body:
                  JSON.stringify(
                    {
                      resource_id:
                        resourceId,
                      resource_url:
                        resourceUrl,
                    },
                  ),
              },
            ).catch(
              () => undefined,
            );
          }

          clearTemporaryCreateDraft(draftOwnerId);

          const eventProperties = {
            category_slug: categorySlug,
            subcategory_slug: subcategorySlug,
            has_media: media.some(item => item.status === 'uploaded'),
            source: 'create_listing_wizard',
          };
          void trackLajukanEvent(
            intent === 'request' ? 'need.published' : 'offer.published',
            {
              entityType: 'listing',
              entityId: resourceId,
              page: resourceUrl,
              properties: eventProperties,
            },
          );
          if (intent === 'request') {
            void trackLajukanEvent('rfq.created', {
              entityType: 'listing',
              entityId: resourceId,
              page: resourceUrl,
              properties: eventProperties,
            });
          }

          router.push(
            resourceUrl,
          );
        } catch (
          caught
        ) {
          setError(
            safeErrorMessage(
              caught,
              locale,
              'Postingan belum berhasil diterbitkan.',
              'The post could not be published.',
            ),
          );
        }
        } finally {
          publishInFlightRef.current = false;
          setPublishing(false);
        }
      },
      [
        authFetch,
        categorySlug,
        creationDraftId,
        draftOwnerId,
        ensureServerDraftForEditing,
        isAuthenticated,
        locale,
        media,
        intent,
        router,
        saveServerDraft,
        validateStep,
        values,
        subcategorySlug,
      ],
    );

  const visibleSubcategories =
    useMemo(() => {
      const query =
        taxonomyQuery
          .trim()
          .toLowerCase();

      const filtered =
        query
          ? subcategories.filter(
              item =>
                labelFor(
                  locale,
                  item,
                )
                  .toLowerCase()
                  .includes(query) ||
                item.slug
                  .toLowerCase()
                  .includes(query),
            )
          : subcategories;

      return showAllTaxonomy
        ? filtered
        : filtered.slice(
            0,
            6,
          );
    }, [
      locale,
      showAllTaxonomy,
      subcategories,
      taxonomyQuery,
    ]);

  const visibleIndustries =
    useMemo(() => {
      const query =
        taxonomyQuery
          .trim()
          .toLowerCase();

      const filtered =
        query
          ? industries.filter(
              item =>
                labelFor(
                  locale,
                  item,
                )
                  .toLowerCase()
                  .includes(query) ||
                item.slug
                  .toLowerCase()
                  .includes(query),
            )
          : industries;

      return showAllTaxonomy
        ? filtered
        : filtered.slice(
            0,
            10,
          );
    }, [
      industries,
      locale,
      showAllTaxonomy,
      taxonomyQuery,
    ]);

  const selectedSubcategory =
    useMemo(
      () =>
        subcategories.find(
          item =>
            item.slug ===
            subcategorySlug,
        ),
      [
        subcategories,
        subcategorySlug,
      ],
    );

  const selectedIndustries =
    useMemo(
      () =>
        industries.filter(
          item =>
            industryIds.includes(
              item.slug,
            ),
        ),
      [
        industries,
        industryIds,
      ],
    );

  const pendingDraftCategory =
    useMemo(() => {
      if (
        !pendingStoredDraft?.categorySlug
      ) {
        return null;
      }

      const legacyId =
        categoryLegacyBySlug[
          pendingStoredDraft
            .categorySlug
        ];

      return legacyId
        ? getCreateBusinessCategoryById(
            legacyId,
          )
        : null;
    }, [
      pendingStoredDraft
        ?.categorySlug,
    ]);

  const pendingDraftTitle =
    pendingStoredDraft
      ? valueAsString(
          pendingStoredDraft
            .formValues
            .title,
        ) ||
        valueAsString(
          pendingStoredDraft
            .formValues
            .item_name,
        ) ||
        valueAsString(
          pendingStoredDraft
            .formValues
            .item_needed,
        ) ||
        valueAsString(
          pendingStoredDraft
            .formValues
            .service_name,
        ) ||
        valueAsString(
          pendingStoredDraft
            .formValues
            .service_needed,
        ) ||
        valueAsString(
          pendingStoredDraft
            .formValues
            .equipment_name,
        ) ||
        valueAsString(
          pendingStoredDraft
            .formValues
            .equipment_needed,
        ) ||
        valueAsString(
          pendingStoredDraft
            .formValues
            .place_name,
        ) ||
        valueAsString(
          pendingStoredDraft
            .formValues
            .place_needed,
        ) ||
        valueAsString(
          pendingStoredDraft
            .formValues
            .opportunity_name,
        ) ||
        valueAsString(
          pendingStoredDraft
            .formValues
            .opportunity_needed,
        ) ||
        text(
          locale,
          'Draft belum diberi judul',
          'Untitled draft',
        )
      : '';

  const pendingDraftIntentLabel =
    pendingStoredDraft?.intent ===
    'request'
      ? text(
          locale,
          'Sedang mencari',
          'Request',
        )
      : pendingStoredDraft?.intent ===
          'offer'
        ? text(
            locale,
            'Menawarkan',
            'Offer',
          )
        : text(
            locale,
            'Belum memilih tujuan',
            'Purpose not selected',
          );

  const previewKind:
    GlobalSearchItem['kind'] =
    intent === 'request'
      ? 'needs'
      : categorySlug ===
            'services' ||
          categorySlug ===
            'business-opportunities'
        ? 'services'
        : 'products';

  const requestDeadlineLabel =
    valueAsString(
      values.needed_by,
    ) ||
    valueAsString(
      values.target_done,
    ) ||
    valueAsString(
      values.target_move,
    );

  const requestPreviewMetadata:
    GlobalSearchItem['metadata'] =
    intent === 'request'
      ? {
          budget_label:
            requestBudgetLabel(
              locale,
              values,
            ),
          request_status:
            'open',
          quantity:
            valueAsString(
              values.quantity,
            ) || null,
          unit:
            valueAsString(
              values.unit,
            ) || null,
          needed_by:
            valueAsString(
              values.needed_by,
            ) || null,
          target_done:
            valueAsString(
              values.target_done,
            ) || null,
          target_move:
            valueAsString(
              values.target_move,
            ) || null,
          need_frequency:
            valueAsString(
              values.need_frequency,
            ) || null,
          provider_criteria:
            valueAsString(
              values.provider_criteria,
            ) || null,
          minimum_capacity:
            valueAsString(
              values.minimum_capacity,
            ) || null,
          required_facilities:
            valueAsStringList(
              values.required_facilities,
            ).join(', ') ||
            null,
          required_certifications:
            valueAsStringList(
              values.required_certifications,
            ).join(', ') ||
            null,
        }
      : {
          preview: true,
        };

  const previewItem:
    GlobalSearchItem = {
    id:
      serverDraftRef.current
        ?.id ||
      'preview',

    kind:
      previewKind,

    href: '',

    title:
      valueAsString(
        values.title,
      ) ||
      valueAsString(
        values.item_name,
      ) ||
      valueAsString(
        values.item_needed,
      ) ||
      valueAsString(
        values.service_name,
      ) ||
      valueAsString(
        values.service_needed,
      ) ||
      valueAsString(
        values.equipment_name,
      ) ||
      valueAsString(
        values.equipment_needed,
      ) ||
      valueAsString(
        values.place_name,
      ) ||
      valueAsString(
        values.place_needed,
      ) ||
      valueAsString(
        values.opportunity_name,
      ) ||
      valueAsString(
        values.opportunity_needed,
      ) ||
      text(
        locale,
        'Postingan baru',
        'New listing',
      ),

    summary:
      valueAsString(
        values.summary,
      ) ||
      text(
        locale,
        'Ringkasan akan tampil di sini.',
        'Your summary will appear here.',
      ),

    location:
      valueAsString(
        values.location,
      ) ||
      valueAsString(
        values.service_area,
      ) ||
      valueAsString(
        values.address,
      ) ||
      (intent ===
      'request'
        ? text(
            locale,
            'Area fleksibel',
            'Flexible area',
          )
        : text(
            locale,
            'Lokasi belum diisi',
            'Location not set',
          )),

    priceLabel:
      intent === 'request'
        ? requestBudgetLabel(
            locale,
            values,
          )
        : formatRupiahLabel(
              values.price_amount,
            ) ||
            text(
              locale,
              'Harga belum diisi',
              'Price not set',
            ),

    image:
      media.find(
        item =>
          item.url,
      )?.url ||
      media.find(
        item =>
          item.preview,
      )?.preview ||
      null,

    label: selectedSubcategory
      ? labelFor(
          locale,
          selectedSubcategory,
        )
      : category
        ? text(
            locale,
            category.titleId,
            category.titleEn,
          )
        : text(
            locale,
            'Postingan',
            'Listing',
          ),

    ownerName: '',

    verified: false,

    side:
      intent ===
      'request'
        ? 'demand'
        : 'supply',

    memberCount: null,

    viewCount: null,

    durationLabel:
      requestDeadlineLabel,

    metadata:
      requestPreviewMetadata,
  };

  const selectedLocationPoint =
    readLatLngFromValues(
      values,
    ) ||
    DEFAULT_CREATE_LOCATION_POINT;

  const quickMainFieldKeys = new Set([
    'title',
    'summary',
    'quantity',
    'unit',
    'price_amount',
    'price_mode',
    'budget_mode',
    'needed_by',
    'target_done',
    'target_move',
  ]);

  const stepFields =
    currentStep === 5
      ? fieldsForStep(fieldSchema, 5)
          .filter(field => showMoreDetails || field.group !== 'additional')
          .slice(0, showMoreDetails ? 12 : 5)
      : currentStep === 4
        ? orderMainStepFields(fieldsForStep(fieldSchema, 4))
            .filter(field => field.required || quickMainFieldKeys.has(field.key))
            .slice(0, 6)
        : currentStep === 7
          ? fieldsForStep(fieldSchema, 7).slice(0, 4)
          : currentStep === 8
            ? fieldsForStep(fieldSchema, 8).slice(0, 4)
            : [];

  const progressByStep = [
    10,
    22,
    34,
    48,
    60,
    72,
    82,
    92,
    100,
  ];

  const totalProgress =
    progressByStep[
      Math.max(
        0,
        Math.min(
          progressByStep.length - 1,
          currentStep - 1,
        ),
      )
    ] || 0;

  const friendlyStepTitle =
    currentStep === 1
      ? text(
          locale,
          'Kamu mau mencari atau menawarkan?',
          'Are you looking for something or offering something?',
        )
      : currentStep === 2
        ? intent === 'request'
          ? text(
              locale,
              'Apa yang sedang kamu cari?',
              'What are you looking for?',
            )
          : text(
              locale,
              'Apa yang ingin kamu tawarkan?',
              'What do you want to offer?',
            )
        : currentStep === 3
          ? text(
              locale,
              'Pilih jenis yang paling mirip',
              'Choose the closest type',
            )
          : currentStep === 4
            ? intent === 'request'
              ? text(
                  locale,
                  'Ceritakan kebutuhanmu',
                  'Tell us what you need',
                )
              : text(
                  locale,
                  'Ceritakan yang kamu tawarkan',
                  'Tell us what you are offering',
                )
            : currentStep === 5
              ? text(
                  locale,
                  'Tambahkan detail kalau ada',
                  'Add extra details if you have them',
                )
              : currentStep === 6
                ? intent === 'request'
                  ? text(
                      locale,
                      'Punya foto contoh?',
                      'Do you have a reference photo?',
                    )
                  : text(
                      locale,
                      'Tambahkan foto yang jelas',
                      'Add clear photos',
                    )
                : currentStep === 7
                  ? text(
                      locale,
                      'Lokasinya di mana?',
                      'Where is it located?',
                    )
                  : currentStep === 8
                    ? text(
                        locale,
                        'Bagaimana orang menghubungimu?',
                        'How should people contact you?',
                      )
                    : text(
                        locale,
                        'Sudah siap ditayangkan?',
                        'Ready to publish?',
                      );

  const friendlyStepDescription =
    currentStep === 1
      ? text(
          locale,
          'Pilih satu. Setelah itu Lajukan akan menyesuaikan pertanyaannya.',
          'Choose one. Lajukan will adapt the next questions for you.',
        )
      : currentStep === 2
        ? text(
            locale,
            'Tidak harus pas 100%. Pilih kategori yang paling mendekati kebutuhanmu.',
            'It does not have to be perfect. Choose the closest category.',
          )
        : currentStep === 3
          ? text(
              locale,
              'Cari dengan kata sederhana, misalnya “kemasan”, “foto produk”, “mesin”, atau “kios”.',
              'Search with simple words such as “packaging”, “product photo”, “machine”, or “kiosk”.',
            )
          : currentStep === 4
            ? intent === 'request'
              ? text(
                  locale,
                  'Tulis seperti sedang chat dengan supplier: apa yang dicari, jumlahnya, budget kalau ada, dan kapan dibutuhkan.',
                  'Write it like a message to a supplier: what you need, quantity, budget if any, and when you need it.',
                )
              : text(
                  locale,
                  'Tulis informasi yang paling penting supaya calon pembeli cepat paham apa yang kamu tawarkan.',
                  'Add the most important information so potential buyers quickly understand your offer.',
                )
            : currentStep === 5
              ? text(
                  locale,
                  'Bagian ini opsional. Kalau belum tahu, kamu boleh langsung lanjut.',
                  'This section is optional. You can continue if you are not sure yet.',
                )
              : currentStep === 6
                ? intent === 'request'
                  ? text(
                      locale,
                      'Boleh dilewati. Foto hanya membantu penyedia memahami contoh yang kamu maksud.',
                      'You can skip this. A photo only helps providers understand your reference.',
                    )
                  : text(
                      locale,
                      'Gunakan foto asli dan jelas. Foto pertama akan menjadi gambar utama.',
                      'Use clear original photos. The first photo becomes the cover.',
                    )
                : currentStep === 7
                  ? text(
                      locale,
                      'Cukup isi area yang relevan. Titik peta hanya diperlukan kalau lokasi tepatnya penting.',
                      'Add the relevant area. A map point is only needed when an exact location matters.',
                    )
                  : currentStep === 8
                    ? text(
                        locale,
                        'Isi kontak yang memang ingin kamu gunakan untuk menerima respons.',
                        'Add the contact method you actually want people to use.',
                      )
                    : text(
                        locale,
                        'Lihat tampilannya seperti yang akan dilihat orang lain. Kalau ada yang kurang, tekan Ubah.',
                        'Preview it as others will see it. Use Edit if something needs changing.',
                      );

  const hasRequiredInCurrentStep =
    stepFields.some(
      field => field.required,
    );

  const nextButtonLabel =
    currentStep === 9
      ? publishing
        ? text(locale, 'Menerbitkan...', 'Publishing...')
        : text(locale, 'Terbitkan', 'Publish')
      : currentStep === 6 && intent === 'request' && media.length === 0
        ? text(locale, 'Lewati foto', 'Skip photo')
        : currentStep === 8
          ? text(locale, 'Cek postingan', 'Review post')
          : text(locale, 'Lanjut', 'Next');

  function friendlyFieldCopy(
    field: ListingFieldSchema,
  ): {
    label?: string;
    help?: string;
  } {
    const copies: Record<
      string,
      {
        labelId: string;
        labelEn: string;
        helpId?: string;
        helpEn?: string;
      }
    > = {
      title: {
        labelId:
          intent === 'request'
            ? 'Judul kebutuhan'
            : 'Judul postingan',
        labelEn:
          intent === 'request'
            ? 'Request title'
            : 'Post title',
        helpId:
          intent === 'request'
            ? 'Contoh: Butuh supplier cup 16 oz, 1.000 pcs'
            : 'Contoh: Cup sealer otomatis siap kirim',
        helpEn:
          intent === 'request'
            ? 'Example: Need 1,000 pcs of 16 oz cups'
            : 'Example: Automatic cup sealer ready to ship',
      },
      summary: {
        labelId: 'Ringkasan singkat',
        labelEn: 'Short summary',
        helpId:
          'Cukup 1–2 kalimat. Tulis hal yang paling penting.',
        helpEn:
          'Keep it to 1–2 sentences with the most important details.',
      },
      body: {
        labelId: 'Keterangan lengkap',
        labelEn: 'Full details',
        helpId:
          'Tulis detail yang perlu diketahui sebelum orang menghubungimu.',
        helpEn:
          'Add the details people should know before contacting you.',
      },
      item_name: {
        labelId: 'Nama barang',
        labelEn: 'Item name',
      },
      item_needed: {
        labelId: 'Barang yang dicari',
        labelEn: 'Item needed',
      },
      service_name: {
        labelId: 'Nama jasa',
        labelEn: 'Service name',
      },
      service_needed: {
        labelId: 'Jasa yang dicari',
        labelEn: 'Service needed',
      },
      equipment_name: {
        labelId: 'Nama alat atau mesin',
        labelEn: 'Equipment or machine name',
      },
      equipment_needed: {
        labelId: 'Alat atau mesin yang dicari',
        labelEn: 'Equipment or machine needed',
      },
      place_name: {
        labelId: 'Nama tempat',
        labelEn: 'Place name',
      },
      place_needed: {
        labelId: 'Tempat yang dicari',
        labelEn: 'Place needed',
      },
      opportunity_name: {
        labelId: 'Nama peluang',
        labelEn: 'Opportunity name',
      },
      opportunity_needed: {
        labelId: 'Peluang yang dicari',
        labelEn: 'Opportunity needed',
      },
      quantity: {
        labelId: 'Jumlah yang dibutuhkan',
        labelEn: 'Quantity needed',
      },
      minimum_order: {
        labelId: 'Minimal pemesanan',
        labelEn: 'Minimum order',
      },
      unit: {
        labelId: 'Satuan',
        labelEn: 'Unit',
        helpId: 'Contoh: pcs, kg, box, hari, bulan.',
        helpEn: 'Example: pcs, kg, box, day, month.',
      },
      price_amount: {
        labelId:
          intent === 'request'
            ? 'Budget yang disiapkan'
            : 'Harga',
        labelEn:
          intent === 'request'
            ? 'Budget'
            : 'Price',
        helpId:
          intent === 'request'
            ? 'Kalau belum tahu, pilih opsi budget fleksibel bila tersedia.'
            : 'Masukkan harga yang paling umum digunakan.',
        helpEn:
          intent === 'request'
            ? 'If you are not sure, choose a flexible budget option when available.'
            : 'Enter the price you usually use.',
      },
      budget_mode: {
        labelId: 'Budget',
        labelEn: 'Budget',
      },
      price_mode: {
        labelId: 'Cara harga',
        labelEn: 'Pricing',
      },
      needed_by: {
        labelId: 'Dibutuhkan kapan?',
        labelEn: 'When do you need it?',
      },
      target_done: {
        labelId: 'Target selesai',
        labelEn: 'Target completion',
      },
      target_move: {
        labelId: 'Target mulai / pindah',
        labelEn: 'Target start / move',
      },
      need_frequency: {
        labelId: 'Seberapa sering dibutuhkan?',
        labelEn: 'How often is it needed?',
      },
      provider_criteria: {
        labelId: 'Kriteria penyedia',
        labelEn: 'Provider criteria',
        helpId:
          'Opsional. Contoh: area Bandung, bisa invoice, respons cepat.',
        helpEn:
          'Optional. Example: Bandung area, can provide invoices, fast response.',
      },
      minimum_capacity: {
        labelId: 'Kapasitas minimal',
        labelEn: 'Minimum capacity',
      },
      required_facilities: {
        labelId: 'Fasilitas yang dibutuhkan',
        labelEn: 'Required facilities',
      },
      required_certifications: {
        labelId: 'Sertifikasi yang dibutuhkan',
        labelEn: 'Required certifications',
      },
      location: {
        labelId: 'Lokasi / area',
        labelEn: 'Location / area',
        helpId:
          'Contoh: Bandung, Jakarta Selatan, atau bisa seluruh Indonesia.',
        helpEn:
          'Example: Bandung, South Jakarta, or nationwide.',
      },
      address: {
        labelId: 'Alamat',
        labelEn: 'Address',
      },
      service_area: {
        labelId: 'Area layanan',
        labelEn: 'Service area',
      },
      whatsapp: {
        labelId: 'Nomor WhatsApp',
        labelEn: 'WhatsApp number',
      },
      phone: {
        labelId: 'Nomor telepon',
        labelEn: 'Phone number',
      },
      contact_name: {
        labelId: 'Nama yang bisa dihubungi',
        labelEn: 'Contact name',
      },
    };

    const override =
      copies[field.key];

    return {
      label: override
        ? text(
            locale,
            override.labelId,
            override.labelEn,
          )
        : undefined,
      help:
        override?.helpId ||
        override?.helpEn
          ? text(
              locale,
              override.helpId || '',
              override.helpEn || '',
            )
          : undefined,
    };
  }

  function renderField(
    field: ListingFieldSchema,
  ) {
    const id =
      `create-${field.key}`;

    const friendlyCopy =
      friendlyFieldCopy(
        field,
      );

    const label =
      friendlyCopy.label ||
      text(
        locale,
        field.labelId,
        field.labelEn,
      );

    const help =
      friendlyCopy.help ||
      (field.helpId ||
      field.helpEn
        ? text(
            locale,
            field.helpId || '',
            field.helpEn || '',
          )
        : '');

    const common =
      'w-full rounded-[14px] border border-slate-200 bg-white px-3.5 py-3 text-[16px] font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 dark:placeholder:text-slate-500 sm:text-sm';

    const labelBlock = (
      <span
        id={`${id}-label`}
        className="block"
        title={help || undefined}
      >
        <span className="text-sm font-black text-slate-800 dark:text-slate-100">
          {label}
          {field.required ? (
            <span className="ml-1 text-red-600" aria-label={text(locale, 'Wajib', 'Required')}>
              *
            </span>
          ) : (
            <span className="ml-1.5 text-[11px] font-semibold text-slate-400">
              ({text(locale, 'opsional', 'optional')})
            </span>
          )}
        </span>
      </span>
    );

    const isStructuredLocationField =
      STRUCTURED_LOCATION_FIELD_KEYS.has(
        field.key,
      );

    const locationPoint =
      readLatLngFromValues(
        values,
      );

    const selectedLocation =
      readSelectedLocationFromValues(
        values,
      );

    const locationPickerControl =
      isStructuredLocationField ? (
        <button
          type="button"
          onClick={() => setMapPickerFieldKey(field.key)}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-bold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200"
        >
          <MapPin className="h-4 w-4" />
          {text(
            locale,
            locationPoint ? 'Ubah titik peta' : 'Pilih di peta',
            locationPoint ? 'Change map point' : 'Pick on map',
          )}
        </button>
      ) : null;

    if (
      isStructuredLocationField
    ) {
      return (
        <div
          key={field.key}
          className="space-y-2"
        >
          {labelBlock}

          <LocationAutocomplete
            value={
              selectedLocation
            }
            onChange={location =>
              setStructuredLocation(
                location,
                field.key,
              )
            }
            textValue={valueAsString(
              values[field.key],
            )}
            onTextChange={next =>
              setField(
                field.key,
                next,
              )
            }
            onSelect={location =>
              setStructuredLocation(
                location,
                field.key,
              )
            }
            placeholder={text(
              locale,
              field.placeholderId ||
                'Cari nama tempat, jalan, kecamatan, atau kota',
              field.placeholderEn ||
                'Search place, street, district, or city',
            )}
            helperText=""
            required={
              field.required
            }
            countryCode="ID"
            locationBias={
              locationPoint
            }
            localSuggestions={
              ownedStoreLocations
            }
            isId={
              locale === 'id'
            }
          />

          {locationPickerControl}
        </div>
      );
    }

    if (
      field.type ===
      'textarea'
    ) {
      return (
        <label
          key={field.key}
          className="block space-y-2"
        >
          {labelBlock}

          <textarea
            id={id}
            rows={4}
            required={
              field.required
            }
            className={cn(
              common,
              'min-w-0 resize-y',
            )}
            value={valueAsString(
              values[field.key],
            )}
            placeholder={text(
              locale,
              field.placeholderId ||
                '',
              field.placeholderEn ||
                '',
            )}
            onChange={event =>
              setField(
                field.key,
                event.target.value,
              )
            }
          />
        </label>
      );
    }

    if (
      field.type === 'radio'
    ) {
      const selected =
        normalizedOptionValues(
          field,
          values[field.key],
        )[0] || '';

      return (
        <div
          key={field.key}
          className="space-y-2"
        >
          {labelBlock}

          <div
            role="radiogroup"
            aria-labelledby={`${id}-label`}
            aria-required={
              field.required
            }
            className="flex flex-wrap gap-2"
          >
            {field.options?.map(
              option => {
                const active =
                  selected ===
                  option.value;

                return (
                  <button
                    key={
                      option.value
                    }
                    type="button"
                    role="radio"
                    aria-checked={
                      active
                    }
                    onClick={() =>
                      setField(
                        field.key,
                        option.value,
                      )
                    }
                    className={cn(
                      'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-left text-sm font-bold transition',
                      active
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
                    )}
                  >
                    {active ? (
                      <Check className="h-4 w-4 shrink-0" />
                    ) : null}

                    {text(
                      locale,
                      option.labelId,
                      option.labelEn,
                    )}
                  </button>
                );
              },
            )}
          </div>
        </div>
      );
    }

    if (
      field.type ===
      'multi-select'
    ) {
      const selected =
        normalizedOptionValues(
          field,
          values[field.key],
        );

      const knownValues =
        new Set(
          (
            field.options ||
            []
          ).map(
            option =>
              option.value,
          ),
        );

      const customValues =
        selected.filter(
          value =>
            !knownValues.has(
              value,
            ),
        );

      const customInput =
        customOptionInputs[
          field.key
        ] || '';

      const toggleOption =
        (value: string) => {
          setField(
            field.key,
            selected.includes(
              value,
            )
              ? selected.filter(
                  item =>
                    item !==
                    value,
                )
              : [
                  ...selected,
                  value,
                ],
          );
        };

      const addCustomOption =
        () => {
          const next =
            customInput.trim();

          if (!next) {
            return;
          }

          if (
            !selected.includes(
              next,
            )
          ) {
            setField(
              field.key,
              [
                ...selected,
                next,
              ],
            );
          }

          setCustomOptionInputs(
            previous => ({
              ...previous,
              [field.key]:
                '',
            }),
          );
        };

      return (
        <div
          key={field.key}
          className="space-y-2"
        >
          {labelBlock}

          <div
            role="group"
            aria-labelledby={`${id}-label`}
            className="flex flex-wrap gap-2"
          >
            {field.options?.map(
              option => {
                const active =
                  selected.includes(
                    option.value,
                  );

                return (
                  <button
                    key={
                      option.value
                    }
                    type="button"
                    aria-pressed={
                      active
                    }
                    onClick={() =>
                      toggleOption(
                        option.value,
                      )
                    }
                    className={cn(
                      'inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-bold transition',
                      active
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
                    )}
                  >
                    {active ? (
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    ) : null}

                    {text(
                      locale,
                      option.labelId,
                      option.labelEn,
                    )}
                  </button>
                );
              },
            )}
          </div>

          {customValues.length >
          0 ? (
            <div className="flex flex-wrap gap-2">
              {customValues.map(
                value => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      toggleOption(
                        value,
                      )
                    }
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {value}
                    <X className="h-3.5 w-3.5" />
                  </button>
                ),
              )}
            </div>
          ) : null}

          {field.allowCustomOption ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={
                  customInput
                }
                onChange={event =>
                  setCustomOptionInputs(
                    previous => ({
                      ...previous,
                      [field.key]:
                        event.target.value,
                    }),
                  )
                }
                onKeyDown={event => {
                  if (
                    event.key !==
                    'Enter'
                  ) {
                    return;
                  }

                  event.preventDefault();
                  addCustomOption();
                }}
                placeholder={text(
                  locale,
                  'Tambahkan pilihan lain',
                  'Add another option',
                )}
                className={common}
              />

              <button
                type="button"
                onClick={
                  addCustomOption
                }
                disabled={
                  !customInput.trim()
                }
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-900"
                aria-label={text(
                  locale,
                  'Tambahkan',
                  'Add',
                )}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      );
    }

    if (
      field.type ===
      'select'
    ) {
      return (
        <label
          key={field.key}
          className="block space-y-2"
        >
          {labelBlock}

          <select
            id={id}
            required={
              field.required
            }
            className={common}
            value={valueAsString(
              values[field.key],
            )}
            onChange={event =>
              setField(
                field.key,
                event.target.value,
              )
            }
          >
            <option value="">
              {text(
                locale,
                'Pilih salah satu',
                'Choose one',
              )}
            </option>

            {field.options?.map(
              option => (
                <option
                  key={
                    option.value
                  }
                  value={
                    option.value
                  }
                >
                  {text(
                    locale,
                    option.labelId,
                    option.labelEn,
                  )}
                </option>
              ),
            )}
          </select>
        </label>
      );
    }

    if (
      field.type ===
      'toggle'
    ) {
      return (
        <label
          key={field.key}
          className="flex min-h-[60px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-900"
        >
          {labelBlock}

          <input
            type="checkbox"
            className="peer sr-only"
            checked={valueAsBool(
              values[field.key],
            )}
            onChange={event =>
              setField(
                field.key,
                event.target
                  .checked,
              )
            }
          />

          <span className="relative h-7 w-12 shrink-0 rounded-full bg-slate-300 transition after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500 peer-focus-visible:ring-offset-2 dark:bg-slate-700" />
        </label>
      );
    }

    if (
      field.type ===
      'currency'
    ) {
      return (
        <label
          key={field.key}
          className="block space-y-2"
        >
          {labelBlock}

          <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white text-sm text-slate-900 transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50">
            <span className="shrink-0 border-r border-slate-200 px-3.5 py-3 font-bold text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Rp
            </span>

            <input
              id={id}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              required={
                field.required
              }
              className="min-w-0 flex-1 bg-transparent px-3.5 py-3 outline-none"
              value={formatRupiahNumber(
                values[field.key],
              )}
              placeholder="0"
              onChange={event =>
                setField(
                  field.key,
                  parseRupiahInput(
                    event.target.value,
                  ),
                )
              }
            />
          </div>
        </label>
      );
    }

    if (
      field.key ===
        'minimum_order' ||
      field.key ===
        'quantity'
    ) {
      const unit =
        valueAsString(
          values.unit,
        );

      return (
        <label
          key={field.key}
          className="block space-y-2"
        >
          {labelBlock}

          <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50">
            <input
              id={id}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              required={
                field.required
              }
              className="min-w-0 flex-1 bg-transparent px-3.5 py-3 outline-none"
              value={valueAsString(
                values[field.key],
              )}
              placeholder={text(
                locale,
                'Contoh: 5',
                'Example: 5',
              )}
              onChange={event =>
                setField(
                  field.key,
                  numericQuantityInput(
                    event.target.value,
                  ),
                )
              }
            />

            <span
              className={cn(
                'shrink-0 border-l border-slate-200 px-3.5 py-3 text-xs font-bold dark:border-slate-700',
                unit
                  ? 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
              )}
            >
              {unit ||
                text(
                  locale,
                  'pilih satuan',
                  'choose unit',
                )}
            </span>
          </div>
        </label>
      );
    }

    if (
      field.type ===
        'number' &&
      (field.suffixId ||
        field.suffixEn)
    ) {
      return (
        <label
          key={field.key}
          className="block space-y-2"
        >
          {labelBlock}

          <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50">
            <input
              id={id}
              type="number"
              inputMode="decimal"
              required={
                field.required
              }
              min={
                field.validation
                  ?.min
              }
              max={
                field.validation
                  ?.max
              }
              className="min-w-0 flex-1 bg-transparent px-3.5 py-3 outline-none"
              value={valueAsString(
                values[field.key],
              )}
              placeholder={text(
                locale,
                field.placeholderId ||
                  '',
                field.placeholderEn ||
                  '',
              )}
              onChange={event =>
                setField(
                  field.key,
                  event.target
                    .value ===
                    ''
                    ? undefined
                    : Number(
                        event.target
                          .value,
                      ),
                )
              }
            />

            <span className="shrink-0 border-l border-slate-200 bg-slate-50 px-3.5 py-3 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {text(
                locale,
                field.suffixId ||
                  '',
                field.suffixEn ||
                  '',
              )}
            </span>
          </div>
        </label>
      );
    }

    return (
      <label
        key={field.key}
        className="block space-y-2"
      >
        {labelBlock}

        <input
          id={id}
          required={
            field.required
          }
          type={
            field.type ===
            'date'
              ? 'date'
              : field.type ===
                  'number'
                ? 'number'
                : 'text'
          }
          className={common}
          value={valueAsString(
            values[field.key],
          )}
          placeholder={text(
            locale,
            field.placeholderId ||
              '',
            field.placeholderEn ||
              '',
          )}
          onChange={event =>
            setField(
              field.key,
              field.type ===
                'number'
                ? event.target
                    .value ===
                  ''
                  ? undefined
                  : Number(
                      event.target
                        .value,
                    )
                : event.target
                    .value,
            )
          }
        />
      </label>
    );
  }

  function renderFieldGridItem(
    field: ListingFieldSchema,
  ) {
    const shouldSpan =
      field.type ===
        'textarea' ||
      field.type ===
        'multi-select' ||
      field.type ===
        'radio' ||
      STRUCTURED_LOCATION_FIELD_KEYS.has(
        field.key,
      );

    return (
      <div
        key={field.key}
        className={cn(
          shouldSpan &&
            'lg:col-span-2',
        )}
      >
        {renderField(field)}
      </div>
    );
  }



  if (!hydrated) {
    return (
      <main className="mx-auto flex min-h-[60vh] items-center justify-center px-4">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
      </main>
    );
  }

  return (
    <main
      className={cn(
        'min-h-screen bg-transparent text-slate-950 dark:text-slate-50',
        currentStep > 1
          ? 'pb-32 lg:pb-28'
          : 'pb-10',
      )}
    >
      <div className="mx-auto w-full max-w-[980px]">
        {/* Compact progress: glanceable, no reading required */}
        <div className="mb-3">
          <div className="mb-2 flex items-center justify-between gap-3 px-0.5">
            <span className="text-sm font-black text-slate-900 dark:text-white">
              {text(locale, 'Buat postingan', 'Create post')}
            </span>
            <span className="text-[11px] font-bold tabular-nums text-slate-400">
              {Math.round(totalProgress)}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-600 transition-[width] duration-300"
              style={{ width: `${totalProgress}%` }}
            />
          </div>
        </div>

        {/* Main card */}
        <section
          className={cn(
            'rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5',
            currentStep === 9
              ? ''
              : 'mx-auto max-w-[820px]',
          )}
        >
          <header className="mb-4">
            <h1 className="text-xl font-black tracking-tight text-slate-950 dark:text-white sm:text-2xl">
              {friendlyStepTitle}
            </h1>
            <p className="mt-1.5 text-sm font-medium leading-5 text-slate-600 dark:text-slate-300">
              {friendlyStepDescription}
            </p>
            {hasRequiredInCurrentStep ? (
              <span className="sr-only">
                {text(locale, 'Tanda bintang berarti wajib diisi.', 'An asterisk marks required fields.')}
              </span>
            ) : null}
          </header>

          {error ? (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {/* STEP 1 */}
          {currentStep === 1 ? (
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {[
                {
                  value: 'request' as const,
                  titleId: 'Cari kebutuhan',
                  titleEn: 'Find something',
                  shortId: 'Saya butuh barang / jasa',
                  shortEn: 'I need a product / service',
                  imageSrc: '/images/create/kategori/cari.png',
                },
                {
                  value: 'offer' as const,
                  titleId: 'Tawarkan sesuatu',
                  titleEn: 'Offer something',
                  shortId: 'Saya punya barang / jasa',
                  shortEn: 'I offer a product / service',
                  imageSrc: '/images/create/kategori/tawar.png',
                },
              ].map(item => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setIntent(item.value);
                    setCurrentStep(2);
                    setError('');
                    setSaveStatus('dirty');
                  }}
                  className={cn(
                    'group flex min-h-[150px] flex-col items-center justify-center rounded-2xl border p-3 text-center transition active:scale-[0.98] sm:min-h-[170px] sm:p-4',
                    intent === item.value
                      ? 'border-emerald-600 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-950/35'
                      : 'border-slate-200 bg-white hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-900',
                  )}
                >
                  <Image
                    src={item.imageSrc}
                    alt=""
                    width={88}
                    height={88}
                    className="h-16 w-16 rounded-full object-cover shadow-sm sm:h-20 sm:w-20"
                    draggable={false}
                  />
                  <p className="mt-3 text-sm font-black sm:text-base">
                    {text(locale, item.titleId, item.titleEn)}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 sm:text-xs">
                    {text(locale, item.shortId, item.shortEn)}
                  </p>
                </button>
              ))}
            </div>
          ) : null}

          {/* STEP 2 */}
          {currentStep === 2 ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
              {CREATE_BUSINESS_CATEGORIES.map(item => {
                const visual = getCreateBusinessCategoryImage(item.id);
                const selected = categorySlug === item.slugEn;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setCategorySlug(item.slugEn);
                      setSubcategorySlug(undefined);
                      setTaxonomyQuery('');
                      setShowAllTaxonomy(false);
                      setShowIndustryChoices(false);
                      setCurrentStep(3);
                      setError('');
                    }}
                    className={cn(
                      'group flex min-h-[118px] flex-col items-center justify-center rounded-2xl border p-3 text-center transition active:scale-[0.98] sm:min-h-[132px]',
                      selected
                        ? 'border-emerald-600 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-950/30'
                        : 'border-slate-200 bg-white hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-900',
                    )}
                  >
                    <span
                      className={cn(
                        'relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border shadow-sm',
                        visual.containerClassName,
                      )}
                    >
                      <span
                        className="absolute aspect-square"
                        style={{
                          width: visual.imageSize,
                          right: visual.offsetX + 6,
                          bottom: visual.offsetY + 6,
                          transform: `scaleX(${visual.flip ? -1 : 1}) scale(${visual.scale}) rotate(${visual.rotate}deg)`,
                        }}
                      >
                        <Image
                          src={visual.src}
                          alt=""
                          width={visual.imageSize}
                          height={visual.imageSize}
                          className="h-full w-full object-contain"
                          draggable={false}
                        />
                      </span>
                    </span>
                    <p className="mt-2 line-clamp-2 text-xs font-black leading-4 sm:text-sm">
                      {text(locale, item.titleId, item.titleEn)}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* STEP 3 */}
          {currentStep === 3 ? (
            <div className="mx-auto max-w-2xl space-y-3">
              <div className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  autoFocus
                  className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold outline-none placeholder:text-slate-400 sm:text-sm"
                  value={taxonomyQuery}
                  onChange={event => setTaxonomyQuery(event.target.value)}
                  placeholder={text(locale, 'Cari: kemasan, desain, mesin, kios...', 'Search: packaging, design, machine, kiosk...')}
                />
                {taxonomyQuery ? (
                  <button
                    type="button"
                    onClick={() => setTaxonomyQuery('')}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                    aria-label={text(locale, 'Hapus pencarian', 'Clear search')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              {taxonomyLoading ? (
                <div className="flex items-center justify-center gap-2 py-5 text-sm font-semibold text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {text(locale, 'Memuat...', 'Loading...')}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {visibleSubcategories.map(item => {
                    const selected = subcategorySlug === item.slug;
                    return (
                      <button
                        key={item.slug}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setSubcategorySlug(item.slug);
                          setError('');
                          setSaveStatus('dirty');
                        }}
                        className={cn(
                          'min-h-[52px] rounded-xl border px-3 py-2.5 text-left text-xs font-black leading-4 transition active:scale-[0.98] sm:text-sm',
                          selected
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-50'
                            : 'border-slate-200 bg-white hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-900',
                        )}
                      >
                        {labelFor(locale, item)}
                      </button>
                    );
                  })}
                </div>
              )}

              {visibleSubcategories.length === 0 && !taxonomyLoading ? (
                <button
                  type="button"
                  onClick={() => { setTaxonomyQuery(''); setShowAllTaxonomy(true); }}
                  className="w-full rounded-xl border border-dashed border-slate-300 px-4 py-4 text-sm font-black text-emerald-700 dark:border-slate-700 dark:text-emerald-300"
                >
                  {text(locale, 'Lihat semua jenis', 'View all types')}
                </button>
              ) : null}
            </div>
          ) : null}

          {/* STEPS 4, 5, 7, 8 */}
          {[4, 5, 7, 8].includes(
            currentStep,
          ) ? (
            <div className="mx-auto max-w-2xl space-y-4">
              <div className="space-y-4">
                {stepFields.map(renderFieldGridItem)}
              </div>

              {currentStep === 4 ? (
                <div className="space-y-2 pt-1">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void generateListingCopy()}
                      disabled={aiCopyLoading}
                      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 px-3 text-xs font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {aiCopyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-emerald-600" />}
                      {text(locale, 'Rapikan otomatis', 'Polish automatically')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(5)}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-slate-200 px-3 text-xs font-black text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {text(locale, 'Tambah detail', 'Add details')}
                    </button>
                  </div>
                  {aiCopyError ? (
                    <p role="alert" className="text-xs font-semibold text-red-600 dark:text-red-300">
                      {aiCopyError}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {currentStep === 5 && !showMoreDetails ? (
                <button
                  type="button"
                  onClick={() => setShowMoreDetails(true)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 px-3 text-xs font-black text-slate-600 dark:border-slate-700 dark:text-slate-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {text(locale, 'Lihat detail lain', 'Show more details')}
                </button>
              ) : null}


            </div>
          ) : null}

          {/* STEP 6 */}
          {currentStep ===
          6 ? (
            <div className="mx-auto max-w-2xl space-y-4">
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                <div className="text-center">
                  <Images className="mx-auto mb-2 h-7 w-7 text-emerald-600" />

                  <p className="text-sm font-black">
                    {text(
                      locale,
                      requiresPrimaryImage
                        ? 'Tambahkan foto'
                        : 'Foto referensi (opsional)',
                      requiresPrimaryImage
                        ? 'Add photos'
                        : 'Reference photos (optional)',
                    )}
                  </p>


                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white shadow-sm">
                    <Images className="h-4 w-4" />

                    {text(
                      locale,
                      'Pilih foto',
                      'Choose photos',
                    )}

                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      multiple
                      className="sr-only"
                      onChange={event => {
                        void uploadSelected(
                          event.target.files,
                        );

                        event.currentTarget.value =
                          '';
                      }}
                    />
                  </label>

                  <label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                    <Camera className="h-4 w-4" />

                    {text(
                      locale,
                      'Ambil foto',
                      'Take photo',
                    )}

                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      onChange={event => {
                        void uploadSelected(
                          event.target.files,
                        );

                        event.currentTarget.value =
                          '';
                      }}
                    />
                  </label>
                </div>

                <p className="mt-3 text-center text-[11px] font-semibold text-slate-500">
                  {text(
                    locale,
                    'Maksimal 8 foto, masing-masing 8 MB.',
                    'Up to 8 photos, 8 MB each.',
                  )}
                </p>
              </div>

              {media.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {media.map(
                    item => (
                      <article
                        key={
                          item.id
                        }
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div className="relative aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-800">
                          {item.preview ||
                          item.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={
                                item.preview ||
                                item.url
                              }
                              alt={
                                item.name ||
                                ''
                              }
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Images className="h-7 w-7 text-slate-400" />
                            </div>
                          )}

                          {item.status ===
                          'uploading' ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-slate-900">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {text(
                                  locale,
                                  'Mengunggah...',
                                  'Uploading...',
                                )}
                              </span>
                            </div>
                          ) : null}
                        </div>

                        <div className="flex items-center justify-between gap-2 p-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">
                              {item.name ||
                                text(
                                  locale,
                                  'Foto',
                                  'Photo',
                                )}
                            </p>

                            <p
                              className={cn(
                                'mt-0.5 text-[10px] font-semibold',
                                item.status ===
                                  'failed'
                                  ? 'text-red-600'
                                  : item.status ===
                                      'uploaded'
                                    ? 'text-emerald-600'
                                    : 'text-slate-400',
                              )}
                            >
                              {item.error ||
                                (item.status ===
                                'uploaded'
                                  ? text(
                                      locale,
                                      'Siap',
                                      'Ready',
                                    )
                                  : item.status ===
                                      'uploading'
                                    ? text(
                                        locale,
                                        'Mengunggah',
                                        'Uploading',
                                      )
                                    : item.status)}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeMedia(
                                item.id,
                              )
                            }
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-300"
                            aria-label={text(
                              locale,
                              'Hapus foto',
                              'Remove photo',
                            )}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </article>
                    ),
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* STEP 9 */}
          {currentStep === 9 ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/25">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                      <Check className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-emerald-950 dark:text-emerald-50">
                        {text(
                          locale,
                          'Hampir selesai',
                          'Almost done',
                        )}
                      </p>
                      <p className="mt-1 text-sm font-medium leading-6 text-emerald-900 dark:text-emerald-100">
                        {text(
                          locale,
                          'Cek bagian penting di bawah. Kalau sudah benar, postingan bisa langsung diterbitkan.',
                          'Check the important sections below. If everything is correct, you can publish immediately.',
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    {
                      label: text(
                        locale,
                        'Isi utama',
                        'Main information',
                      ),
                      description: text(
                        locale,
                        'Judul, ringkasan, jumlah, harga atau budget.',
                        'Title, summary, quantity, price or budget.',
                      ),
                      targetStep: 4,
                      icon: FileText,
                    },
                    {
                      label: text(
                        locale,
                        'Detail tambahan',
                        'Extra details',
                      ),
                      description: text(
                        locale,
                        'Syarat, spesifikasi, jadwal, atau detail pendukung.',
                        'Requirements, specifications, schedule, or supporting details.',
                      ),
                      targetStep: 5,
                      icon: Plus,
                    },
                    {
                      label:
                        intent === 'request'
                          ? text(
                              locale,
                              'Foto referensi',
                              'Reference photos',
                            )
                          : text(
                              locale,
                              'Foto',
                              'Photos',
                            ),
                      description:
                        intent === 'request'
                          ? text(
                              locale,
                              'Opsional, untuk membantu penyedia memahami kebutuhan.',
                              'Optional, to help providers understand the request.',
                            )
                          : text(
                              locale,
                              'Foto yang akan dilihat calon pembeli.',
                              'Photos potential buyers will see.',
                            ),
                      targetStep: 6,
                      icon: Images,
                    },
                    {
                      label: text(
                        locale,
                        'Lokasi',
                        'Location',
                      ),
                      description: text(
                        locale,
                        'Kota, area layanan, alamat, atau titik lokasi.',
                        'City, service area, address, or map point.',
                      ),
                      targetStep: 7,
                      icon: MapPin,
                    },
                    {
                      label: text(
                        locale,
                        'Kontak',
                        'Contact',
                      ),
                      description: text(
                        locale,
                        'Cara orang menghubungimu setelah tertarik.',
                        'How people can contact you after they are interested.',
                      ),
                      targetStep: 8,
                      icon: Save,
                    },
                  ].map(item => {
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.targetStep}
                        type="button"
                        onClick={() =>
                          setCurrentStep(
                            item.targetStep,
                          )
                        }
                        className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-emerald-950/15"
                      >
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-700 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-emerald-950/40 dark:group-hover:text-emerald-300">
                          <Icon className="h-4 w-4" />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-black text-slate-900 dark:text-white">
                            {item.label}
                          </span>
                          <span className="mt-0.5 block text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                            {item.description}
                          </span>
                        </span>

                        <span className="shrink-0 text-xs font-black text-emerald-700 dark:text-emerald-300">
                          {text(
                            locale,
                            'Ubah',
                            'Edit',
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="min-w-0">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  {text(
                    locale,
                    'Begini tampilannya',
                    'Preview',
                  )}
                </p>

                {previewItem.kind === 'needs' ? (
                  <NeedSearchCard
                    item={previewItem}
                    locale={locale}
                    interactive={false}
                  />
                ) : previewItem.kind === 'services' ? (
                  <ServiceSearchCard
                    item={previewItem}
                    locale={locale}
                    interactive={false}
                  />
                ) : (
                  <ProductSearchCard
                    item={previewItem}
                    locale={locale}
                    interactive={false}
                  />
                )}
              </div>
            </div>
          ) : null}

          {/* Save state: baru ditampilkan saat pengguna mulai mengisi detail */}
          {currentStep >= 4 ? (
            <div className="mt-6 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {saveStatus ===
            'saving' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saveStatus ===
                'saved' ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : null}

            <span>
              {saveStatus ===
              'saving'
                ? text(
                    locale,
                    'Menyimpan...',
                    'Saving...',
                  )
                : saveStatus ===
                    'offline'
                  ? text(
                      locale,
                      'Tersimpan di perangkat. Akan dicoba lagi saat online.',
                      'Saved on this device. We will retry when online.',
                    )
                  : saveStatus ===
                      'error'
                    ? text(
                        locale,
                        'Ada masalah saat menyimpan ke server. Data di perangkat tetap aman.',
                        'There was a server save problem. Your local data is still safe.',
                      )
                    : lastSavedAt
                      ? text(
                          locale,
                          'Tersimpan',
                          'Saved',
                        )
                      : text(
                          locale,
                          'Tersimpan di perangkat',
                          'Saved on this device',
                        )}
            </span>
            </div>
          ) : null}
        </section>
      </div>

      {/* Existing local draft chooser */}
      {pendingStoredDraft ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/50 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-draft-choice-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-950 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <FileText className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <h2
                  id="create-draft-choice-title"
                  className="text-lg font-black"
                >
                  {text(
                    locale,
                    'Ada postingan yang belum selesai',
                    'You have an unfinished post',
                  )}
                </h2>

                <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
                  {text(
                    locale,
                    'Kamu bisa lanjut dari terakhir disimpan, atau mulai postingan baru.',
                    'Continue from the last saved point, or start a new post.',
                  )}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-900">
              <p className="font-black">
                {pendingDraftTitle}
              </p>

              <div className="mt-2 space-y-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <p>
                  {
                    pendingDraftIntentLabel
                  }
                  {pendingDraftCategory
                    ? ` • ${text(
                        locale,
                        pendingDraftCategory.titleId,
                        pendingDraftCategory.titleEn,
                      )}`
                    : ''}
                </p>

                <p>
                  {text(
                    locale,
                    'Progres tersimpan',
                    'Saved progress',
                  )}{' '}
                  {Math.min(
                    100,
                    Math.max(
                      10,
                      Math.round(
                        (pendingStoredDraft.currentStep /
                          STEP_COUNT) *
                          100,
                      ),
                    ),
                  )}
                  %
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={
                  continueStoredDraft
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white"
              >
                <Check className="h-4 w-4" />
                {text(
                  locale,
                  'Lanjutkan postingan',
                  'Continue post',
                )}
              </button>

              <button
                type="button"
                onClick={
                  startFreshDraft
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-black text-red-700 dark:border-red-900/70 dark:text-red-300"
              >
                <Trash2 className="h-4 w-4" />
                {text(
                  locale,
                  'Mulai dari awal',
                  'Start from scratch',
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Map dialog */}
      {mapPickerFieldKey ? (
        <div
          className="fixed inset-0 z-[120000] flex items-stretch justify-center bg-black/60 backdrop-blur-[2px] sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-map-picker-title"
        >
          <div className="relative z-[1] flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-950 sm:h-[min(92vh,860px)] sm:max-w-6xl sm:rounded-[28px]">
            <div className="relative z-[3] flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <h2
                  id="create-map-picker-title"
                  className="text-base font-black sm:text-lg"
                >
                  {text(
                    locale,
                    'Pilih lokasi',
                    'Choose location',
                  )}
                </h2>

                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {text(
                    locale,
                    'Cari alamat atau pilih lokasi usaha yang sudah terdaftar.',
                    'Search an address or choose one of your registered business locations.',
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setMapPickerFieldKey(
                    null,
                  )
                }
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                aria-label={text(
                  locale,
                  'Tutup',
                  'Close',
                )}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative min-h-0 flex-1 bg-slate-100 dark:bg-slate-900">
              <UmkmLocationPicker
                value={
                  selectedLocationPoint
                }
                onChange={
                  setLocationPoint
                }
                isId={
                  locale ===
                  'id'
                }
                localSuggestions={
                  ownedStoreLocations
                }
                selectedLocation={readSelectedLocationFromValues(
                  values,
                )}
                onLocationChange={location =>
                  setStructuredLocation(
                    location,
                    mapPickerFieldKey ||
                      undefined,
                  )
                }
                markerLabel={text(
                  locale,
                  'Lokasi postingan',
                  'Listing location',
                )}
                className="h-full rounded-none border-0 shadow-none [&_.leaflet-container]:!h-full [&_.leaflet-container]:!min-h-[360px] sm:[&_.leaflet-container]:!min-h-[520px]"
              />
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {text(
                  locale,
                  'Pastikan pin berada di lokasi yang benar.',
                  'Make sure the pin is in the correct place.',
                )}
              </p>

              <button
                type="button"
                onClick={() =>
                  setMapPickerFieldKey(
                    null,
                  )
                }
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-black text-white"
              >
                {text(
                  locale,
                  'Gunakan lokasi',
                  'Use location',
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Bottom action bar: only two decisions */}
      {!pendingStoredDraft && currentStep >= 3 ? (
        <div className="fixed inset-x-0 bottom-0 z-[70] border-t border-slate-200 bg-white/95 px-3 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
          <div className="mx-auto flex max-w-[980px] items-center gap-2 pb-[env(safe-area-inset-bottom)]">
            <button
              type="button"
              onClick={goBack}
              disabled={taxonomyLocked && currentStep === 4}
              title={
                taxonomyLocked && currentStep === 4
                  ? text(
                      locale,
                      'Tujuan dan kategori terkunci untuk draft ini. Mulai postingan baru untuk mengubahnya.',
                      'Purpose and category are locked for this draft. Start a new post to change them.',
                    )
                  : undefined
              }
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900 sm:w-auto sm:px-4"
              aria-label={text(locale, 'Kembali', 'Back')}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">{text(locale, 'Kembali', 'Back')}</span>
            </button>

            <button
              type="button"
              onClick={() => currentStep === 9 ? void publish() : void goNext()}
              disabled={publishing}
              className="ml-auto inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60 sm:flex-none sm:min-w-[170px]"
            >
              {publishing ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : null}
              <span className="truncate">{nextButtonLabel}</span>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
