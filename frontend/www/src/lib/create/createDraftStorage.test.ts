import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearTemporaryCreateDraft,
  createEmptyTemporaryDraft,
  hasTemporaryCreateDraftProgress,
  readTemporaryCreateDraft,
  writeTemporaryCreateDraft,
} from './createDraftStorage';

describe('temporary create draft storage', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
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

  it('stores a temporary draft as soon as intent is known', () => {
    const draft = writeTemporaryCreateDraft({
      ...createEmptyTemporaryDraft(),
      intent: 'offer',
      currentStep: 2,
    });

    const restored = readTemporaryCreateDraft();
    expect(restored?.intent).toBe('offer');
    expect(restored?.currentStep).toBe(2);
    expect(restored?.idempotencyKey).toBe(draft.idempotencyKey);
  });

  it('can be cleared explicitly', () => {
    writeTemporaryCreateDraft({
      ...createEmptyTemporaryDraft(),
      intent: 'request',
    });
    clearTemporaryCreateDraft();
    expect(readTemporaryCreateDraft()).toBeNull();
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
