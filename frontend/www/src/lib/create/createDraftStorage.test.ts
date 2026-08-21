import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TEMP_CREATE_DRAFT_KEY,
  TEMP_CREATE_DRAFT_MAX_BYTES,
  clearTemporaryCreateDraft,
  createEmptyTemporaryDraft,
  getTemporaryCreateDraftKey,
  hasTemporaryCreateDraftProgress,
  readTemporaryCreateDraft,
  writeTemporaryCreateDraft,
} from './createDraftStorage';

describe('temporary create draft storage', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores and restores progress only for its owner', () => {
    const draft = writeTemporaryCreateDraft('user-a', {
      ...createEmptyTemporaryDraft(),
      intent: 'offer',
      currentStep: 2,
    });

    const restored = readTemporaryCreateDraft('user-a');
    expect(restored?.intent).toBe('offer');
    expect(restored?.currentStep).toBe(2);
    expect(restored?.idempotencyKey).toBe(draft.idempotencyKey);
    expect(readTemporaryCreateDraft('user-b')).toBeNull();
  });

  it('can be cleared without touching another owner', () => {
    writeTemporaryCreateDraft('user-a', {
      ...createEmptyTemporaryDraft(),
      intent: 'request',
    });
    writeTemporaryCreateDraft('user-b', {
      ...createEmptyTemporaryDraft(),
      intent: 'offer',
    });

    clearTemporaryCreateDraft('user-a');
    expect(readTemporaryCreateDraft('user-a')).toBeNull();
    expect(readTemporaryCreateDraft('user-b')?.intent).toBe('offer');
  });

  it('fails closed for the unowned legacy key', () => {
    store.set(
      TEMP_CREATE_DRAFT_KEY,
      JSON.stringify({ formValues: { phone: 'private' }, currentStep: 7 }),
    );

    expect(readTemporaryCreateDraft('user-a')).toBeNull();
    expect(store.has(TEMP_CREATE_DRAFT_KEY)).toBe(false);
  });

  it('purges expired and oversized envelopes', () => {
    writeTemporaryCreateDraft('user-a', {
      ...createEmptyTemporaryDraft(),
      intent: 'request',
    });
    const key = getTemporaryCreateDraftKey('user-a')!;
    const expired = JSON.parse(store.get(key)!) as Record<string, unknown>;
    expired.expiresAt = new Date(Date.now() - 1_000).toISOString();
    store.set(key, JSON.stringify(expired));
    expect(readTemporaryCreateDraft('user-a')).toBeNull();
    expect(store.has(key)).toBe(false);

    store.set(key, 'x'.repeat(TEMP_CREATE_DRAFT_MAX_BYTES + 1));
    expect(readTemporaryCreateDraft('user-a')).toBeNull();
    expect(store.has(key)).toBe(false);
  });

  it('does not restore blob previews or in-flight upload state', () => {
    writeTemporaryCreateDraft('user-a', {
      ...createEmptyTemporaryDraft(),
      media: [
        {
          id: 'media-1',
          preview: 'blob:https://example.test/private',
          name: 'photo.jpg',
          status: 'uploading',
          error: 'raw provider details',
        },
      ],
    });

    const restored = readTemporaryCreateDraft('user-a');
    expect(restored?.media[0]).toMatchObject({
      id: 'media-1',
      status: 'failed',
      error: 'Media perlu dipilih atau diunggah ulang.',
    });
    expect(restored?.media[0]?.preview).toBeUndefined();
  });

  it('does not crash when browser storage is unavailable', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('quota');
        },
        removeItem: () => {
          throw new Error('blocked');
        },
      },
    });

    const draft = createEmptyTemporaryDraft();
    expect(() => writeTemporaryCreateDraft('user-a', draft)).not.toThrow();
    expect(readTemporaryCreateDraft('user-a')).toBeNull();
    expect(() => clearTemporaryCreateDraft('user-a')).not.toThrow();
  });

  it('detects whether a temporary draft has user progress', () => {
    expect(hasTemporaryCreateDraftProgress(createEmptyTemporaryDraft())).toBe(
      false,
    );
    expect(
      hasTemporaryCreateDraftProgress({
        ...createEmptyTemporaryDraft(),
        categorySlug: 'materials-suppliers',
        currentStep: 3,
      }),
    ).toBe(true);
    expect(
      hasTemporaryCreateDraftProgress({
        ...createEmptyTemporaryDraft(),
        formValues: { title: 'Supplier kopi' },
      }),
    ).toBe(true);
  });
});
