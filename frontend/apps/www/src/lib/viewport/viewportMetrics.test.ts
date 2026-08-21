import { describe, expect, it } from 'vitest';
import {
  isEditableElementSnapshot,
  resolveViewportMetrics,
} from './viewportMetrics';

describe('viewport metrics', () => {
  it('detects editable targets without user-agent checks', () => {
    expect(isEditableElementSnapshot({ tagName: 'input' })).toBe(true);
    expect(isEditableElementSnapshot({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isEditableElementSnapshot({ tagName: 'select' })).toBe(true);
    expect(isEditableElementSnapshot({ isContentEditable: true })).toBe(true);
    expect(isEditableElementSnapshot({ role: 'textbox' })).toBe(true);
    expect(isEditableElementSnapshot({ tagName: 'button' })).toBe(false);
  });

  it('does not treat omnibox resize as keyboard without editable focus', () => {
    const metrics = resolveViewportMetrics({
      layoutHeight: 800,
      visualHeight: 620,
      visualWidth: 390,
      offsetTop: 0,
      hasEditableFocus: false,
    });

    expect(metrics.keyboardOpen).toBe(false);
    expect(metrics.keyboardInset).toBe(0);
    expect(metrics.visualHeight).toBe(620);
  });

  it('detects keyboard only when editable focus and inset are plausible', () => {
    const metrics = resolveViewportMetrics({
      layoutHeight: 820,
      visualHeight: 510,
      visualWidth: 390,
      offsetTop: 0,
      hasEditableFocus: true,
    });

    expect(metrics.keyboardOpen).toBe(true);
    expect(metrics.keyboardInset).toBe(310);
  });

  it('ignores pinch-zoom viewport deltas', () => {
    const metrics = resolveViewportMetrics({
      layoutHeight: 820,
      visualHeight: 510,
      visualWidth: 390,
      offsetTop: 0,
      scale: 1.25,
      hasEditableFocus: true,
    });

    expect(metrics.keyboardOpen).toBe(false);
    expect(metrics.keyboardInset).toBe(0);
  });

  it('falls back to layout height for unusably small visual viewport values', () => {
    const metrics = resolveViewportMetrics({
      layoutHeight: 760,
      visualHeight: 40,
      visualWidth: 390,
      hasEditableFocus: false,
    });

    expect(metrics.visualHeight).toBe(760);
  });
});
