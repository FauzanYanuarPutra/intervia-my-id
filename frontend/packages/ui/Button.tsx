'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const buttonVariants = cva(
  'inline-flex min-h-[48px] touch-manipulation items-center justify-center gap-2 rounded-[14px] text-sm font-semibold transition-all ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,_var(--color-primary)_40%,_transparent)] ' +
    'focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 ' +
    'disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variant: {
        default:
          'bg-[color:var(--color-primary)] text-[color:var(--color-text-inverse)] shadow-sm shadow-[var(--color-shadow)] hover:bg-[color:var(--color-primary-strong)] dark:bg-[color:var(--color-primary)] dark:hover:bg-[color:var(--color-primary)]',
        secondary:
          'border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text)] shadow-sm hover:border-[color:var(--color-border)] hover:bg-[color:var(--color-surface-muted)] dark:border-[color:var(--color-border)] dark:bg-[color:var(--color-surface)] dark:text-[color:var(--color-text-soft)] dark:hover:bg-[color:var(--color-surface)]',
        destructive:
          'bg-[color:var(--color-danger)] text-[color:var(--color-text-inverse)] shadow-sm shadow-[var(--color-shadow)] hover:bg-[color:var(--color-danger)] dark:bg-[color:var(--color-danger)] dark:hover:bg-[color:var(--color-danger)]',
        outline:
          'border border-[color:var(--color-border)] bg-transparent text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-muted)] dark:border-[color:var(--color-border)] dark:text-[color:var(--color-text-soft)] dark:hover:bg-[color:var(--color-surface)]',
        ghost:
          'text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-muted)] dark:text-[color:var(--color-text-soft)] dark:hover:bg-[color:var(--color-surface)]',
        link: 'min-h-0 h-auto rounded-none px-0 text-[color:var(--color-primary)] underline-offset-4 hover:underline dark:text-[color:var(--color-primary)]',
      },
      size: {
        default: 'px-4 py-2.5',
        sm: 'min-h-[44px] rounded-xl px-3.5 text-xs',
        lg: 'min-h-[52px] rounded-[16px] px-6 text-base',
        icon: 'h-12 w-12 rounded-[14px] px-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);

Button.displayName = 'Button';

export { buttonVariants };
