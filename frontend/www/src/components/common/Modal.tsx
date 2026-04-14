'use client';

import { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[110] flex items-end justify-center bg-[color:color-mix(in_srgb,_var(--app-overlay)_62%,_transparent)] p-0 backdrop-blur-md sm:items-center sm:p-4"
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            onClick={event => event.stopPropagation()}
            className={cn(
              'flex max-h-[min(88svh,760px)] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] border border-[color:color-mix(in_srgb,var(--app-border)_92%,white_8%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--app-surface-strong)_98%,white_2%),color-mix(in_srgb,var(--app-surface)_94%,transparent))] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_32px_72px_-40px_rgba(15,23,42,0.3)] ring-1 ring-white/60 dark:border-[color:color-mix(in_srgb,var(--app-border)_88%,transparent)] dark:ring-white/5 sm:max-h-[80svh] sm:rounded-2xl sm:p-5',
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
    </AnimatePresence>
  );
}
