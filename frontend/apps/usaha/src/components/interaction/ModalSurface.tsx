'use client';

import {
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
} from 'react';

type ModalSurfaceProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  ariaLabel: string;
  dismissible?: boolean;
  presentation?: 'adaptive' | 'dialog' | 'sheet';
  size?: 'sm' | 'md' | 'lg';
  panelClassName?: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

function isVisibleFocusTarget(element: HTMLElement | null | undefined) {
  if (!element || !element.isConnected) return false;
  return element.getClientRects().length > 0;
}

export function ModalSurface({
  open,
  onOpenChange,
  children,
  ariaLabel,
  dismissible = true,
  presentation = 'adaptive',
  size = 'md',
  panelClassName = '',
  returnFocusRef,
}: ModalSurfaceProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const capturedFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      const explicitTarget = returnFocusRef?.current;
      capturedFocusRef.current =
        isVisibleFocusTarget(explicitTarget)
          ? explicitTarget ?? null
          : document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
      dialog.showModal();
      return;
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, returnFocusRef]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (event: Event) => {
      event.preventDefault();
      if (dismissible) onOpenChange(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !dismissible) event.preventDefault();
    };
    const handleClose = () => {
      const target = capturedFocusRef.current;
      if (isVisibleFocusTarget(target)) target?.focus({ preventScroll: true });
      capturedFocusRef.current = null;
    };

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('keydown', handleKeyDown);
    dialog.addEventListener('close', handleClose);
    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('keydown', handleKeyDown);
      dialog.removeEventListener('close', handleClose);
    };
  }, [dismissible, onOpenChange]);

  function handleBackdropPointer(event: ReactMouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget && dismissible) onOpenChange(false);
  }

  return (
    <dialog
      ref={dialogRef}
      className={`portal-modal portal-modal--${presentation}`}
      aria-label={ariaLabel}
      onMouseDown={handleBackdropPointer}
    >
      <div
        className={`portal-modal-panel portal-modal-panel--${size} ${panelClassName}`.trim()}
        onMouseDown={event => event.stopPropagation()}
      >
        {children}
      </div>
    </dialog>
  );
}
