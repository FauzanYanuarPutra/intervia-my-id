export const COMMUNITY_MODAL_SHELL_CLASS =
  'ui-layer-modal fixed inset-0 z-[10000] flex items-end justify-center bg-slate-950/45 p-0  sm:items-center sm:p-4';

export const COMMUNITY_MODAL_SURFACE_CLASS =
  'flex h-full w-full flex-col overflow-hidden shadow-[0_30px_80px_-40px_rgba(15,23,42,0.42)] sm:h-auto sm:max-h-[calc(var(--app-viewport-height)-2rem)] sm:rounded-[24px]';

const COMMUNITY_COMPOSER_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function communityComposerFocusableElements(
  container: HTMLElement,
): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      COMMUNITY_COMPOSER_FOCUSABLE_SELECTOR,
    ),
  ).filter(element => {
    const style = window.getComputedStyle(element);
    return (
      element.getAttribute('aria-hidden') !== 'true' &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      element.getClientRects().length > 0
    );
  });
}
