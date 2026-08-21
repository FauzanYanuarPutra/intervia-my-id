import * as React from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'default' | 'outline' | 'ghost' | 'secondary' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const base =
  'inline-flex touch-manipulation items-center justify-center gap-2 rounded-xl text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,_var(--app-accent)_28%,_transparent)] disabled:pointer-events-none disabled:opacity-50';

const variantStyles: Record<ButtonVariant, string> = {
  default: 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)]',
  outline:
    'border border-[color:var(--app-border)] text-[color:var(--app-text)] hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)]',
  ghost:
    'text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] hover:text-[color:var(--app-text)]',
  secondary:
    'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-strong)]',
  link: 'text-[color:var(--app-accent)] underline-offset-4 hover:underline',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'min-h-[44px] px-3.5 text-xs',
  md: 'min-h-[48px] px-4',
  lg: 'min-h-[52px] px-5 text-base',
};

export function buttonVariants({
  variant = 'default',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return cn(base, variantStyles[variant], sizeStyles[size], className);
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => (
    <button ref={ref} className={buttonVariants({ variant, size, className })} {...props} />
  ),
);

Button.displayName = 'Button';
