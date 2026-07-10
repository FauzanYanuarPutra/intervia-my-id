'use client';

import React from 'react';

type Props = React.HTMLAttributes<HTMLDivElement> & {
  title?: string;
  children: React.ReactNode;
};

export function Card({ title, children, className = '', ...rest }: Props) {
  const baseClass =
    'rounded-3xl border border-slate-200 bg-white shadow-[0_16px_36px_-30px_rgba(15,23,42,0.45)]';
  return (
    <div className={`${baseClass} ${className}`.trim()} {...rest}>
      {title ? (
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold tracking-[-0.02em] text-slate-950">
            {title}
          </h2>
        </div>
      ) : null}
      <div className={title ? 'p-5 pt-4' : 'p-5'}>{children}</div>
    </div>
  );
}
