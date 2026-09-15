'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

type PortalDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  busy?: boolean;
  size?: 'sm' | 'md' | 'lg';
  mobileSheet?: boolean;
  closeLabel?: string;
};

export function PortalDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  busy = false,
  size = 'md',
  mobileSheet = true,
  closeLabel = 'Tutup',
}: PortalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      const previousOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.documentElement.style.overflow = previousOverflow;
      };
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (open) return;
    returnFocusRef.current?.focus({ preventScroll: true });
    returnFocusRef.current = null;
  }, [open]);

  const sizeClass = size === 'sm' ? 'sm:max-w-md' : size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-xl';

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={`portal-dialog ${mobileSheet ? 'portal-dialog-sheet' : ''} ${sizeClass}`}
      onCancel={event => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClose={() => {
        if (open && !busy) onClose();
      }}
      onMouseDown={event => {
        if (busy || event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const outside =
          event.clientX < rect.left || event.clientX > rect.right ||
          event.clientY < rect.top || event.clientY > rect.bottom;
        if (outside) onClose();
      }}
    >
      <div className="portal-dialog-surface">
        {mobileSheet ? <div className="portal-dialog-handle sm:hidden" aria-hidden="true" /> : null}
        <header className="portal-dialog-header">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-black tracking-[-0.02em] text-portal-ink sm:text-lg">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-0.5 text-xs leading-5 text-portal-soft sm:text-sm">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-portal-soft transition hover:bg-[#f2f4f1] hover:text-portal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20 disabled:opacity-50"
            aria-label={closeLabel}
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="portal-dialog-body">{children}</div>
        {footer ? <footer className="portal-dialog-footer">{footer}</footer> : null}
      </div>
    </dialog>
  );
}
