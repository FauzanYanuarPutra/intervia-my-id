"use client";

import * as React from "react";
import { cn } from "../utils/cn";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[color:color-mix(in_srgb,_var(--color-surface)_50%,_transparent)] p-0  sm:items-center sm:p-4">
      <div
        className={cn(
          "relative flex max-h-[min(88svh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-[color:color-mix(in_srgb,_var(--color-border)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--color-surface)_95%,_transparent)] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-2xl dark:border-[color:color-mix(in_srgb,_var(--color-border)_80%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--color-surface)_90%,_transparent)] sm:max-h-[80svh] sm:rounded-2xl sm:p-5",
          className,
        )}
      >
        {title ? (
          <h2 className="text-base font-semibold text-[color:var(--color-text)] dark:text-[color:var(--color-text-inverse)]">
            {title}
          </h2>
        ) : null}
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pb-1">{children}</div>
        {footer ? (
          <div className="mt-6 grid shrink-0 gap-2 border-t border-[color:color-mix(in_srgb,_var(--color-border)_70%,_transparent)] pt-3 sm:flex sm:items-center sm:justify-end [&>*]:w-full sm:[&>*]:w-auto">
            {footer}
          </div>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-2xl border border-[color:color-mix(in_srgb,_var(--color-border)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--color-surface)_90%,_transparent)] px-2.5 py-1 text-xs font-semibold text-[color:var(--color-text)] shadow-sm hover:bg-[color:var(--color-surface-muted)] dark:border-[color:color-mix(in_srgb,_var(--color-border)_80%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--color-surface)_80%,_transparent)] dark:text-[color:var(--color-text-soft)] dark:hover:bg-[color:var(--color-surface)]"
          aria-label="Close"
        >
          Close
        </button>
      </div>
    </div>
  );
}
