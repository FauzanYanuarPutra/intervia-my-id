'use client';

import React, { useId } from 'react';

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export function Input({ label, error, className = '', id, ...props }: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className="block">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-[color:var(--color-text)] dark:text-[color:var(--color-text-soft)] mb-1">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full rounded-xl border border-[color:color-mix(in_srgb,_var(--color-border)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--color-surface)_90%,_transparent)] px-3 py-2.5 text-sm outline-none transition shadow-sm shadow-[var(--color-shadow)] text-[color:var(--color-text)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,_var(--color-primary)_60%,_transparent)] focus:border-[color:var(--color-primary-border)] dark:bg-[color:color-mix(in_srgb,_var(--color-surface)_80%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--color-border)_80%,_transparent)] dark:text-[color:var(--color-text-soft)] dark:focus:ring-[color:color-mix(in_srgb,_var(--color-primary)_30%,_transparent)] ${error ? 'border-[color:var(--color-danger-border)]' : ''} ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-[color:var(--color-danger)]">{error}</p>}
    </div>
  );
}