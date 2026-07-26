import type { SelectedLocation } from '@/lib/location/location.types';

export type CreationTarget =
  | 'offering_listing'
  | 'looking_for_listing'
  | 'business_profile'
  | 'community_post'
  | 'reel'
  | 'business_opportunity'
  | 'job_listing';

export type SupportedCreationTarget = Extract<
  CreationTarget,
  'offering_listing' | 'looking_for_listing' | 'business_profile'
>;

export type CreationDraftStatus =
  | 'generating'
  | 'ready'
  | 'editing'
  | 'consumed'
  | 'expired'
  | 'discarded';

export type DraftMedia = {
  assetId: string;
  type: 'image' | 'video' | 'document';
  purpose?: 'cover' | 'gallery' | 'attachment' | 'reel';
  order: number;
  altText?: string;
  url?: string;
};

export type DraftFieldMetadata = {
  field: string;
  source:
    | 'user_message'
    | 'user_profile'
    | 'image_analysis'
    | 'ai_inference'
    | 'existing_data';
  confidence?: number;
  requiresConfirmation: boolean;
};

export type DraftWarning = {
  code: string;
  message: string;
  field?: string;
};

export type OfferingDraftPayload = {
  target: 'offering_listing';
  title?: string;
  description?: string;
  categorySlug?: string;
  subcategorySlug?: string;
  industryIds?: string[];
  price?: number;
  priceType?: 'fixed' | 'range' | 'negotiable' | 'contact';
  condition?: 'new' | 'used';
  attributes?: Record<string, string | number | boolean>;
  locationText?: string;
  location?: SelectedLocation;
  mediaAssetIds: string[];
  contactPreference?: 'chat' | 'whatsapp' | 'phone';
};

export type LookingForDraftPayload = {
  target: 'looking_for_listing';
  title?: string;
  description?: string;
  categorySlug?: string;
  subcategorySlug?: string;
  industryIds?: string[];
  quantity?: number;
  unit?: string;
  budgetMin?: number;
  budgetMax?: number;
  neededAt?: string;
  locationText?: string;
  destinationLocation?: SelectedLocation;
  mediaAssetIds: string[];
};

export type BusinessProfileDraftPayload = {
  target: 'business_profile';
  businessName?: string;
  description?: string;
  businessCategory?: string;
  locationText?: string;
  location?: SelectedLocation;
  phone?: string;
  whatsapp?: string;
  website?: string;
  logoAssetId?: string;
  coverAssetId?: string;
  galleryAssetIds?: string[];
};

export type SupportedCreationDraftPayload =
  | OfferingDraftPayload
  | LookingForDraftPayload
  | BusinessProfileDraftPayload;

export type AICreationDraft = {
  id: string;
  ownerId: string;
  target: CreationTarget;
  status: CreationDraftStatus;
  schemaVersion: number;
  draftVersion: number;
  payload: SupportedCreationDraftPayload | Record<string, unknown>;
  media: DraftMedia[];
  fieldMetadata: DraftFieldMetadata[];
  title: string;
  summary?: string;
  completenessScore: number;
  missingRequiredFields: string[];
  warnings: DraftWarning[];
  sourceConversationId?: string;
  createdBy: 'ai' | 'user' | 'admin';
  resourceId?: string;
  resourceUrl?: string;
  expiresAt: string;
  consumedAt?: string;
  createdAt: string;
  updatedAt: string;
  continueUrl?: string;
};

export const SUPPORTED_CREATION_TARGETS: SupportedCreationTarget[] = [
  'offering_listing',
  'looking_for_listing',
  'business_profile',
];

export function isSupportedCreationTarget(
  value: unknown,
): value is SupportedCreationTarget {
  return SUPPORTED_CREATION_TARGETS.includes(value as SupportedCreationTarget);
}

export function buildCreationDraftContinueUrl(
  locale: 'id' | 'en',
  draft: Pick<AICreationDraft, 'id' | 'target' | 'payload'>,
) {
  const query = `draft=${encodeURIComponent(draft.id)}`;
  if (draft.target === 'business_profile') {
    return `/${locale}/usaha/onboarding?${query}`;
  }

  const payload = draft.payload as OfferingDraftPayload | LookingForDraftPayload;
  const flow =
    draft.target === 'looking_for_listing'
      ? locale === 'id'
        ? 'butuh'
        : 'need'
      : locale === 'id'
        ? 'jual'
        : 'sell';
  const category = payload.categorySlug || 'supplies';
  return `/${locale}/create/${flow}/${encodeURIComponent(category)}?${query}`;
}

