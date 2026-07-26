'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
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
  getCreateBusinessCategoryImage,
  getCreateBusinessCategoryById,
  type CreateBusinessCategory,
  type CreateBusinessCategoryId,
} from './createBusinessData';
import { makeUploadDraftId, type ContentItem, type CreateFlowIntent } from './createPageUtils';
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
import { cn } from '@/lib/utils';
import type { GlobalSearchItem } from '@/lib/search/globalSearch';
import { normalizeContentMediaUrl } from '@/lib/content/catalog';
import { mapCreationDraftToListingPrefill } from '@/lib/creation-drafts/adapters';
import type { AICreationDraft } from '@/lib/creation-drafts/types';

type CreateListingWizardProps = {
  entryMode?: CreateFlowIntent;
  categoryId?: CreateBusinessCategoryId;
};

type TaxonomyItem = CreateTaxonomyItem;

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'offline' | 'error';

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

const STEP_COUNT = CREATE_STEPS.length;
const DEFAULT_INDUSTRY_SLUG = 'other';
const GENERATED_COPY_FIELD_KEYS = new Set(['title', 'summary']);
const PRICE_FIELD_KEYS = new Set(['price_mode', 'budget_mode', 'price_amount']);
const STRUCTURED_LOCATION_FIELD_KEYS = new Set(['location', 'address']);
const DEFAULT_CREATE_LOCATION_POINT: LatLng = {
  lat: -6.2,
  lng: 106.816666,
};

type ListingCopyAiResponse = {
  title?: string;
  summary?: string;
  provider?: string;
  error?: string;
};

const categorySlugByLegacyId: Record<string, string> = {
  supplies: 'materials-suppliers',
  service: 'services',
  equipment: 'machines-tools',
  property: 'business-places',
  opportunity: 'business-opportunities',
};

const categoryLegacyBySlug = Object.fromEntries(
  Object.entries(categorySlugByLegacyId).map(([id, slug]) => [slug, id]),
);

function toIntent(mode?: CreateFlowIntent): CreateIntent | undefined {
  if (mode === 'demand') return 'request';
  if (mode === 'supply') return 'offer';
  return undefined;
}

function text(locale: 'id' | 'en', id: string, en: string) {
  return locale === 'id' ? id : en;
}

function submissionIndustryIds(industryIds: string[]): string[] {
  return industryIds.length > 0 ? industryIds : [DEFAULT_INDUSTRY_SLUG];
}

function labelFor(locale: 'id' | 'en', item: TaxonomyItem) {
  return (
    (locale === 'id'
      ? item.name_id || item.label_id
      : item.name_en || item.label_en) || item.slug
  );
}

function valueAsString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function valueAsRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
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
    new Set(values.map(item => String(item || '').trim()).filter(Boolean)),
  );
}

function normalizedOptionValues(
  field: ListingFieldSchema,
  value: unknown,
): string[] {
  return valueAsStringList(value).map(item => {
    const normalized = item.toLowerCase();
    const match = field.options?.find(
      option =>
        option.value.toLowerCase() === normalized ||
        option.labelId.toLowerCase() === normalized ||
        option.labelEn.toLowerCase() === normalized,
    );
    return match?.value || item;
  });
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function parseRupiahInput(value: string): number | undefined {
  const digits = digitsOnly(value);
  if (!digits) return undefined;
  const amount = Number.parseInt(digits, 10);
  return Number.isFinite(amount) ? amount : undefined;
}

function resolveApiPricingMode(
  intent: CreateIntent | undefined,
  amount: number | undefined,
): 'fixed' | 'request' {
  if (intent === 'request') return 'request';
  return amount && amount > 0 ? 'fixed' : 'request';
}

function formatRupiahNumber(value: unknown): string {
  const raw =
    typeof value === 'number'
      ? String(value)
      : digitsOnly(valueAsString(value));
  if (!raw) return '';
  const amount = Number.parseInt(raw, 10);
  if (!Number.isFinite(amount)) return '';
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatRupiahLabel(value: unknown): string {
  const formatted = formatRupiahNumber(value);
  return formatted ? `Rp ${formatted}` : '';
}

function requestBudgetLabel(
  locale: 'id' | 'en',
  values: Record<string, unknown>,
): string {
  const amount = formatRupiahLabel(values.price_amount);
  if (amount) return amount;
  const mode = valueAsString(values.budget_mode);
  if (mode === 'undetermined') {
    return text(locale, 'Budget belum ditentukan', 'Budget not decided');
  }
  if (mode === 'negotiable') {
    return text(locale, 'Budget bisa dibicarakan', 'Budget negotiable');
  }
  return text(locale, 'Budget fleksibel', 'Flexible budget');
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readLatLngFromValues(values: Record<string, unknown>): LatLng | null {
  const nested = values.location_point;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const record = nested as Record<string, unknown>;
    const lat = readNumber(record.lat);
    const lng = readNumber(record.lng);
    if (lat !== null && lng !== null) return { lat, lng };
  }

  const lat =
    readNumber(values.location_lat) ??
    readNumber(values.latitude) ??
    readNumber(values.lat);
  const lng =
    readNumber(values.location_lng) ??
    readNumber(values.longitude) ??
    readNumber(values.lng);
  return lat !== null && lng !== null ? { lat, lng } : null;
}

function readSelectedLocationFromValues(
  values: Record<string, unknown>,
): SelectedLocation | null {
  const structured = values.location_structured;
  if (isSelectedLocation(structured)) return structured;
  return null;
}

function formatLatLng(point: LatLng): string {
  return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
}

function numericQuantityInput(value: string): string {
  return value.replace(/[^\d.,]/g, '');
}

function valueAsBool(value: unknown): boolean {
  return value === true || value === 'true';
}

function hasMeaningfulValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function orderMainStepFields(fields: ListingFieldSchema[]) {
  const detailFields = fields.filter(
    field =>
      !GENERATED_COPY_FIELD_KEYS.has(field.key) &&
      !PRICE_FIELD_KEYS.has(field.key),
  );
  const priceFields = fields.filter(field => PRICE_FIELD_KEYS.has(field.key));
  const copyFields = fields.filter(field =>
    GENERATED_COPY_FIELD_KEYS.has(field.key),
  );
  return [...detailFields, ...priceFields, ...copyFields];
}

function formatDraftUpdatedAt(locale: 'id' | 'en', value?: string) {
  if (!value) return text(locale, 'Belum diketahui', 'Unknown');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return text(locale, 'Belum diketahui', 'Unknown');
  }
  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function draftFromState(input: {
  base: TemporaryCreateDraft;
  intent?: CreateIntent;
  categorySlug?: string;
  subcategorySlug?: string;
  industryIds: string[];
  currentStep: number;
  values: Record<string, unknown>;
  media: DraftMedia[];
  draftId?: string;
  draftVersion?: number;
}) {
  return writeTemporaryCreateDraft({
    ...input.base,
    intent: input.intent,
    categorySlug: input.categorySlug,
    subcategorySlug: input.subcategorySlug,
    industryIds: input.industryIds,
    currentStep: input.currentStep,
    formValues: input.values,
    media: input.media.map(item => ({
      id: item.id,
      url: item.url,
      name: item.name,
      status: item.status,
      error: item.error,
    })),
    draftId: input.draftId,
    draftVersion: input.draftVersion,
  });
}

function normalizeMarketplaceCategorySlug(value: unknown): string | undefined {
  const cleaned = valueAsString(value).toLowerCase();
  if (!cleaned) return undefined;
  return categorySlugByLegacyId[cleaned] || cleaned;
}

function normalizeDraftIntent(value: unknown): CreateIntent | undefined {
  const cleaned = valueAsString(value).toLowerCase();
  if (cleaned === 'request' || cleaned === 'demand' || cleaned === 'seeker') {
    return 'request';
  }
  if (cleaned === 'offer' || cleaned === 'supply' || cleaned === 'provider') {
    return 'offer';
  }
  return undefined;
}

function normalizeDraftMedia(value: unknown, coverImage?: unknown): DraftMedia[] {
  const media = Array.isArray(value) ? value : [];
  const normalized = media
    .map((entry): DraftMedia | null => {
      if (typeof entry === 'string') {
        const url = normalizeContentMediaUrl(entry);
        return url
          ? {
              id: makeUploadDraftId('image'),
              url,
              preview: url,
              status: 'uploaded',
            }
          : null;
      }
      const record = valueAsRecord(entry);
      const status = valueAsString(record.status);
      const url = normalizeContentMediaUrl(
        valueAsString(record.url) || valueAsString(record.preview),
      );
      if (!url && !valueAsString(record.name)) return null;
      return {
        id: valueAsString(record.id) || makeUploadDraftId('image'),
        url: url || undefined,
        preview: url || valueAsString(record.preview) || undefined,
        name: valueAsString(record.name) || undefined,
        status:
          status === 'pending' ||
          status === 'uploading' ||
          status === 'failed' ||
          status === 'deleted'
            ? status
            : 'uploaded',
        error: valueAsString(record.error) || undefined,
      };
    })
    .filter((entry): entry is DraftMedia => Boolean(entry));

  const coverUrl = normalizeContentMediaUrl(valueAsString(coverImage));
  if (coverUrl && !normalized.some(item => item.url === coverUrl)) {
    normalized.unshift({
      id: makeUploadDraftId('image'),
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
  const values = { ...valueAsRecord(payload.values) };
  if (!valueAsString(values.title) && valueAsString(payload.title)) {
    values.title = valueAsString(payload.title);
  }
  if (!valueAsString(values.summary) && valueAsString(payload.summary)) {
    values.summary = valueAsString(payload.summary);
  }
  if (!valueAsString(values.body) && valueAsString(payload.body)) {
    values.body = valueAsString(payload.body);
  }
  if (!valueAsString(values.price_amount) && payload.price_cents) {
    values.price_amount = String(Math.floor(payload.price_cents / 100));
  }
  if (!valueAsString(values.unit) && valueAsString(payload.price_unit)) {
    values.unit = valueAsString(payload.price_unit);
  }

  const categorySlug = normalizeMarketplaceCategorySlug(payload.category_slug);
  const subcategorySlug = valueAsString(payload.subcategory_slug) || undefined;
  const currentStep = Math.max(
    1,
    Math.min(
      STEP_COUNT,
      Number(payload.current_step) ||
        (subcategorySlug ? 4 : categorySlug ? 3 : payload.listing_intent ? 2 : 1),
    ),
  );

  return {
    ...createEmptyTemporaryDraft(),
    draftId: payload.id,
    draftVersion: payload.draft_version,
    intent: normalizeDraftIntent(payload.listing_intent),
    categorySlug,
    subcategorySlug,
    industryIds: valueAsStringList(payload.industry_ids),
    currentStep,
    formValues: values,
    media: normalizeDraftMedia(payload.media, payload.cover_image),
    updatedAt:
      valueAsString(payload.last_saved_at) ||
      valueAsString(payload.updated_at) ||
      new Date().toISOString(),
  };
}

function buildDraftFromContentItem(item: ContentItem): TemporaryCreateDraft {
  const metadata = valueAsRecord(item.metadata);
  const formValues = valueAsRecord(metadata.form_values);
  const attributes = valueAsRecord(metadata.attributes);
  const values = { ...attributes, ...formValues };
  if (!valueAsString(values.title) && valueAsString(item.title)) {
    values.title = valueAsString(item.title);
  }
  if (!valueAsString(values.summary) && valueAsString(item.summary)) {
    values.summary = valueAsString(item.summary);
  }
  if (!valueAsString(values.body) && valueAsString(item.body)) {
    values.body = valueAsString(item.body);
  }
  if (!valueAsString(values.price_amount) && item.price_cents) {
    values.price_amount = String(Math.floor(item.price_cents / 100));
  }
  if (!valueAsString(values.unit) && valueAsString(item.price_unit)) {
    values.unit = valueAsString(item.price_unit);
  }

  const categorySlug = normalizeMarketplaceCategorySlug(
    metadata.marketplace_category_slug ||
      metadata.create_category ||
      metadata.business_discovery_category ||
      item.category,
  );
  const subcategorySlug =
    valueAsString(metadata.marketplace_subcategory_slug) ||
    valueAsString(metadata.subcategory) ||
    valueAsString(metadata.sub_category) ||
    undefined;
  const listingProgress = valueAsRecord(metadata.listing_progress);
  const currentStep = Math.max(
    1,
    Math.min(
      STEP_COUNT,
      Number(item.current_step) ||
        Number(listingProgress.current_step) ||
        (subcategorySlug ? 4 : categorySlug ? 3 : 1),
    ),
  );

  return {
    ...createEmptyTemporaryDraft(),
    draftId: item.id,
    intent:
      normalizeDraftIntent(metadata.listing_intent) ||
      normalizeDraftIntent(metadata.intent) ||
      normalizeDraftIntent(metadata.listing_side) ||
      normalizeDraftIntent(metadata.market_side),
    categorySlug,
    subcategorySlug,
    industryIds: valueAsStringList(
      metadata.industry_ids || metadata.industry_slugs || metadata.industry_slug,
    ),
    currentStep,
    formValues: values,
    media: normalizeDraftMedia(metadata.media || metadata.image_urls, item.cover_image),
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
      { id: string; en: string; exampleId: string; exampleEn: string }
    >
  > = {
    supplies: {
      offer: {
        id: 'Tawarkan bahan baku, kemasan, stok grosir, atau produk jual ulang.',
        en: 'Offer raw materials, packaging, wholesale stock, or resale products.',
        exampleId: 'Supplier biji kopi arabika untuk kedai dan reseller',
        exampleEn: 'Arabica coffee bean supplier for cafes and resellers',
      },
      request: {
        id: 'Cari supplier bahan baku, kemasan, stok grosir, atau produk jual ulang.',
        en: 'Find suppliers for raw materials, packaging, wholesale stock, or resale products.',
        exampleId: 'Butuh supplier biji kopi arabika 10 kg per minggu',
        exampleEn: 'Need arabica coffee bean supplier, 10 kg weekly',
      },
    },
    service: {
      offer: {
        id: 'Tawarkan jasa operasional, kreatif, legal, digital, teknisi, atau lapangan.',
        en: 'Offer operational, creative, legal, digital, technician, or field services.',
        exampleId: 'Jasa foto produk untuk katalog UMKM',
        exampleEn: 'Product photography service for MSME catalogs',
      },
      request: {
        id: 'Cari jasa operasional, kreatif, legal, digital, teknisi, atau lapangan.',
        en: 'Find operational, creative, legal, digital, technician, or field services.',
        exampleId: 'Cari jasa foto untuk 30 produk skincare',
        exampleEn: 'Need product photography for 30 skincare products',
      },
    },
    equipment: {
      offer: {
        id: 'Tawarkan mesin, alat produksi, sewa alat, atau perlengkapan usaha.',
        en: 'Offer machines, production tools, rentals, or business equipment.',
        exampleId: 'Mesin cup sealer otomatis siap kirim',
        exampleEn: 'Automatic cup sealer ready to ship',
      },
      request: {
        id: 'Cari mesin, alat produksi, sewa alat, atau perlengkapan usaha.',
        en: 'Find machines, production tools, rentals, or business equipment.',
        exampleId: 'Cari mesin cup sealer untuk produksi rumahan',
        exampleEn: 'Need a cup sealer for home production',
      },
    },
    property: {
      offer: {
        id: 'Tawarkan ruko, kios, booth, gudang kecil, atau lokasi jualan.',
        en: 'Offer shophouses, kiosks, booths, small warehouses, or selling locations.',
        exampleId: 'Ruko disewakan di Antapani',
        exampleEn: 'Shophouse for rent in Antapani',
      },
      request: {
        id: 'Cari ruko, kios, booth, gudang kecil, atau lokasi jualan.',
        en: 'Find shophouses, kiosks, booths, small warehouses, or selling locations.',
        exampleId: 'Cari kios dekat kampus di Bandung',
        exampleEn: 'Looking for a kiosk near a campus in Bandung',
      },
    },
    opportunity: {
      offer: {
        id: 'Tawarkan franchise, kemitraan, reseller, distributor, atau peluang siap jalan.',
        en: 'Offer franchise, partnership, reseller, distributor, or ready-to-run opportunities.',
        exampleId: 'Paket kemitraan minuman untuk area Jawa Barat',
        exampleEn: 'Drink partnership package for West Java',
      },
      request: {
        id: 'Cari franchise, kemitraan, reseller, distributor, atau peluang siap jalan.',
        en: 'Find franchise, partnership, reseller, distributor, or ready-to-run opportunities.',
        exampleId: 'Cari peluang reseller modal di bawah 5 juta',
        exampleEn: 'Looking for reseller opportunity under IDR 5 million',
      },
    },
  };
  const fallback = {
    id: category.descriptionId,
    en: category.descriptionEn,
    exampleId: category.exampleId,
    exampleEn: category.exampleEn,
  };
  const copy = data[category.id]?.[intent] || fallback;
  return {
    description: text(locale, copy.id, copy.en),
    example: text(locale, copy.exampleId, copy.exampleEn),
  };
}

export default function CreateListingWizard({
  entryMode,
  categoryId,
}: CreateListingWizardProps) {
  const params = useParams<{ locale?: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = params?.locale === 'en' ? 'en' : 'id';
  const { authFetch, isAuthenticated, loading: authLoading, user } = useAuth();
  const creationDraftId = searchParams.get('draft')?.trim() || '';
  const sideParam = searchParams.get('side');
  const entryModeFromQuery: CreateFlowIntent | undefined =
    sideParam === 'demand' || sideParam === 'supply' ? sideParam : undefined;
  const effectiveEntryMode = entryMode || entryModeFromQuery;

  const [hydrated, setHydrated] = useState(false);
  const [baseDraft, setBaseDraft] = useState<TemporaryCreateDraft>(() =>
    createEmptyTemporaryDraft(),
  );
  const [intent, setIntent] = useState<CreateIntent | undefined>(() =>
    toIntent(effectiveEntryMode),
  );
  const [categorySlug, setCategorySlug] = useState<string | undefined>(() => {
    const category = categoryId
      ? getCreateBusinessCategoryById(categoryId)
      : null;
    return category ? category.slugEn : undefined;
  });
  const [subcategorySlug, setSubcategorySlug] = useState<string | undefined>();
  const [industryIds, setIndustryIds] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [media, setMedia] = useState<DraftMedia[]>([]);
  const [serverDraft, setServerDraft] = useState<ServerDraft | null>(null);
  const [pendingStoredDraft, setPendingStoredDraft] =
    useState<TemporaryCreateDraft | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [subcategories, setSubcategories] = useState<TaxonomyItem[]>([]);
  const [industries, setIndustries] = useState<TaxonomyItem[]>([]);
  const [taxonomyLoading, setTaxonomyLoading] = useState(false);
  const [showAllTaxonomy, setShowAllTaxonomy] = useState(false);
  const [showIndustryChoices, setShowIndustryChoices] = useState(false);
  const [taxonomyQuery, setTaxonomyQuery] = useState('');
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [customOptionInputs, setCustomOptionInputs] = useState<
    Record<string, string>
  >({});
  const [aiCopyLoading, setAiCopyLoading] = useState(false);
  const [aiCopyError, setAiCopyError] = useState('');
  const [mapPickerFieldKey, setMapPickerFieldKey] = useState<string | null>(
    null,
  );
  const [ownedStoreLocations, setOwnedStoreLocations] = useState<
    LocationPickerSuggestion[]
  >([]);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importedCreationDraftRef = useRef('');

  const category = useMemo(() => {
    const legacyId = categorySlug ? categoryLegacyBySlug[categorySlug] : null;
    return legacyId ? getCreateBusinessCategoryById(legacyId) : null;
  }, [categorySlug]);

  const fieldSchema = useMemo(
    () =>
      intent && categorySlug
        ? buildListingFieldSchema(intent, categorySlug, subcategorySlug)
        : [],
    [categorySlug, intent, subcategorySlug],
  );

  const resetUiStateForDraft = useCallback((draft: TemporaryCreateDraft) => {
    setBaseDraft(draft);
    setIntent(draft.intent);
    setCategorySlug(draft.categorySlug);
    setSubcategorySlug(draft.subcategorySlug);
    setIndustryIds(draft.industryIds);
    setCurrentStep(draft.currentStep);
    setValues(draft.formValues);
    setMedia(draft.media);
    setServerDraft(
      draft.draftId
        ? { id: draft.draftId, draft_version: draft.draftVersion }
        : null,
    );
    setLastSavedAt(draft.updatedAt);
    setError('');
    setTaxonomyQuery('');
    setShowAllTaxonomy(false);
    setShowMoreDetails(false);
    setCustomOptionInputs({});
  }, []);

  const buildFreshDraftForRoute = useCallback(() => {
    const initial = createEmptyTemporaryDraft();
    const category = categoryId
      ? getCreateBusinessCategoryById(categoryId)
      : null;
    const seededIntent = toIntent(effectiveEntryMode);
    return {
      ...initial,
      intent: seededIntent,
      categorySlug: category?.slugEn,
      currentStep: category ? 3 : seededIntent ? 2 : 1,
    };
  }, [categoryId, effectiveEntryMode]);

  const continueStoredDraft = useCallback(() => {
    if (!pendingStoredDraft) return;
    resetUiStateForDraft({
      ...pendingStoredDraft,
      intent: pendingStoredDraft.intent || toIntent(effectiveEntryMode),
    });
    setPendingStoredDraft(null);
    setSaveStatus('saved');
  }, [effectiveEntryMode, pendingStoredDraft, resetUiStateForDraft]);

  const startFreshDraft = useCallback(() => {
    clearTemporaryCreateDraft();
    const fresh = writeTemporaryCreateDraft(buildFreshDraftForRoute());
    resetUiStateForDraft(fresh);
    setPendingStoredDraft(null);
    setSaveStatus('saved');
  }, [buildFreshDraftForRoute, resetUiStateForDraft]);

  useEffect(() => {
    if (creationDraftId) return;
    const stored = readTemporaryCreateDraft();
    if (hasTemporaryCreateDraftProgress(stored)) {
      setPendingStoredDraft(stored);
      resetUiStateForDraft(buildFreshDraftForRoute());
      setSaveStatus('idle');
      setHydrated(true);
      return;
    }

    const fresh =
      effectiveEntryMode || categoryId
        ? writeTemporaryCreateDraft(buildFreshDraftForRoute())
        : buildFreshDraftForRoute();
    resetUiStateForDraft(fresh);
    setHydrated(true);
  }, [
    buildFreshDraftForRoute,
    categoryId,
    creationDraftId,
    effectiveEntryMode,
    resetUiStateForDraft,
  ]);

  useEffect(() => {
    if (!creationDraftId || authLoading) {
      return;
    }
    if (!isAuthenticated) {
      resetUiStateForDraft(buildFreshDraftForRoute());
      setError(
        text(
          locale,
          'Masuk dulu untuk membuka draft AI.',
          'Sign in to open an AI draft.',
        ),
      );
      setHydrated(true);
      return;
    }
    if (importedCreationDraftRef.current === creationDraftId) return;
    importedCreationDraftRef.current = creationDraftId;
    let cancelled = false;
    setHydrated(false);
    setError('');

    async function loadDraftFromParam() {
      const routeIntent = toIntent(effectiveEntryMode);
      const applyLoadedDraft = (draft: TemporaryCreateDraft) => {
        if (routeIntent && draft.intent && routeIntent !== draft.intent) {
          throw new Error(
            text(
              locale,
              'Tujuan draft tidak cocok dengan halaman ini.',
              'The draft intent does not match this page.',
            ),
          );
        }
        if (categoryId && draft.categorySlug) {
          const expectedCategory = getCreateBusinessCategoryById(categoryId);
          if (expectedCategory?.slugEn !== draft.categorySlug) {
            throw new Error(
              text(
                locale,
                'Kategori draft tidak cocok dengan halaman ini.',
                'The draft category does not match this page.',
              ),
            );
          }
        }
        const normalized = writeTemporaryCreateDraft({
          ...draft,
          intent: draft.intent || routeIntent,
          currentStep:
            draft.currentStep >= 4 && !draft.subcategorySlug
              ? 3
              : draft.currentStep,
        });
        if (cancelled) return;
        resetUiStateForDraft(normalized);
        setPendingStoredDraft(null);
        setSaveStatus('saved');
        setHydrated(true);
      };

      const listingDraftResponse = await authFetch(
        `/api/listing-drafts/${encodeURIComponent(creationDraftId)}`,
        { cache: 'no-store' },
      );
      if (listingDraftResponse.ok) {
        const payload = (await listingDraftResponse
          .json()
          .catch(() => ({}))) as {
          draft?: ListingDraftPayload;
        };
        if (payload.draft?.id) {
          applyLoadedDraft(buildDraftFromListingPayload(payload.draft));
          return;
        }
      }

      const contentResponse = await authFetch(
        `/api/content/${encodeURIComponent(creationDraftId)}`,
        { cache: 'no-store' },
      );
      if (contentResponse.ok) {
        const content = (await contentResponse
          .json()
          .catch(() => ({}))) as ContentItem;
        if (content.id) {
          if (user?.id && content.owner_id && content.owner_id !== user.id) {
            throw new Error(
              text(
                locale,
                'Anda tidak punya akses untuk mengedit postingan ini.',
                'You do not have access to edit this post.',
              ),
            );
          }
          applyLoadedDraft(buildDraftFromContentItem(content));
          return;
        }
      }

      const creationDraftResponse = await authFetch(
        `/api/creation-drafts/${encodeURIComponent(creationDraftId)}`,
        { cache: 'no-store' },
      );
      const payload = (await creationDraftResponse
        .json()
        .catch(() => ({}))) as {
        data?: AICreationDraft;
        error?: string;
      };
      if (!creationDraftResponse.ok || !payload.data) {
        throw new Error(
          payload.error ||
            text(locale, 'Draft tidak ditemukan.', 'Draft was not found.'),
        );
      }
      const prefill = mapCreationDraftToListingPrefill(payload.data);
      if (!prefill) {
        throw new Error(
          text(
            locale,
            'Jenis draft tidak cocok dengan flow postingan.',
            'This draft does not match the listing flow.',
          ),
        );
      }
      const importedCategory = getCreateBusinessCategoryById(prefill.categoryId);
      const readyForDetails = Boolean(prefill.subcategorySlug);
      applyLoadedDraft({
        ...createEmptyTemporaryDraft(),
        intent: prefill.intent,
        categorySlug: importedCategory?.slugEn,
        subcategorySlug: prefill.subcategorySlug,
        industryIds: prefill.industryIds,
        currentStep: readyForDetails ? 4 : 3,
        formValues: prefill.values,
        media: prefill.media,
      });
    }

    loadDraftFromParam().catch(caught => {
        if (cancelled) return;
        setError(
          caught instanceof Error
            ? caught.message
            : text(
                locale,
                'Draft gagal dibuka.',
                'Failed to open draft.',
              ),
        );
        resetUiStateForDraft(buildFreshDraftForRoute());
        setHydrated(true);
      });

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
    user?.id,
  ]);

  useEffect(() => {
    if (!hydrated || pendingStoredDraft) return;
    setBaseDraft(previous => {
      const next = draftFromState({
        base: previous,
        intent,
        categorySlug,
        subcategorySlug,
        industryIds,
        currentStep,
        values,
        media,
        draftId: serverDraft?.id,
        draftVersion: serverDraft?.draft_version,
      });
      setLastSavedAt(next.updatedAt);
      return next;
    });
  }, [
    hydrated,
    intent,
    categorySlug,
    subcategorySlug,
    industryIds,
    currentStep,
    values,
    media,
    pendingStoredDraft,
    serverDraft?.id,
    serverDraft?.draft_version,
  ]);

  useEffect(() => {
    if (!categorySlug) return;
    let cancelled = false;
    setTaxonomyLoading(true);
    Promise.all([
      fetch(`/api/categories/${categorySlug}/subcategories`, {
        cache: 'no-store',
      })
        .then(res => res.json())
        .catch(() => ({ items: [] })),
      fetch('/api/industries?limit=80', { cache: 'no-store' })
        .then(res => res.json())
        .catch(() => ({ items: [] })),
    ])
      .then(([sub, inds]) => {
        if (cancelled) return;
        const subcategoryItems = Array.isArray(sub.items) ? sub.items : [];
        const industryItems = Array.isArray(inds.items) ? inds.items : [];
        setSubcategories(
          mergeCreateTaxonomyItems(
            subcategoryItems,
            FALLBACK_CREATE_SUBCATEGORIES[categorySlug] || [],
          ),
        );
        setIndustries(
          mergeCreateTaxonomyItems(industryItems, FALLBACK_CREATE_INDUSTRIES),
        );
      })
      .finally(() => {
        if (!cancelled) setTaxonomyLoading(false);
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
    authFetch('/api/super-app/umkm/stores?mine=1&limit=80')
      .then(res => res.json())
      .then((payload: { data?: { items?: OwnedStoreLocation[] } }) => {
        if (cancelled) return;
        const items = payload.data?.items || [];
        setOwnedStoreLocations(
          items
            .filter(
              item =>
                Number.isFinite(item.lat) &&
                Number.isFinite(item.lng) &&
                Boolean(item.name?.trim()),
            )
            .map(item => ({
              ...buildBusinessLocationSuggestion({
                id: item.id,
                name:
                  item.name?.trim() ||
                  text(locale, 'Lokasi usaha', 'Business location'),
                address: item.address,
                city: item.city,
                lat: item.lat as number,
                lng: item.lng as number,
              }),
              id: `business-${item.id}`,
              label:
                item.name?.trim() ||
                text(locale, 'Lokasi usaha', 'Business location'),
              subtitle: [item.address, item.city].filter(Boolean).join(' • '),
              point: {
                lat: Number((item.lat as number).toFixed(6)),
                lng: Number((item.lng as number).toFixed(6)),
              },
              source: 'business' as const,
            })),
        );
      })
      .catch(() => {
        if (!cancelled) setOwnedStoreLocations([]);
      });

    return () => {
      cancelled = true;
    };
  }, [authFetch, isAuthenticated, locale]);

  const createServerDraft = useCallback(async () => {
    if (!isAuthenticated || !intent || !categorySlug || !subcategorySlug) {
      return null;
    }
    if (serverDraft?.id) return serverDraft;
    setSaveStatus('saving');
    const response = await authFetch('/api/listing-drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent,
        category_slug: categorySlug,
        subcategory_slug: subcategorySlug,
        industry_ids: submissionIndustryIds(industryIds),
        current_step: currentStep,
        values,
        media,
        completion_percentage: Math.round((currentStep / STEP_COUNT) * 100),
        idempotency_key: baseDraft.idempotencyKey,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      draft?: ServerDraft;
      error?: string;
    };
    if (!response.ok || !payload.draft) {
      setSaveStatus(navigator.onLine ? 'error' : 'offline');
      throw new Error(payload.error || 'Failed to create draft');
    }
    setServerDraft(payload.draft);
    setSaveStatus('saved');
    setLastSavedAt(new Date().toISOString());
    return payload.draft;
  }, [
    authFetch,
    baseDraft.idempotencyKey,
    categorySlug,
    currentStep,
    industryIds,
    intent,
    isAuthenticated,
    media,
    serverDraft,
    subcategorySlug,
    values,
  ]);

  const saveServerDraft = useCallback(
    async (step = currentStep, nextValues = values, nextMedia = media) => {
      if (!isAuthenticated || !serverDraft?.id || step < 4) return;
      setSaveStatus('saving');
      const submissionValues =
        intent === 'request'
          ? { budget_mode: 'undetermined', ...nextValues }
          : nextValues;
      const title =
        valueAsString(submissionValues.title) ||
        valueAsString(submissionValues.item_name) ||
        valueAsString(submissionValues.item_needed) ||
        valueAsString(submissionValues.service_name) ||
        valueAsString(submissionValues.service_needed) ||
        valueAsString(submissionValues.equipment_name) ||
        valueAsString(submissionValues.equipment_needed) ||
        valueAsString(submissionValues.place_name) ||
        valueAsString(submissionValues.place_needed) ||
        valueAsString(submissionValues.opportunity_name) ||
        valueAsString(submissionValues.opportunity_needed);
      const summary = valueAsString(submissionValues.summary);
      const amount = parseRupiahInput(valueAsString(submissionValues.price_amount));
      const pricingMode = resolveApiPricingMode(intent, amount);
      const response = await authFetch(
        `/api/listing-drafts/${serverDraft.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expected_version: serverDraft.draft_version,
            current_step: step,
            values: submissionValues,
            media: nextMedia,
            title,
            summary,
            body: summary,
            price_cents:
              pricingMode === 'fixed' ? Math.round(amount! * 100) : undefined,
            price_unit:
              pricingMode === 'request'
                ? undefined
                : valueAsString(submissionValues.unit) || undefined,
            pricing_mode: pricingMode,
            cover_image: nextMedia.find(
              item => item.status === 'uploaded' && item.url,
            )?.url,
            industry_ids: submissionIndustryIds(industryIds),
            completion_percentage: Math.round((step / STEP_COUNT) * 100),
            attributes: submissionValues,
            contact_snapshot: {
              display_as: submissionValues.display_as || 'personal',
              contact_channel: submissionValues.contact_channel || 'chat',
            },
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        draft?: ServerDraft;
        error?: string;
      };
      if (!response.ok || !payload.draft) {
        setSaveStatus(navigator.onLine ? 'error' : 'offline');
        throw new Error(payload.error || 'Failed to save draft');
      }
      setServerDraft(payload.draft);
      setSaveStatus('saved');
      setLastSavedAt(new Date().toISOString());
    },
    [
      authFetch,
      currentStep,
      industryIds,
      intent,
      isAuthenticated,
      media,
      serverDraft,
      values,
    ],
  );

  useEffect(() => {
    if (!hydrated || pendingStoredDraft || !serverDraft?.id || currentStep < 4)
      return;
    setSaveStatus(navigator.onLine ? 'dirty' : 'offline');
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      saveServerDraft().catch(() => undefined);
    }, 1000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [
    currentStep,
    hydrated,
    pendingStoredDraft,
    saveServerDraft,
    serverDraft?.id,
    values,
    media,
  ]);

  useEffect(() => {
    function beforeUnload() {
      if (pendingStoredDraft) return;
      draftFromState({
        base: baseDraft,
        intent,
        categorySlug,
        subcategorySlug,
        industryIds,
        currentStep,
        values,
        media,
        draftId: serverDraft?.id,
        draftVersion: serverDraft?.draft_version,
      });
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [
    baseDraft,
    categorySlug,
    currentStep,
    industryIds,
    intent,
    media,
    pendingStoredDraft,
    serverDraft,
    subcategorySlug,
    values,
  ]);

  function setField(key: string, value: unknown) {
    setValues(previous => ({ ...previous, [key]: value }));
  }

  function setLocationPoint(point: LatLng) {
    setValues(previous => ({
      ...previous,
      location_lat: point.lat,
      location_lng: point.lng,
      latitude: point.lat,
      longitude: point.lng,
      lat: point.lat,
      lng: point.lng,
      location_point: point,
    }));
    setSaveStatus('dirty');
  }

  function setStructuredLocation(
    location: SelectedLocation | null,
    fieldKey?: string,
  ) {
    setValues(previous => {
      const next = { ...previous };
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

      const displayText = location.formattedAddress || location.name;
      return {
        ...next,
        ...(fieldKey ? { [fieldKey]: displayText } : {}),
        location: displayText,
        location_structured: location,
        location_place_id: location.placeId,
        location_provider: location.provider || 'osm',
        location_lat: location.latitude,
        location_lng: location.longitude,
        latitude: location.latitude,
        longitude: location.longitude,
        lat: location.latitude,
        lng: location.longitude,
        location_point: {
          lat: location.latitude,
          lng: location.longitude,
        },
      };
    });
    setSaveStatus('dirty');
  }

  function validateStep(step: number): string {
    if (step === 1 && !intent)
      return text(locale, 'Pilih tujuan dulu.', 'Choose a purpose first.');
    if (step === 2 && !categorySlug)
      return text(locale, 'Pilih kategori dulu.', 'Choose a category first.');
    if (step === 3) {
      if (!subcategorySlug)
        return text(
          locale,
          'Pilih satu subkategori utama dulu. Ini menentukan pertanyaan khusus di langkah berikutnya.',
          'Choose one main subcategory first. This controls the specific questions in the next step.',
        );
    }
    const requiredFields = fieldSchema.filter(
      field => field.step === step && field.required,
    );
    const missing = requiredFields.find(field => {
      const value = values[field.key];
      if (field.type === 'toggle') return false;
      return (
        value === undefined || value === null || String(value).trim() === ''
      );
    });
    if (missing)
      return text(
        locale,
        `Isi ${missing.labelId}.`,
        `Fill ${missing.labelEn}.`,
      );
    const missingStructuredLocation = requiredFields.find(field =>
      STRUCTURED_LOCATION_FIELD_KEYS.has(field.key),
    );
    if (missingStructuredLocation && !readSelectedLocationFromValues(values)) {
      return text(
        locale,
        'Pilih salah satu lokasi dari hasil pencarian.',
        'Pick one location from the search results.',
      );
    }
    if (step === 6 && intent !== 'request' && media.length === 0) {
      return text(
        locale,
        'Tambahkan minimal satu foto atau referensi.',
        'Add at least one photo or reference.',
      );
    }
    return '';
  }

  async function goNext() {
    setError('');
    const message = validateStep(currentStep);
    if (message) {
      setError(message);
      return;
    }
    if (currentStep === 3 && isAuthenticated) {
      try {
        await createServerDraft();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : text(locale, 'Gagal membuat draft.', 'Failed to create draft.'),
        );
        return;
      }
    }
    if (currentStep >= 4) {
      saveServerDraft(currentStep).catch(() => undefined);
    }
    setCurrentStep(step => Math.min(STEP_COUNT, step + 1));
  }

  async function saveAndExit() {
    try {
      if (currentStep >= 3 && isAuthenticated) await createServerDraft();
      if (currentStep >= 4) await saveServerDraft(currentStep);
    } catch {
      setSaveStatus(navigator.onLine ? 'error' : 'offline');
    }
    router.push(`/${locale}/create/drafts`);
  }

  async function uploadSelected(files: FileList | null) {
    if (!files?.length) return;
    const incoming = Array.from(files)
      .slice(0, 8)
      .map(file => ({
        id: crypto.randomUUID(),
        name: file.name,
        preview: URL.createObjectURL(file),
        status: isAuthenticated ? 'uploading' : 'pending',
        file,
      }));
    setMedia(previous => [
      ...previous,
      ...incoming.map(
        item =>
          ({
            id: item.id,
            name: item.name,
            preview: item.preview,
            status: item.status,
          }) as DraftMedia,
      ),
    ]);
    if (!isAuthenticated) {
      setSaveStatus('dirty');
      return;
    }
    const form = new FormData();
    incoming.forEach(item => form.append('images', item.file));
    try {
      const response = await authFetch('/api/content/upload-images', {
        method: 'POST',
        body: form,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        urls?: string[];
        image_urls?: string[];
        files?: Array<{ url?: string }>;
      };
      const urls =
        payload.urls ||
        payload.image_urls ||
        payload.files?.map(item => item.url || '').filter(Boolean) ||
        [];
      setMedia(previous =>
        previous.map(item => {
          const index = incoming.findIndex(upload => upload.id === item.id);
          if (index < 0) return item;
          const url = urls[index];
          return url
            ? { ...item, url, preview: url, status: 'uploaded' }
            : {
                ...item,
                status: 'failed',
                error: text(locale, 'Gagal upload', 'Upload failed'),
              };
        }),
      );
    } catch {
      setMedia(previous =>
        previous.map(item =>
          incoming.some(upload => upload.id === item.id)
            ? {
                ...item,
                status: 'failed',
                error: text(locale, 'Gagal upload', 'Upload failed'),
              }
            : item,
        ),
      );
    }
  }

  async function generateListingCopy() {
    setAiCopyError('');
    if (!isAuthenticated) {
      setAiCopyError(
        text(
          locale,
          'Masuk dulu untuk memakai bantuan AI.',
          'Sign in first to use AI assistance.',
        ),
      );
      return;
    }
    if (!intent || !categorySlug || !subcategorySlug) {
      setAiCopyError(
        text(
          locale,
          'Pilih tujuan, kategori, dan jenis dulu supaya AI punya konteks.',
          'Choose purpose, category, and type first so AI has context.',
        ),
      );
      return;
    }
    const filledContextCount = Object.entries(values).filter(
      ([key, value]) =>
        !GENERATED_COPY_FIELD_KEYS.has(key) && hasMeaningfulValue(value),
    ).length;
    if (filledContextCount < 2) {
      setAiCopyError(
        text(
          locale,
          'Isi nama barang/jasa dan minimal satu detail utama dulu supaya AI tidak mengarang.',
          'Fill the item/service name and at least one main detail first so AI does not guess.',
        ),
      );
      return;
    }

    setAiCopyLoading(true);
    try {
      const response = await authFetch('/api/ai/create-listing-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale,
          intent,
          categorySlug,
          subcategorySlug,
          industryIds: submissionIndustryIds(industryIds),
          values,
          fields: fieldSchema.map(field => ({
            key: field.key,
            labelId: field.labelId,
            labelEn: field.labelEn,
          })),
        }),
      });
      const payload = (await response
        .json()
        .catch(() => ({}))) as ListingCopyAiResponse;
      if (!response.ok) {
        throw new Error(
          payload.error ||
            text(
              locale,
              'AI belum bisa membuat ringkasan.',
              'AI could not create copy yet.',
            ),
        );
      }
      const nextValues = {
        ...values,
        ...(payload.title ? { title: payload.title } : {}),
        ...(payload.summary ? { summary: payload.summary } : {}),
      };
      setValues(nextValues);
      setSaveStatus('dirty');
      saveServerDraft(currentStep, nextValues, media).catch(() => undefined);
    } catch (err) {
      setAiCopyError(
        err instanceof Error
          ? err.message
          : text(
              locale,
              'AI belum bisa membuat ringkasan.',
              'AI could not create copy yet.',
            ),
      );
    } finally {
      setAiCopyLoading(false);
    }
  }

  async function publish() {
    setError('');
    for (let step = 1; step <= 8; step += 1) {
      const message = validateStep(step);
      if (message) {
        setCurrentStep(step);
        setError(message);
        return;
      }
    }
    try {
      const draft = serverDraft || (await createServerDraft());
      if (!draft?.id) {
        setError(
          text(locale, 'Masuk dulu untuk menerbitkan.', 'Sign in to publish.'),
        );
        return;
      }
      await saveServerDraft(9);
      const response = await authFetch(
        `/api/listing-drafts/${draft.id}/publish`,
        {
          method: 'POST',
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        listing?: { id?: string; slug?: string };
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || 'Publish failed');
      const resourceId = payload.listing?.id || draft.id;
      const resourceUrl = `/${locale}/content/${
        payload.listing?.slug || resourceId
      }`;
      if (creationDraftId) {
        await authFetch(
          `/api/creation-drafts/${encodeURIComponent(creationDraftId)}/consume`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              resource_id: resourceId,
              resource_url: resourceUrl,
            }),
          },
        ).catch(() => undefined);
      }
      clearTemporaryCreateDraft();
      router.push(resourceUrl);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : text(locale, 'Gagal menerbitkan.', 'Failed to publish.'),
      );
    }
  }

  function renderField(field: ListingFieldSchema) {
    const id = `create-${field.key}`;
    const label = text(locale, field.labelId, field.labelEn);
    const help =
      field.helpId || field.helpEn
        ? text(locale, field.helpId || '', field.helpEn || '')
        : '';
    const common =
      'w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50';
    const labelBlock = (
      <span id={`${id}-label`} className="block">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {label}
          {field.required ? (
            <>
              <span aria-hidden="true" className="ml-0.5 text-red-600">
                *
              </span>
              <span className="sr-only">
                {' '}
                {text(locale, 'wajib diisi', 'required')}
              </span>
            </>
          ) : null}
        </span>
        {help ? (
          <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
            {help}
          </span>
        ) : null}
      </span>
    );
    const isStructuredLocationField = STRUCTURED_LOCATION_FIELD_KEYS.has(
      field.key,
    );
    const locationPoint = readLatLngFromValues(values);
    const selectedLocation = readSelectedLocationFromValues(values);
    const locationPickerControl = isStructuredLocationField ? (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMapPickerFieldKey(field.key)}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-bold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200"
        >
          <MapPin className="h-4 w-4" />
          {text(locale, 'Pilih di peta', 'Pick on map')}
        </button>
        {locationPoint ? (
          <span className="inline-flex min-h-[32px] items-center rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {formatLatLng(locationPoint)}
          </span>
        ) : (
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {text(
              locale,
              'Opsional, tapi membantu akurasi peta.',
              'Optional, but improves map accuracy.',
            )}
          </span>
        )}
      </div>
    ) : null;
    if (isStructuredLocationField) {
      return (
        <div key={field.key} className="space-y-2">
          {labelBlock}
          <LocationAutocomplete
            value={selectedLocation}
            onChange={location => setStructuredLocation(location, field.key)}
            textValue={valueAsString(values[field.key])}
            onTextChange={next => setField(field.key, next)}
            onSelect={location => setStructuredLocation(location, field.key)}
            placeholder={text(
              locale,
              field.placeholderId ||
                'Cari nama tempat, jalan, kecamatan, atau kota',
              field.placeholderEn || 'Search place, street, district, or city',
            )}
            helperText={text(
              locale,
              'Pilih lokasi dari hasil pencarian agar alamat dan titik peta tersimpan benar.',
              'Pick a search result so the address and map point are saved correctly.',
            )}
            required={field.required}
            countryCode="ID"
            locationBias={locationPoint}
            localSuggestions={ownedStoreLocations}
            isId={locale === 'id'}
          />
          {locationPickerControl}
        </div>
      );
    }
    if (field.type === 'textarea') {
      return (
        <label key={field.key} className="block space-y-2">
          {labelBlock}
          <textarea
            id={id}
            rows={4}
            required={field.required}
            className={cn(common, 'min-w-0 flex-1')}
            value={valueAsString(values[field.key])}
            placeholder={text(
              locale,
              field.placeholderId || '',
              field.placeholderEn || '',
            )}
            onChange={event => setField(field.key, event.target.value)}
          />
          {locationPickerControl}
        </label>
      );
    }
    if (field.type === 'radio') {
      const selected =
        normalizedOptionValues(field, values[field.key])[0] || '';
      return (
        <div key={field.key} className="space-y-2">
          {labelBlock}
          <div
            role="radiogroup"
            aria-labelledby={`${id}-label`}
            aria-required={field.required}
            className="flex flex-wrap gap-2"
          >
            {field.options?.map(option => {
              const active = selected === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setField(field.key, option.value)}
                  className={cn(
                    'inline-flex min-h-[42px] items-center gap-2 rounded-full border px-3.5 text-left text-sm font-semibold transition',
                    active
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30',
                  )}
                >
                  {active ? <Check className="h-4 w-4 shrink-0" /> : null}
                  {text(locale, option.labelId, option.labelEn)}
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    if (field.type === 'multi-select') {
      const selected = normalizedOptionValues(field, values[field.key]);
      const knownValues = new Set(
        (field.options || []).map(option => option.value),
      );
      const customValues = selected.filter(value => !knownValues.has(value));
      const customInput = customOptionInputs[field.key] || '';
      const toggleOption = (value: string) => {
        setField(
          field.key,
          selected.includes(value)
            ? selected.filter(item => item !== value)
            : [...selected, value],
        );
      };
      const addCustomOption = () => {
        const nextValue = customInput.trim();
        if (!nextValue) return;
        if (!selected.includes(nextValue)) {
          setField(field.key, [...selected, nextValue]);
        }
        setCustomOptionInputs(previous => ({
          ...previous,
          [field.key]: '',
        }));
      };
      return (
        <div key={field.key} className="space-y-2">
          {labelBlock}
          <div
            role="group"
            aria-labelledby={`${id}-label`}
            className="flex flex-wrap gap-2"
          >
            {field.options?.map(option => {
              const active = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleOption(option.value)}
                  className={cn(
                    'inline-flex min-h-[40px] items-center gap-2 rounded-full border px-3 text-sm font-semibold transition',
                    active
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
                  )}
                >
                  {active ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                  {text(locale, option.labelId, option.labelEn)}
                </button>
              );
            })}
          </div>
          {customValues.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {customValues.map(value => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleOption(value)}
                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  aria-label={text(locale, `Hapus ${value}`, `Remove ${value}`)}
                >
                  {value}
                  <X className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          ) : null}
          {field.allowCustomOption ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customInput}
                onChange={event =>
                  setCustomOptionInputs(previous => ({
                    ...previous,
                    [field.key]: event.target.value,
                  }))
                }
                onKeyDown={event => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  addCustomOption();
                }}
                placeholder={text(
                  locale,
                  'Tambahkan pilihan lainnya',
                  'Add another option',
                )}
                className={common}
              />
              <button
                type="button"
                onClick={addCustomOption}
                disabled={!customInput.trim()}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-900"
                aria-label={text(locale, 'Tambahkan', 'Add')}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      );
    }
    if (field.type === 'select') {
      return (
        <label key={field.key} className="block space-y-2">
          {labelBlock}
          <select
            id={id}
            required={field.required}
            className={common}
            value={valueAsString(values[field.key])}
            onChange={event => setField(field.key, event.target.value)}
          >
            <option value="">
              {text(locale, 'Pilih salah satu', 'Choose one')}
            </option>
            {field.options?.map(option => (
              <option key={option.value} value={option.value}>
                {text(locale, option.labelId, option.labelEn)}
              </option>
            ))}
          </select>
        </label>
      );
    }
    if (field.type === 'toggle') {
      return (
        <label
          key={field.key}
          className="flex min-h-[60px] cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
        >
          {labelBlock}
          <input
            type="checkbox"
            required={field.required}
            className="peer sr-only"
            checked={valueAsBool(values[field.key])}
            onChange={event => setField(field.key, event.target.checked)}
          />
          <span className="relative h-7 w-12 shrink-0 rounded-full bg-slate-300 transition after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500 peer-focus-visible:ring-offset-2 dark:bg-slate-700" />
        </label>
      );
    }
    if (field.type === 'currency') {
      return (
        <label key={field.key} className="block space-y-2">
          {labelBlock}
          <div className="flex items-center rounded-lg border border-slate-200 bg-white text-sm text-slate-900 transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50">
            <span className="shrink-0 border-r border-slate-200 px-3 py-3 font-bold text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Rp
            </span>
            <input
              id={id}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              required={field.required}
              className="min-w-0 flex-1 rounded-r-lg bg-transparent px-3 py-3 outline-none"
              value={formatRupiahNumber(values[field.key])}
              placeholder={formatRupiahNumber(
                text(
                  locale,
                  field.placeholderId || '',
                  field.placeholderEn || '',
                ),
              )}
              onChange={event =>
                setField(field.key, parseRupiahInput(event.target.value))
              }
            />
          </div>
        </label>
      );
    }
    if (field.key === 'minimum_order' || field.key === 'quantity') {
      const unit = valueAsString(values.unit);
      return (
        <label key={field.key} className="block space-y-2">
          {labelBlock}
          <div className="flex items-center rounded-lg border border-slate-200 bg-white text-sm text-slate-900 transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50">
            <input
              id={id}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              required={field.required}
              className="min-w-0 flex-1 rounded-l-lg bg-transparent px-3 py-3 outline-none"
              value={valueAsString(values[field.key])}
              placeholder={text(locale, 'Contoh: 5', 'Example: 5')}
              onChange={event =>
                setField(field.key, numericQuantityInput(event.target.value))
              }
            />
            <span
              aria-disabled="true"
              className={cn(
                'shrink-0 border-l border-slate-200 px-3 py-3 font-bold dark:border-slate-700',
                unit
                  ? 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
              )}
            >
              {unit || text(locale, 'pilih satuan', 'choose unit')}
            </span>
          </div>
        </label>
      );
    }
    if (field.type === 'number' && (field.suffixId || field.suffixEn)) {
      return (
        <label key={field.key} className="block space-y-2">
          {labelBlock}
          <div className="flex items-center rounded-lg border border-slate-200 bg-white text-sm text-slate-900 transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50">
            <input
              id={id}
              type="number"
              inputMode="decimal"
              required={field.required}
              min={field.validation?.min}
              max={field.validation?.max}
              className="min-w-0 flex-1 rounded-l-lg bg-transparent px-3 py-3 outline-none"
              value={valueAsString(values[field.key])}
              placeholder={text(
                locale,
                field.placeholderId || '',
                field.placeholderEn || '',
              )}
              onChange={event =>
                setField(
                  field.key,
                  event.target.value === ''
                    ? undefined
                    : Number(event.target.value),
                )
              }
            />
            <span className="shrink-0 border-l border-slate-200 bg-slate-50 px-3 py-3 font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {text(locale, field.suffixId || '', field.suffixEn || '')}
            </span>
          </div>
        </label>
      );
    }
    return (
      <label key={field.key} className="block space-y-2">
        {labelBlock}
        <input
          id={id}
          required={field.required}
          type={
            field.type === 'date'
              ? 'date'
              : field.type === 'number'
                ? 'number'
                : 'text'
          }
          className={common}
          value={valueAsString(values[field.key])}
          placeholder={text(
            locale,
            field.placeholderId || '',
            field.placeholderEn || '',
          )}
          onChange={event =>
            setField(
              field.key,
              field.type === 'number'
                ? event.target.value === ''
                  ? undefined
                  : Number(event.target.value)
                : event.target.value,
            )
          }
        />
        {locationPickerControl}
      </label>
    );
  }

  function renderFieldGridItem(field: ListingFieldSchema) {
    const shouldSpan =
      field.type === 'textarea' ||
      field.type === 'multi-select' ||
      field.type === 'radio' ||
      STRUCTURED_LOCATION_FIELD_KEYS.has(field.key);

    return (
      <div key={field.key} className={cn(shouldSpan && 'lg:col-span-2')}>
        {renderField(field)}
      </div>
    );
  }

  function renderAiCopyHelper() {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-bold text-emerald-950 dark:text-emerald-50">
              <Sparkles className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
              {text(
                locale,
                'Rapikan judul & ringkasan dengan AI',
                'Polish title & summary with AI',
              )}
            </p>
            <p className="mt-1 text-xs leading-5 text-emerald-900 dark:text-emerald-100">
              {text(
                locale,
                'Isi detail utama dulu. AI hanya memakai data yang ada di form ini, jadi tidak menebak harga, lokasi, stok, atau klaim baru.',
                'Fill the main details first. AI only uses data in this form, so it does not guess price, location, stock, or new claims.',
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void generateListingCopy()}
            disabled={aiCopyLoading}
            className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {aiCopyLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {aiCopyLoading
              ? text(locale, 'Menyusun...', 'Writing...')
              : text(locale, 'Generate', 'Generate')}
          </button>
        </div>
        {aiCopyError ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold leading-5 text-amber-800 dark:border-amber-900/60 dark:bg-slate-950 dark:text-amber-100">
            {aiCopyError}
          </p>
        ) : null}
      </div>
    );
  }

  const visibleSubcategories = useMemo(() => {
    const query = taxonomyQuery.trim().toLowerCase();
    const items = query
      ? subcategories.filter(
          item =>
            labelFor(locale, item).toLowerCase().includes(query) ||
            item.slug.includes(query),
        )
      : subcategories;
    return showAllTaxonomy ? items : items.slice(0, 6);
  }, [locale, showAllTaxonomy, subcategories, taxonomyQuery]);

  const visibleIndustries = useMemo(() => {
    const query = taxonomyQuery.trim().toLowerCase();
    const items = query
      ? industries.filter(
          item =>
            labelFor(locale, item).toLowerCase().includes(query) ||
            item.slug.includes(query),
        )
      : industries;
    return showAllTaxonomy ? items : items.slice(0, 10);
  }, [industries, locale, showAllTaxonomy, taxonomyQuery]);

  const selectedSubcategory = useMemo(
    () => subcategories.find(item => item.slug === subcategorySlug),
    [subcategories, subcategorySlug],
  );

  const selectedIndustries = useMemo(
    () => industries.filter(item => industryIds.includes(item.slug)),
    [industries, industryIds],
  );

  const pendingDraftCategory = useMemo(() => {
    if (!pendingStoredDraft?.categorySlug) return null;
    const legacyId = categoryLegacyBySlug[pendingStoredDraft.categorySlug];
    return legacyId ? getCreateBusinessCategoryById(legacyId) : null;
  }, [pendingStoredDraft?.categorySlug]);

  const pendingDraftTitle = pendingStoredDraft
    ? valueAsString(pendingStoredDraft.formValues.title) ||
      valueAsString(pendingStoredDraft.formValues.item_name) ||
      valueAsString(pendingStoredDraft.formValues.item_needed) ||
      valueAsString(pendingStoredDraft.formValues.service_name) ||
      valueAsString(pendingStoredDraft.formValues.service_needed) ||
      valueAsString(pendingStoredDraft.formValues.equipment_name) ||
      valueAsString(pendingStoredDraft.formValues.equipment_needed) ||
      valueAsString(pendingStoredDraft.formValues.place_name) ||
      valueAsString(pendingStoredDraft.formValues.place_needed) ||
      valueAsString(pendingStoredDraft.formValues.opportunity_name) ||
      valueAsString(pendingStoredDraft.formValues.opportunity_needed) ||
      text(locale, 'Draft belum diberi judul', 'Untitled draft')
    : '';

  const pendingDraftIntentLabel =
    pendingStoredDraft?.intent === 'request'
      ? text(locale, 'Mencari', 'Request')
      : pendingStoredDraft?.intent === 'offer'
        ? text(locale, 'Menawarkan', 'Offer')
        : text(locale, 'Belum memilih tujuan', 'Purpose not selected');

  const previewKind: GlobalSearchItem['kind'] =
    intent === 'request'
      ? 'needs'
      : categorySlug === 'services' || categorySlug === 'business-opportunities'
        ? 'services'
        : 'products';
  const requestDeadlineLabel =
    valueAsString(values.needed_by) ||
    valueAsString(values.target_done) ||
    valueAsString(values.target_move);
  const requestPreviewMetadata: GlobalSearchItem['metadata'] =
    intent === 'request'
      ? {
          budget_label: requestBudgetLabel(locale, values),
          request_status: 'open',
          quantity: valueAsString(values.quantity) || null,
          unit: valueAsString(values.unit) || null,
          needed_by: valueAsString(values.needed_by) || null,
          target_done: valueAsString(values.target_done) || null,
          target_move: valueAsString(values.target_move) || null,
          need_frequency: valueAsString(values.need_frequency) || null,
          provider_criteria: valueAsString(values.provider_criteria) || null,
          minimum_capacity: valueAsString(values.minimum_capacity) || null,
          required_facilities:
            valueAsStringList(values.required_facilities).join(', ') || null,
          required_certifications:
            valueAsStringList(values.required_certifications).join(', ') ||
            null,
        }
      : { preview: true };
  const previewItem: GlobalSearchItem = {
    id: serverDraft?.id || 'preview',
    kind: previewKind,
    href: '',
    title:
      valueAsString(values.title) ||
      valueAsString(values.item_name) ||
      valueAsString(values.item_needed) ||
      valueAsString(values.service_name) ||
      valueAsString(values.service_needed) ||
      valueAsString(values.equipment_name) ||
      valueAsString(values.equipment_needed) ||
      valueAsString(values.place_name) ||
      valueAsString(values.place_needed) ||
      valueAsString(values.opportunity_name) ||
      valueAsString(values.opportunity_needed) ||
      text(locale, 'Draft postingan', 'Draft post'),
    summary:
      valueAsString(values.summary) ||
      text(
        locale,
        'Ringkasan akan tampil di sini.',
        'Summary will appear here.',
      ),
    location:
      valueAsString(values.location) ||
      valueAsString(values.service_area) ||
      valueAsString(values.address) ||
      (intent === 'request'
        ? text(locale, 'Area fleksibel', 'Flexible area')
        : text(locale, 'Lokasi belum diisi', 'Location not set')),
    priceLabel:
      intent === 'request'
        ? requestBudgetLabel(locale, values)
        : formatRupiahLabel(values.price_amount)
          ? formatRupiahLabel(values.price_amount)
          : text(locale, 'Harga belum diisi', 'Price not set'),
    image:
      media.find(item => item.url || item.preview)?.url ||
      media.find(item => item.preview)?.preview ||
      null,
    label: selectedSubcategory
      ? labelFor(locale, selectedSubcategory)
      : category
        ? text(locale, category.titleId, category.titleEn)
        : text(locale, 'Postingan', 'Listing'),
    ownerName: '',
    verified: false,
    side: intent === 'request' ? 'demand' : 'supply',
    memberCount: null,
    viewCount: null,
    durationLabel: requestDeadlineLabel,
    metadata: requestPreviewMetadata,
  };

  if (!hydrated) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-[1700px] items-center justify-center px-4">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </main>
    );
  }

  const step = CREATE_STEPS[currentStep - 1];
  const stepFields =
    currentStep === 5
      ? fieldsForStep(fieldSchema, 5)
          .filter(field => showMoreDetails || field.group !== 'additional')
          .slice(0, showMoreDetails ? 12 : 5)
      : currentStep === 4
        ? orderMainStepFields(fieldsForStep(fieldSchema, 4))
        : currentStep === 7
          ? fieldsForStep(fieldSchema, 7).slice(0, 6)
          : currentStep === 8
            ? fieldsForStep(fieldSchema, 8).slice(0, 5)
            : [];
  const showRequiredHint =
    currentStep === 3 || stepFields.some(field => field.required);
  const phaseIndex = currentStep <= 3 ? 1 : currentStep <= 8 ? 2 : 3;
  const phaseLabels =
    locale === 'id' ? ['Pilih', 'Isi', 'Tinjau'] : ['Choose', 'Fill', 'Review'];
  const phaseProgress =
    currentStep <= 3
      ? currentStep / 3
      : currentStep <= 8
        ? (currentStep - 3) / 5
        : 1;
  const totalProgress = ((phaseIndex - 1 + phaseProgress) / 3) * 100;

  const nextButtonLabel =
    currentStep === 9
      ? text(locale, 'Terbitkan', 'Publish now')
      : currentStep === 3 && !subcategorySlug
        ? text(locale, 'Pilih jenis dulu', 'Choose subcategory first')
        : text(locale, 'Lanjut', 'Next');
  const selectedLocationPoint =
    readLatLngFromValues(values) || DEFAULT_CREATE_LOCATION_POINT;

  return (
    <main className="min-h-screen bg-transparent pb-32 text-slate-950 dark:text-slate-50 lg:pb-28">
      <div className="mx-auto w-full max-w-[1180px] px-2 py-3 sm:px-4 lg:px-5 lg:py-4">
        <div className="mb-3">
          <p className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-300">
            {text(locale, 'Buat postingan usaha', 'Create business post')} -{' '}
            {text(locale, 'Tahap', 'Phase')} {phaseIndex}/3
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 !p-0 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{ width: `${totalProgress}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {phaseLabels.map((label, index) => {
              const active = index + 1 <= phaseIndex;
              return (
                <span
                  key={label}
                  className={cn(
                    'inline-flex min-h-[34px] items-center justify-center rounded-lg border px-3 text-xs font-bold',
                    active
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-100'
                      : 'border-slate-200 bg-white text-slate-400 dark:border-slate-800 dark:bg-slate-900',
                  )}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>

        <section className="rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4 lg:p-5">
          <div className="mb-4">
            <h1 className="text-xl font-bold tracking-normal sm:text-2xl">
              {currentStep === 4 && intent === 'request'
                ? text(locale, 'Isi kebutuhanmu', 'Describe your request')
                : currentStep === 3
                  ? text(
                      locale,
                      'Pilih jenis paling dekat',
                      'Choose the closest type',
                    )
                  : currentStep === 6 && intent === 'request'
                    ? text(locale, 'Referensi opsional', 'Optional references')
                    : text(locale, step.titleId, step.titleEn)}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              {currentStep === 4 && intent === 'request'
                ? text(
                    locale,
                    'Tulis kebutuhan utama agar penyedia yang cocok cepat paham.',
                    'Add the main details so suitable providers can help.',
                  )
                : currentStep === 3
                  ? text(
                      locale,
                      'Cukup pilih satu jenis. Industri boleh ditambah kalau sudah jelas.',
                      'Pick one type. Industry can be added only if it is clear.',
                    )
                  : currentStep === 6 && intent === 'request'
                    ? text(
                        locale,
                        'Opsional. Tambahkan foto referensi hanya kalau membantu penyedia memahami kebutuhanmu.',
                        'Optional. Add reference photos only if they help providers understand your need.',
                      )
                    : text(locale, step.descriptionId, step.descriptionEn)}
            </p>
            {showRequiredHint ? (
              <p className="mt-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span aria-hidden="true" className="mr-1 text-red-600">
                  *
                </span>
                {currentStep === 3
                  ? text(
                      locale,
                      'Yang wajib hanya jenis utama',
                      'Only the main type is required',
                    )
                  : text(locale, 'Wajib diisi', 'Required field')}
              </p>
            ) : null}
          </div>

          {error ? (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{error}</span>
            </div>
          ) : null}

          {currentStep === 1 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                {
                  value: 'offer' as const,
                  titleId: 'Tawarkan',
                  titleEn: 'I want to offer',
                  bodyId:
                    'Pasang bahan, jasa, alat, tempat, atau peluang usaha.',
                  bodyEn:
                    'Post a product, service, place, or business opportunity.',
                  imageSrc: '/images/create/kategori/tawar.png',
                },
                {
                  value: 'request' as const,
                  titleId: 'Butuh sesuatu',
                  titleEn: 'I need something',
                  bodyId:
                    'Buat kebutuhan agar penyedia yang cocok bisa menghubungimu.',
                  bodyEn:
                    'Create a request so suitable providers can contact you.',
                  imageSrc: '/images/create/kategori/cari.png',
                },
              ].map(item => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setIntent(item.value);
                    setCurrentStep(2);
                    setSaveStatus('saved');
                  }}
                  className={cn(
                    'min-h-[112px] rounded-[8px] border p-3 text-left transition',
                    intent === item.value
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50'
                      : 'border-slate-200 bg-white hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-900',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Image
                      src={item.imageSrc}
                      alt={text(locale, item.titleId, item.titleEn)}
                      width={120}
                      height={120}
                      className="h-16 w-16 shrink-0 rounded-full border border-white/80 object-cover !p-0 shadow-sm sm:h-20 sm:w-20"
                      draggable={false}
                    />
                    <div className="min-w-0">
                      <p className="text-base font-bold">
                        {text(locale, item.titleId, item.titleEn)}
                      </p>
                      <p className="mt-1.5 text-sm leading-5 text-slate-600 dark:text-slate-300">
                        {text(locale, item.bodyId, item.bodyEn)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {currentStep === 2 ? (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {CREATE_BUSINESS_CATEGORIES.map(item => {
                const copy = intent ? categoryCopy(item, intent, locale) : null;
                const visual = getCreateBusinessCategoryImage(item.id);
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
                    }}
                    className={cn(
                      'group rounded-[8px] border p-3 text-left transition',
                      categorySlug === item.slugEn
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                        : 'border-slate-200 bg-white hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-900',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          'relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border shadow-sm transition group-hover:scale-[1.02]',
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
                            alt={text(locale, item.titleId, item.titleEn)}
                            width={visual.imageSize}
                            height={visual.imageSize}
                            className="pointer-events-none h-full w-full select-none object-contain transition-transform duration-300 group-hover:scale-105"
                            draggable={false}
                          />
                        </span>
                      </span>
                      <div className="min-w-0 ml-2">
                        <p className="text-base font-bold">
                          {text(locale, item.titleId, item.titleEn)}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {text(locale, item.badgeId, item.badgeEn)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-600 dark:text-slate-300">
                      {copy?.description}
                    </p>
                    <p className="mt-2 line-clamp-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      {copy?.example}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : null}

          {currentStep === 3 ? (
            <div className="space-y-4">
              {taxonomyLoading ? (
                <p className="text-sm text-slate-500">
                  {text(locale, 'Memuat pilihan...', 'Loading options...')}
                </p>
              ) : null}
              <div>
                <h2 className="mb-3 text-sm font-bold">
                  {text(locale, 'Jenis paling dekat', 'Closest type')}
                  <span aria-hidden="true" className="ml-0.5 text-red-600">
                    *
                  </span>
                  <span className="sr-only">
                    {' '}
                    {text(locale, 'wajib diisi', 'required')}
                  </span>
                </h2>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleSubcategories.map(item => (
                    <button
                      key={item.slug}
                      type="button"
                      aria-pressed={subcategorySlug === item.slug}
                      onClick={() => {
                        setSubcategorySlug(item.slug);
                        setError('');
                      }}
                      className={cn(
                        'flex min-h-[46px] items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm font-semibold',
                        subcategorySlug === item.slug
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-50'
                          : 'border-slate-200 bg-white hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-900',
                      )}
                    >
                      <span>{labelFor(locale, item)}</span>
                      {subcategorySlug === item.slug ? (
                        <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                      ) : null}
                    </button>
                  ))}
                </div>
                {visibleSubcategories.length === 0 ? (
                  <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    {text(
                      locale,
                      'Tidak ada subkategori yang cocok. Coba hapus kata kunci atau pilih dari daftar awal.',
                      'No matching subcategory. Try clearing the keyword or choosing from the initial list.',
                    )}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  className="min-h-[38px] flex-1 bg-transparent text-sm outline-none"
                  value={taxonomyQuery}
                  onChange={event => setTaxonomyQuery(event.target.value)}
                  placeholder={text(
                    locale,
                    'Tidak ketemu? Cari di sini',
                    'Not seeing it? Search here',
                  )}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowAllTaxonomy(value => !value)}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-slate-200 px-3 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"
              >
                <ChevronDown className="h-4 w-4" />
                {showAllTaxonomy
                  ? text(locale, 'Lebih sedikit', 'Show less')
                  : text(locale, 'Pilihan lainnya', 'More options')}
              </button>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
                <button
                  type="button"
                  onClick={() => setShowIndustryChoices(value => !value)}
                  className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-900 dark:text-slate-50">
                      {text(
                        locale,
                        'Industri terkait (opsional)',
                        'Related industries (optional)',
                      )}
                    </span>
                    <span className="mt-1 block truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {selectedIndustries.length > 0
                        ? selectedIndustries
                            .map(item => labelFor(locale, item))
                            .slice(0, 3)
                            .join(', ')
                        : text(
                            locale,
                            'Lewati kalau belum yakin.',
                            'Skip this if you are not sure.',
                          )}
                      {selectedIndustries.length > 3
                        ? ` +${selectedIndustries.length - 3}`
                        : ''}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-slate-500 transition',
                      showIndustryChoices && 'rotate-180',
                    )}
                  />
                </button>
                {showIndustryChoices ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {visibleIndustries.map(item => {
                      const active = industryIds.includes(item.slug);
                      return (
                        <button
                          key={item.slug}
                          type="button"
                          onClick={() => {
                            setIndustryIds(previous =>
                              active
                                ? previous.filter(value => value !== item.slug)
                                : [...previous, item.slug],
                            );
                            setError('');
                          }}
                          aria-pressed={active}
                          className={cn(
                            'inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3 text-sm font-semibold',
                            active
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-50'
                              : 'border-slate-200 bg-white hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-900',
                          )}
                        >
                          {active ? <Check className="h-3.5 w-3.5" /> : null}
                          {labelFor(locale, item)}
                        </button>
                      );
                    })}
                    {visibleIndustries.length === 0 ? (
                      <p className="w-full rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        {text(
                          locale,
                          'Tidak ada industri yang cocok. Coba kata kunci lain atau lanjut tanpa memilih.',
                          'No matching industry. Try another keyword or continue without choosing one.',
                        )}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {[4, 5, 7, 8].includes(currentStep) ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {currentStep === 4 ? (
                <>
                  {stepFields
                    .filter(field => !GENERATED_COPY_FIELD_KEYS.has(field.key))
                    .map(renderFieldGridItem)}
                  <div className="lg:col-span-2">
                    {renderAiCopyHelper()}
                  </div>
                  {stepFields
                    .filter(field => GENERATED_COPY_FIELD_KEYS.has(field.key))
                    .map(renderFieldGridItem)}
                </>
              ) : (
                stepFields.map(renderFieldGridItem)
              )}
              {currentStep === 5 && !showMoreDetails ? (
                <div className="lg:col-span-2">
                  <button
                    type="button"
                    onClick={() => setShowMoreDetails(true)}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold dark:border-slate-700"
                  >
                    <Plus className="h-4 w-4" />
                    {text(
                      locale,
                      'Tambahkan detail lainnya',
                      'Add more details',
                    )}
                  </button>
                </div>
              ) : null}
              {currentStep === 7 && categorySlug === 'business-places' ? (
                <div className="lg:col-span-2">
                  <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    <MapPin className="mb-2 h-5 w-5 text-emerald-600" />
                    {text(
                      locale,
                      'Peta akan dimuat setelah alamat dipilih agar halaman tetap ringan dan scroll tidak terkunci.',
                      'Map loads after address is chosen so the page stays light and scroll remains usable.',
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {currentStep === 6 ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                <div className="text-center">
                  <Images className="mx-auto mb-2 h-6 w-6 text-emerald-600" />
                  <p className="text-sm font-bold">
                    {text(
                      locale,
                      intent === 'request'
                        ? 'Foto referensi opsional'
                        : 'Tambahkan gambar dari galeri atau kamera',
                      intent === 'request'
                        ? 'Reference photos are optional'
                        : 'Add images from gallery or camera',
                    )}
                  </p>
                  <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">
                    {text(
                      locale,
                      intent === 'request'
                        ? 'Brief teks sudah cukup untuk kebutuhan. Pakai foto hanya untuk ukuran, kondisi, contoh hasil, atau referensi visual.'
                        : 'Pilih foto yang sudah ada, atau ambil foto baru kalau barang/referensinya sedang di depan kamu.',
                      intent === 'request'
                        ? 'A text brief is enough for a need. Use photos only for size, condition, expected output, or visual references.'
                        : 'Choose existing photos, or take a new photo if the item/reference is in front of you.',
                    )}
                  </p>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <label className="inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm">
                    <Images className="h-4 w-4" />
                    {text(locale, 'Pilih dari galeri', 'Choose from gallery')}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      onChange={event => {
                        void uploadSelected(event.target.files);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                  <label className="inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                    <Camera className="h-4 w-4" />
                    {text(locale, 'Ambil foto', 'Take photo')}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      onChange={event => {
                        void uploadSelected(event.target.files);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                </div>
                <p className="mt-3 text-center text-xs text-slate-500">
                  {text(
                    locale,
                    intent === 'request'
                      ? 'Kamu bisa lanjut tanpa gambar. Jika ada foto, foto pertama otomatis jadi cover.'
                      : 'Bisa upload beberapa gambar. Foto pertama otomatis jadi cover.',
                    intent === 'request'
                      ? 'You can continue without images. If added, the first photo becomes the cover.'
                      : 'You can upload multiple images. The first photo becomes the cover.',
                  )}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {media.map(item => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
                  >
                    {item.preview || item.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.preview || item.url}
                        alt=""
                        className="aspect-video w-full rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex aspect-video items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800">
                        <Camera className="h-6 w-6 text-slate-400" />
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                      <span
                        className={cn(
                          item.status === 'failed'
                            ? 'text-red-600'
                            : 'text-slate-500',
                        )}
                      >
                        {item.error || item.status}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setMedia(previous =>
                            previous.filter(value => value.id !== item.id),
                          )
                        }
                        className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <FileText className="mb-2 h-5 w-5 text-slate-500" />
                <p className="text-sm font-bold">
                  {text(locale, 'Dokumen pendukung', 'Supporting documents')}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {text(
                    locale,
                    'Opsional. Tambahkan hanya jika membantu menjelaskan penawaran atau kebutuhanmu.',
                    'Optional. Add only if it helps explain your offer or request.',
                  )}
                </p>
              </div>
            </div>
          ) : null}

          {currentStep === 9 ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
              <div className="space-y-3">
                {[
                  ['Informasi utama', 4],
                  ['Detail', 5],
                  [
                    intent === 'request'
                      ? text(locale, 'Referensi', 'References')
                      : text(locale, 'Media', 'Media'),
                    6,
                  ],
                  ['Lokasi', 7],
                  ['Kontak', 8],
                ].map(([label, step]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setCurrentStep(Number(step))}
                    className="flex min-h-[52px] w-full items-center justify-between rounded-lg border border-slate-200 px-3 text-left text-sm font-semibold dark:border-slate-700"
                  >
                    <span>{label}</span>
                    <span className="text-emerald-700 dark:text-emerald-300">
                      {text(locale, 'Edit', 'Edit')}
                    </span>
                  </button>
                ))}
              </div>
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
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {saveStatus === 'saving' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saveStatus === 'saved' ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : null}
            <span>
              {saveStatus === 'saving'
                ? text(locale, 'Menyimpan...', 'Saving...')
                : saveStatus === 'offline'
                  ? text(
                      locale,
                      'Tersimpan di perangkat. Akan disinkronkan saat online.',
                      'Saved on device. Will sync when online.',
                    )
                  : saveStatus === 'error'
                    ? text(locale, 'Gagal menyimpan', 'Failed to save')
                    : lastSavedAt
                      ? text(locale, 'Tersimpan otomatis', 'Autosaved')
                      : text(
                          locale,
                          'Tersimpan di perangkat',
                          'Saved on device',
                        )}
            </span>
          </div>
        </section>
      </div>

      {pendingStoredDraft ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/45 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-draft-choice-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-950 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2
                  id="create-draft-choice-title"
                  className="text-lg font-bold text-slate-950 dark:text-slate-50"
                >
                  {text(
                    locale,
                    'Ada draft yang belum selesai',
                    'You have an unfinished draft',
                  )}
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {text(
                    locale,
                    'Kamu mau lanjut edit data lama, atau mulai ulang dengan form kosong?',
                    'Do you want to keep editing the old data, or start again with an empty form?',
                  )}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="font-bold text-slate-950 dark:text-slate-50">
                {pendingDraftTitle}
              </p>
              <div className="mt-2 grid gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 sm:grid-cols-2">
                <span>
                  {pendingDraftIntentLabel}
                  {pendingDraftCategory
                    ? ` - ${text(
                        locale,
                        pendingDraftCategory.titleId,
                        pendingDraftCategory.titleEn,
                      )}`
                    : ''}
                </span>
                <span>
                  {text(locale, 'Langkah', 'Step')}{' '}
                  {pendingStoredDraft.currentStep} {text(locale, 'dari', 'of')}{' '}
                  {STEP_COUNT}
                </span>
                <span className="sm:col-span-2">
                  {text(locale, 'Terakhir disimpan', 'Last saved')}:{' '}
                  {formatDraftUpdatedAt(locale, pendingStoredDraft.updatedAt)}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                onClick={continueStoredDraft}
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white"
              >
                <Check className="h-4 w-4" />
                {text(locale, 'Lanjutkan draft', 'Continue draft')}
              </button>
              <button
                type="button"
                onClick={startFreshDraft}
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg border border-red-200 px-4 text-sm font-bold text-red-700 dark:border-red-900/70 dark:text-red-300"
              >
                <Trash2 className="h-4 w-4" />
                {text(locale, 'Mulai ulang', 'Start again')}
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              {text(
                locale,
                'Mulai ulang akan menghapus draft yang tersimpan di perangkat ini.',
                'Starting again removes the draft saved on this device.',
              )}
            </p>
          </div>
        </div>
      ) : null}

      {mapPickerFieldKey ? (
        <div
          className="!m-0 fixed inset-0 z-[120000] flex items-stretch justify-center bg-black/60 backdrop-blur-[2px] sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-map-picker-title"
        >
          <div className="relative z-[1] flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-950 sm:h-[min(92vh,860px)] sm:max-w-6xl sm:rounded-[28px]">
            <div className="relative z-[3] flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <h2
                  id="create-map-picker-title"
                  className="text-base font-bold text-slate-950 dark:text-slate-50 sm:text-lg"
                >
                  {text(
                    locale,
                    'Cari dan pilih lokasi',
                    'Search and pick a location',
                  )}
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {text(
                    locale,
                    'Ketik alamat seperti di Maps, pilih lokasi usaha, atau geser pin kalau titiknya perlu dirapikan.',
                    'Type an address like Maps, pick a business location, or drag the pin if the point needs a small adjustment.',
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMapPickerFieldKey(null)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                aria-label={text(locale, 'Tutup peta', 'Close map')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative z-[1] min-h-0 flex-1 bg-slate-100 dark:bg-slate-900">
              <UmkmLocationPicker
                value={selectedLocationPoint}
                onChange={setLocationPoint}
                isId={locale === 'id'}
                localSuggestions={ownedStoreLocations}
                selectedLocation={readSelectedLocationFromValues(values)}
                onLocationChange={location =>
                  setStructuredLocation(
                    location,
                    mapPickerFieldKey || undefined,
                  )
                }
                markerLabel={text(
                  locale,
                  'Titik lokasi postingan',
                  'Listing location point',
                )}
                className="h-full rounded-none border-0 shadow-none [&_.leaflet-container]:!h-full [&_.leaflet-container]:!min-h-[360px] sm:[&_.leaflet-container]:!min-h-[520px]"
              />
            </div>
            <div className="relative z-[3] flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {text(locale, 'Koordinat', 'Coordinates')}:{' '}
                <span className="text-slate-800 dark:text-slate-100">
                  {formatLatLng(selectedLocationPoint)}
                </span>
              </p>
              <button
                type="button"
                onClick={() => setMapPickerFieldKey(null)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white"
              >
                {text(locale, 'Gunakan titik ini', 'Use this point')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!pendingStoredDraft ? (
        <div className="fixed inset-x-0 bottom-0 z-[70] border-t border-slate-200 bg-white/95 px-3 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:px-4">
          <div className="mx-auto flex max-w-[1180px] items-center gap-2 pb-[env(safe-area-inset-bottom)]">
            <button
              type="button"
              onClick={() => setCurrentStep(step => Math.max(1, step - 1))}
              disabled={currentStep === 1}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold disabled:opacity-40 dark:border-slate-700"
              aria-label={text(locale, 'Kembali', 'Back')}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">
                {text(locale, 'Kembali', 'Back')}
              </span>
            </button>
            {currentStep >= 2 ? (
              <button
                type="button"
                onClick={saveAndExit}
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold dark:border-slate-700"
                aria-label={text(locale, 'Simpan & keluar', 'Save & exit')}
              >
                <Save className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {text(locale, 'Simpan & keluar', 'Save & exit')}
                </span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={currentStep === 9 ? publish : goNext}
              className="ml-auto inline-flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-bold text-white sm:flex-none sm:px-4"
              aria-label={nextButtonLabel}
            >
              <span className="min-w-0 truncate">{nextButtonLabel}</span>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
