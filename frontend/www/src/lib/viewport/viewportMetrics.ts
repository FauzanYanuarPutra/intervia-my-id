export type EditableElementSnapshot = {
  tagName?: string | null;
  isContentEditable?: boolean;
  role?: string | null;
};

export type ViewportMetricInput = {
  layoutHeight: number;
  visualHeight?: number | null;
  visualWidth?: number | null;
  offsetTop?: number | null;
  offsetLeft?: number | null;
  scale?: number | null;
  hasEditableFocus: boolean;
};

export type ViewportMetrics = {
  visualHeight: number;
  visualWidth: number;
  layoutHeight: number;
  offsetTop: number;
  offsetLeft: number;
  keyboardInset: number;
  keyboardOpen: boolean;
  scale: number;
};

const MIN_VIEWPORT_HEIGHT = 120;
const MIN_KEYBOARD_INSET = 80;
const KEYBOARD_LAYOUT_RATIO = 0.12;
const PINCH_SCALE_TOLERANCE = 0.06;

export function isEditableElementSnapshot(
  element: EditableElementSnapshot | null | undefined,
): boolean {
  if (!element) return false;
  if (element.isContentEditable) return true;

  const tagName = (element.tagName || '').toUpperCase();
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }

  return (element.role || '').toLowerCase() === 'textbox';
}

export function resolveViewportMetrics(
  input: ViewportMetricInput,
): ViewportMetrics {
  const layoutHeight = Math.round(Math.max(1, input.layoutHeight || 0));
  const rawVisualHeight =
    typeof input.visualHeight === 'number' && Number.isFinite(input.visualHeight)
      ? input.visualHeight
      : layoutHeight;
  const visualHeight = Math.round(
    Math.max(1, rawVisualHeight > MIN_VIEWPORT_HEIGHT ? rawVisualHeight : layoutHeight),
  );
  const visualWidth = Math.round(
    Math.max(
      1,
      typeof input.visualWidth === 'number' && Number.isFinite(input.visualWidth)
        ? input.visualWidth
        : 0,
    ),
  );
  const offsetTop = Math.round(
    Math.max(
      0,
      typeof input.offsetTop === 'number' && Number.isFinite(input.offsetTop)
        ? input.offsetTop
        : 0,
    ),
  );
  const offsetLeft = Math.round(
    Math.max(
      0,
      typeof input.offsetLeft === 'number' && Number.isFinite(input.offsetLeft)
        ? input.offsetLeft
        : 0,
    ),
  );
  const scale =
    typeof input.scale === 'number' && Number.isFinite(input.scale)
      ? input.scale
      : 1;
  const rawKeyboardInset = Math.max(0, layoutHeight - visualHeight - offsetTop);
  const keyboardThreshold = Math.max(
    MIN_KEYBOARD_INSET,
    Math.round(layoutHeight * KEYBOARD_LAYOUT_RATIO),
  );
  const keyboardOpen =
    input.hasEditableFocus &&
    Math.abs(scale - 1) <= PINCH_SCALE_TOLERANCE &&
    rawKeyboardInset >= keyboardThreshold;
  const keyboardInset = keyboardOpen ? Math.round(rawKeyboardInset) : 0;

  return {
    visualHeight,
    visualWidth,
    layoutHeight,
    offsetTop,
    offsetLeft,
    keyboardInset,
    keyboardOpen,
    scale,
  };
}
