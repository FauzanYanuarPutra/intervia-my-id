'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  className,
}: ModalProps) {
  useBodyScrollLock(open);
  const dialogRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusableSelector = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const focusFirstControl = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      const first = dialog?.querySelector<HTMLElement>(focusableSelector);
      (first || dialog)?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const openDialogs = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[role="dialog"][aria-modal="true"]',
        ),
      );
      if (openDialogs[openDialogs.length - 1] !== dialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const controls = Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter(element => !element.hasAttribute('disabled'));
      if (controls.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFirstControl);
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="ui-layer-modal fixed inset-0 z-[10000] flex h-[var(--app-visual-viewport-height)] w-screen items-end justify-center overflow-hidden bg-[color:color-mix(in_srgb,_var(--app-overlay)_62%,_transparent)] p-0  sm:items-center sm:p-4"
        >
          <motion.section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            onClick={event => event.stopPropagation()}
            className={cn(
              'flex max-h-[min(calc(var(--app-visual-viewport-height)-1rem),760px)] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] border border-[color:color-mix(in_srgb,var(--app-border)_92%,white_8%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-strong)_98%,white_2%),color-mix(in_srgb,var(--app-surface)_94%,transparent))] px-4 pb-[calc(1rem+var(--app-modal-safe-bottom,env(safe-area-inset-bottom)))] pt-4 shadow-[0_32px_72px_-40px_rgba(15,23,42,0.3)] ring-1 ring-white/60 dark:border-[color:color-mix(in_srgb,var(--app-border)_88%,transparent)] dark:ring-white/5 sm:max-h-[min(calc(var(--app-visual-viewport-height)-2rem),760px)] sm:rounded-2xl sm:p-5',
              className,
            )}
          >
            <header className="flex shrink-0 items-start justify-between gap-3">
              <h2 className="min-w-0 break-words text-base font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="inline-flex h-11 w-11 touch-manipulation items-center justify-center rounded-2xl border border-[color:color-mix(in_srgb,var(--app-border)_88%,transparent)] bg-[color:color-mix(in_srgb,var(--app-surface-muted)_92%,transparent)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface-strong)]"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1 pb-1 text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
              {children}
            </div>
            {footer ? (
              <footer className="mt-4 shrink-0 border-t border-[color:color-mix(in_srgb,var(--app-border)_80%,transparent)] pt-3">
                <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end [&>*]:w-full sm:[&>*]:w-auto">
                  {footer}
                </div>
              </footer>
            ) : null}
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
