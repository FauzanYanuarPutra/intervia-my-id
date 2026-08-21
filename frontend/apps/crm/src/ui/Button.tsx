'use client';

import React from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: React.ReactNode;
};

const variantClass: Record<Variant, string> = {
  primary:
    'bg-[#6cd698] text-white shadow-[0_16px_30px_-22px_rgba(22,163,74,0.9)] hover:brightness-105',
  secondary:
    'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
  danger:
    'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
  ghost: 'text-slate-600 hover:bg-slate-100',
};

export function Button({
  variant = 'primary',
  children,
  className = '',
  ...props
}: Props) {
  return (
    <button
      className={[
        'inline-flex min-h-11 items-center justify-center rounded-2xl px-4 text-sm font-bold transition disabled:pointer-events-none disabled:opacity-55',
        variantClass[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </button>
  );
}
