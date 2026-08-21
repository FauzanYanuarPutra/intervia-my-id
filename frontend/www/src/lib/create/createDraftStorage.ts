import type { CreateIntent } from './createListingSchema';

/** Legacy v2 key. It had no owner binding and is intentionally never resumed. */
export const TEMP_CREATE_DRAFT_KEY = 'lajukan:create:temporary-draft';
export const TEMP_CREATE_DRAFT_KEY_PREFIX =
  'lajukan:create:temporary-draft:v3';
export const TEMP_CREATE_DRAFT_VERSION = 3;
export const TEMP_CREATE_DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
export const TEMP_CREATE_DRAFT_MAX_BYTES = 256 * 1_024;

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

type TemporaryCreateDraftEnvelope = {
  storageVersion: number;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  draft: TemporaryCreateDraft;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function safeText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim().slice(0, maxLength);
  return text || undefined;
}

function isRestorableUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const url = value.trim();
  if (!url || url.length > 2_048 || /^(?:blob|data):/i.test(url)) return false;
  return url.startsWith('/') || /^https:\/\//i.test(url);
}

function sanitizeJsonValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return undefined;
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    if (/^(?:blob|data):/i.test(value.trim())) return undefined;
    return value.slice(0, 20_000);
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, 100)
      .map(item => sanitizeJsonValue(item, depth + 1))
      .filter(item => item !== undefined);
  }
  if (!isRecord(value)) return undefined;

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 150)
      .map(([key, entry]) => [key, sanitizeJsonValue(entry, depth + 1)])
      .filter((entry): entry is [string, unknown] => entry[1] !== undefined),
  );
}

function sanitizeMedia(value: unknown): DraftMedia[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 20).flatMap((entry, index) => {
    if (!isRecord(entry)) return [];
    const id = safeText(entry.id, 160) || `restored-media-${index}`;
    const url = isRestorableUrl(entry.url) ? entry.url.trim() : undefined;
    const preview = isRestorableUrl(entry.preview)
      ? entry.preview.trim()
      : undefined;
    const canRestoreUploaded = entry.status === 'uploaded' && Boolean(url);
    const status: DraftMedia['status'] =
      entry.status === 'deleted'
        ? 'deleted'
        : canRestoreUploaded
          ? 'uploaded'
          : 'failed';

    return [
      {
        id,
        url,
        preview,
        name: safeText(entry.name, 200),
        status,
        error:
          status === 'failed'
            ? 'Media perlu dipilih atau diunggah ulang.'
            : undefined,
      },
    ];
  });
}

function sanitizeDraft(value: unknown): TemporaryCreateDraft | null {
  if (!isRecord(value)) return null;
  const empty = createEmptyTemporaryDraft();
  const intent =
    value.intent === 'request' || value.intent === 'offer'
      ? value.intent
      : undefined;
  const formValues = sanitizeJsonValue(value.formValues);

  return {
    ...empty,
    draftId: safeText(value.draftId, 160),
    draftVersion:
      typeof value.draftVersion === 'number' &&
      Number.isFinite(value.draftVersion)
        ? Math.max(0, Math.trunc(value.draftVersion))
        : undefined,
    intent,
    categorySlug: safeText(value.categorySlug, 120),
    subcategorySlug: safeText(value.subcategorySlug, 160),
    industryIds: Array.isArray(value.industryIds)
      ? value.industryIds
          .map(item => safeText(item, 120))
          .filter((item): item is string => Boolean(item))
          .slice(0, 50)
      : [],
    currentStep:
      typeof value.currentStep === 'number' &&
      Number.isFinite(value.currentStep)
        ? Math.max(1, Math.min(9, Math.trunc(value.currentStep)))
        : 1,
    formValues: isRecord(formValues) ? formValues : {},
    media: sanitizeMedia(value.media),
    updatedAt: safeText(value.updatedAt, 64) || new Date().toISOString(),
    draftStorageVersion: TEMP_CREATE_DRAFT_VERSION,
    idempotencyKey:
      safeText(value.idempotencyKey, 200) || empty.idempotencyKey,
  };
}

export function getTemporaryCreateDraftKey(ownerId: string): string | null {
  const normalizedOwnerId = ownerId.trim();
  if (!normalizedOwnerId) return null;
  return `${TEMP_CREATE_DRAFT_KEY_PREFIX}:${encodeURIComponent(normalizedOwnerId)}`;
}

function removeStorageKey(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable in private mode. The UI must remain usable.
  }
}

function discardUnownedLegacyDraft() {
  // v2 did not record an owner. Resuming it would expose form/contact data to
  // the next account on a shared browser, so migration deliberately fails closed.
  removeStorageKey(TEMP_CREATE_DRAFT_KEY);
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

export function readTemporaryCreateDraft(
  ownerId: string,
): TemporaryCreateDraft | null {
  if (typeof window === 'undefined') return null;
  const key = getTemporaryCreateDraftKey(ownerId);
  if (!key) return null;

  try {
    discardUnownedLegacyDraft();
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    if (new TextEncoder().encode(raw).byteLength > TEMP_CREATE_DRAFT_MAX_BYTES) {
      removeStorageKey(key);
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      removeStorageKey(key);
      return null;
    }

    const expiresAt = Date.parse(String(parsed.expiresAt || ''));
    const createdAt = Date.parse(String(parsed.createdAt || ''));
    const updatedAt = Date.parse(String(parsed.updatedAt || ''));
    if (
      parsed.storageVersion !== TEMP_CREATE_DRAFT_VERSION ||
      parsed.ownerId !== ownerId.trim() ||
      !Number.isFinite(createdAt) ||
      !Number.isFinite(updatedAt) ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now()
    ) {
      removeStorageKey(key);
      return null;
    }

    const draft = sanitizeDraft(parsed.draft);
    if (!draft) removeStorageKey(key);
    return draft;
  } catch {
    removeStorageKey(key);
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
  ownerId: string,
  draft: TemporaryCreateDraft,
): TemporaryCreateDraft {
  const key = getTemporaryCreateDraftKey(ownerId);
  const now = new Date();
  const next =
    sanitizeDraft({
      ...draft,
      updatedAt: now.toISOString(),
      draftStorageVersion: TEMP_CREATE_DRAFT_VERSION,
    }) || createEmptyTemporaryDraft();
  if (typeof window === 'undefined' || !key) return next;

  try {
    discardUnownedLegacyDraft();
    const existingRaw = window.localStorage.getItem(key);
    let createdAt = now.toISOString();
    if (existingRaw) {
      try {
        const existing = JSON.parse(existingRaw) as unknown;
        if (
          isRecord(existing) &&
          Number.isFinite(Date.parse(String(existing.createdAt)))
        ) {
          createdAt = String(existing.createdAt);
        }
      } catch {
        // Replace malformed owner-scoped data with the validated draft below.
      }
    }

    const envelope: TemporaryCreateDraftEnvelope = {
      storageVersion: TEMP_CREATE_DRAFT_VERSION,
      ownerId: ownerId.trim(),
      createdAt,
      updatedAt: now.toISOString(),
      expiresAt: new Date(
        now.getTime() + TEMP_CREATE_DRAFT_TTL_MS,
      ).toISOString(),
      draft: next,
    };
    const serialized = JSON.stringify(envelope);
    if (
      new TextEncoder().encode(serialized).byteLength <=
      TEMP_CREATE_DRAFT_MAX_BYTES
    ) {
      window.localStorage.setItem(key, serialized);
    }
  } catch {
    // Quota/private-mode failures must never crash the create flow.
  }
  return next;
}

export function clearTemporaryCreateDraft(ownerId: string) {
  if (typeof window === 'undefined') return;
  const key = getTemporaryCreateDraftKey(ownerId);
  if (key) removeStorageKey(key);
  discardUnownedLegacyDraft();
}
