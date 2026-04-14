'use client';

import * as React from 'react';
import { cn } from '../utils/cn';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'min-h-[48px] w-full touch-manipulation rounded-[14px] border border-[color:color-mix(in_srgb,_var(--color-border)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--color-surface)_90%,_transparent)] px-3.5 py-3 text-sm text-[color:var(--color-text)] shadow-sm shadow-[var(--color-shadow)] outline-none transition placeholder:text-[color:var(--color-text-soft)] focus:border-[color:var(--color-primary-border)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,_var(--color-primary)_60%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--color-border)_80%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--color-surface)_80%,_transparent)] dark:text-[color:var(--color-text-soft)] dark:placeholder:text-[color:var(--color-text)] dark:focus:border-[color:var(--color-primary-border)] dark:focus:ring-[color:color-mix(in_srgb,_var(--color-primary)_30%,_transparent)]',
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';
