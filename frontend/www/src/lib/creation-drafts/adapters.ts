import type { DraftMedia as ListingDraftMedia } from '@/lib/create/createDraftStorage';
import { isSelectedLocation } from '@/lib/location/location.utils';
import type { SelectedLocation } from '@/lib/location/location.types';
import type { UmkmBusinessCategoryId } from '@/lib/super-app/umkm-taxonomy';
import type {
  AICreationDraft,
  BusinessProfileDraftPayload,
  LookingForDraftPayload,
  OfferingDraftPayload,
} from './types';

export type ListingCreationPrefill = {
  intent: 'offer' | 'request';
  categoryId: 'supplies' | 'service' | 'equipment' | 'property' | 'opportunity';
  subcategorySlug?: string;
  industryIds: string[];
  values: Record<string, unknown>;
  media: ListingDraftMedia[];
};

export type BusinessCreationPrefill = {
  name: string;
  category: UmkmBusinessCategoryId;
  city: string;
  address: string;
  photoUrl: string;
  selectedLocation: SelectedLocation | null;
};

const LISTING_CATEGORY_IDS = new Set<ListingCreationPrefill['categoryId']>([
  'supplies',
  'service',
  'equipment',
  'property',
  'opportunity',
]);

const BUSINESS_CATEGORIES = new Set<UmkmBusinessCategoryId>([
  'culinary',
  'warung_kios',
  'grocery_retail',
  'fashion_apparel',
  'beauty_personal_care',
  'crafts_souvenirs',
  'home_living',
  'health_wellness',
  'agri_fishery',
  'automotive_tools',
  'electronics_accessories',
  'books_stationery_printing',
  'baby_kids_family',
  'pets_hobbies',
  'services_local',
  'digital_creative',
]);

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function listingNameField(
  categoryId: ListingCreationPrefill['categoryId'],
  intent: ListingCreationPrefill['intent'],
) {
  const suffix = intent === 'offer' ? 'name' : 'needed';
  if (categoryId === 'supplies') return intent === 'offer' ? 'item_name' : 'item_needed';
  if (categoryId === 'service') return `service_${suffix}`;
  if (categoryId === 'equipment') return `equipment_${suffix}`;
  if (categoryId === 'property') return `place_${suffix}`;
  return `opportunity_${suffix}`;
}

function listingMedia(draft: AICreationDraft): ListingDraftMedia[] {
  return draft.media
    .filter(item => item.type === 'image' && Boolean(item.url || item.assetId))
    .map((item, index) => ({
      id: item.assetId || `creation-media-${index}`,
      url: item.url || item.assetId,
      preview: item.url || item.assetId,
      name: item.altText || `AI image ${index + 1}`,
      status: 'uploaded' as const,
    }));
}

export function mapCreationDraftToListingPrefill(
  draft: AICreationDraft,
): ListingCreationPrefill | null {
  if (
    draft.target !== 'offering_listing' &&
    draft.target !== 'looking_for_listing'
  ) {
    return null;
  }
  const intent = draft.target === 'looking_for_listing' ? 'request' : 'offer';
  const payload = draft.payload as OfferingDraftPayload | LookingForDraftPayload;
  const categoryCandidate = asText(payload.categorySlug) as ListingCreationPrefill['categoryId'];
  const categoryId = LISTING_CATEGORY_IDS.has(categoryCandidate)
    ? categoryCandidate
    : 'supplies';
  const title = asText(payload.title) || draft.title;
  const description = asText(payload.description) || draft.summary || '';
  const locationText = asText(payload.locationText);
  const values: Record<string, unknown> = {
    title,
    summary: description,
    [listingNameField(categoryId, intent)]: title,
    ...(locationText ? { location: locationText } : {}),
  };

  if (payload.target === 'offering_listing') {
    values.price_mode = payload.priceType === 'fixed' ? 'fixed' : 'negotiable';
    if (typeof payload.price === 'number' && Number.isFinite(payload.price)) {
      values.price_amount = payload.price;
    }
    if (payload.condition) values.condition = payload.condition;
  } else {
    values.budget_mode = payload.budgetMax ? 'maximum_budget' : 'undetermined';
    if (typeof payload.budgetMax === 'number' && Number.isFinite(payload.budgetMax)) {
      values.price_amount = payload.budgetMax;
    }
    if (typeof payload.quantity === 'number' && Number.isFinite(payload.quantity)) {
      values.quantity = `${payload.quantity}${payload.unit ? ` ${payload.unit}` : ''}`;
    }
    if (payload.unit) values.unit = payload.unit;
    if (payload.neededAt) values.needed_by = payload.neededAt;
  }

  const structuredLocation =
    payload.target === 'offering_listing'
      ? payload.location
      : payload.destinationLocation;
  if (isSelectedLocation(structuredLocation)) {
    values.location = structuredLocation.formattedAddress || structuredLocation.name;
    values.location_structured = structuredLocation;
    values.location_place_id = structuredLocation.placeId;
    values.location_provider = structuredLocation.provider || 'osm';
    values.location_lat = structuredLocation.latitude;
    values.location_lng = structuredLocation.longitude;
    values.location_point = {
      lat: structuredLocation.latitude,
      lng: structuredLocation.longitude,
    };
  }

  return {
    intent,
    categoryId,
    subcategorySlug: asText(payload.subcategorySlug) || undefined,
    industryIds: Array.isArray(payload.industryIds)
      ? payload.industryIds.map(asText).filter(Boolean).slice(0, 8)
      : [],
    values,
    media: listingMedia(draft),
  };
}

export function mapCreationDraftToBusinessPrefill(
  draft: AICreationDraft,
): BusinessCreationPrefill | null {
  if (draft.target !== 'business_profile') return null;
  const payload = draft.payload as BusinessProfileDraftPayload;
  const categoryCandidate = asText(payload.businessCategory) as UmkmBusinessCategoryId;
  const category = BUSINESS_CATEGORIES.has(categoryCandidate)
    ? categoryCandidate
    : 'culinary';
  const selectedLocation = isSelectedLocation(payload.location)
    ? payload.location
    : null;
  const photoUrl =
    draft.media.find(item => item.type === 'image' && (item.url || item.assetId))?.url ||
    draft.media.find(item => item.type === 'image')?.assetId ||
    '';
  return {
    name: asText(payload.businessName) || draft.title,
    category,
    city:
      selectedLocation?.city ||
      selectedLocation?.regency ||
      selectedLocation?.district ||
      '',
    address:
      selectedLocation?.formattedAddress || asText(payload.locationText),
    photoUrl,
    selectedLocation,
  };
}
