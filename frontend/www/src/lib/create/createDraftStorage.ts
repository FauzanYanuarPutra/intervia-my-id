import type { CreateIntent } from './createListingSchema';

export const TEMP_CREATE_DRAFT_KEY = 'lajukan:create:temporary-draft';
export const TEMP_CREATE_DRAFT_VERSION = 2;

export type DraftMedia = {
  id: string;
  url?: string;
  preview?: string;
  name?: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'failed' | 'deleted';
  error?: string;
};

export type TemporaryCreateDraft = {
  draftId?: string;
  draftVersion?: number;
  intent?: CreateIntent;
  categorySlug?: string;
  subcategorySlug?: string;
  industryIds: string[];
  currentStep: number;
  formValues: Record<string, unknown>;
  media: DraftMedia[];
  updatedAt: string;
  draftStorageVersion: number;
  idempotencyKey: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function createEmptyTemporaryDraft(): TemporaryCreateDraft {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return {
    industryIds: [],
    currentStep: 1,
    formValues: {},
    media: [],
    updatedAt: new Date().toISOString(),
    draftStorageVersion: TEMP_CREATE_DRAFT_VERSION,
    idempotencyKey: `create-${random}`,
  };
}

export function readTemporaryCreateDraft(): TemporaryCreateDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(TEMP_CREATE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;
    return {
      ...createEmptyTemporaryDraft(),
      ...parsed,
      industryIds: Array.isArray(parsed.industryIds)
        ? parsed.industryIds.filter(item => typeof item === 'string')
        : [],
      formValues: isRecord(parsed.formValues) ? parsed.formValues : {},
      media: Array.isArray(parsed.media) ? (parsed.media as DraftMedia[]) : [],
      currentStep:
        typeof parsed.currentStep === 'number'
          ? Math.max(1, Math.min(9, parsed.currentStep))
          : 1,
      updatedAt:
        typeof parsed.updatedAt === 'string'
          ? parsed.updatedAt
          : new Date().toISOString(),
      draftStorageVersion: TEMP_CREATE_DRAFT_VERSION,
      idempotencyKey:
        typeof parsed.idempotencyKey === 'string'
          ? parsed.idempotencyKey
          : createEmptyTemporaryDraft().idempotencyKey,
    };
  } catch {
    return null;
  }
}

export function hasTemporaryCreateDraftProgress(
  draft: TemporaryCreateDraft | null | undefined,
): draft is TemporaryCreateDraft {
  if (!draft) return false;
  return Boolean(
    draft.draftId ||
    draft.intent ||
    draft.categorySlug ||
    draft.subcategorySlug ||
    draft.industryIds.length > 0 ||
    draft.currentStep > 1 ||
    Object.keys(draft.formValues).length > 0 ||
    draft.media.length > 0,
  );
}

export function writeTemporaryCreateDraft(
  draft: TemporaryCreateDraft,
): TemporaryCreateDraft {
  const next = {
    ...draft,
    updatedAt: new Date().toISOString(),
    draftStorageVersion: TEMP_CREATE_DRAFT_VERSION,
  };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(TEMP_CREATE_DRAFT_KEY, JSON.stringify(next));
  }
  return next;
}

export function clearTemporaryCreateDraft() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(TEMP_CREATE_DRAFT_KEY);
  }
}
