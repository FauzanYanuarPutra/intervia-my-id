import { afterEach, describe, expect, it, vi } from 'vitest';
import { recoverStaleBodyScrollLock } from './useBodyScrollLock';

type MockElement = {
  style: Record<string, string>;
  dataset: Record<string, string | undefined>;
};

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;

function installMockDom() {
  const body: MockElement = {
    style: {
      overflow: 'hidden',
      position: 'fixed',
      top: '-240px',
      left: '0',
      right: '0',
      width: '100%',
      paddingRight: '12px',
      overscrollBehaviorY: 'none',
    },
    dataset: {},
  };
  const documentElement: MockElement = {
    style: {
      overflow: 'hidden',
      overscrollBehavior: 'none',
      scrollbarGutter: 'stable',
    },
    dataset: { bodyScrollLocked: 'true' },
  };
  const scrollTo = vi.fn();

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { body, documentElement },
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { scrollY: 0, scrollTo },
  });

  return { body, documentElement, scrollTo };
}

afterEach(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow,
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: originalDocument,
  });
});

describe('recoverStaleBodyScrollLock', () => {
  it('clears leftover lock styles after returning to a document-scrolling route', () => {
    const { body, documentElement, scrollTo } = installMockDom();

    recoverStaleBodyScrollLock();

    expect(body.style.overflow).toBe('');
    expect(body.style.position).toBe('');
    expect(body.style.top).toBe('');
    expect(body.style.paddingRight).toBe('');
    expect(documentElement.style.overflow).toBe('');
    expect(documentElement.style.overscrollBehavior).toBe('');
    expect(documentElement.dataset.bodyScrollLocked).toBeUndefined();
    expect(scrollTo).toHaveBeenCalledWith(0, 240);
  });
});
