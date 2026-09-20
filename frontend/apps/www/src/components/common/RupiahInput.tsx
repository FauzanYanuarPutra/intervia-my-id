'use client';

import type { InputHTMLAttributes } from 'react';

type RupiahInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
> & {
  value: string | number | null | undefined;
  onValueChange: (value: number | null) => void;
  prefix?: string;
};

const formatter = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 0,
});

export function formatRupiahInput(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  const amount = Number.parseInt(digits, 10);
  return Number.isSafeInteger(amount) ? formatter.format(amount) : '';
}

export function parseRupiahInput(value: string): number | null {
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  const amount = Number.parseInt(digits, 10);
  return Number.isSafeInteger(amount) ? amount : null;
}

export function RupiahInput({
  value,
  onValueChange,
  prefix = 'Rp',
  className = '',
  inputMode = 'numeric',
  placeholder = '0',
  autoComplete = 'off',
  ...props
}: RupiahInputProps) {
  return (
    <div className="relative flex min-w-0 items-center overflow-hidden">
      <span className="pointer-events-none absolute left-3.5 z-10 text-sm font-bold text-slate-500">
        {prefix}
      </span>
      <input
        {...props}
        type="text"
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={formatRupiahInput(value)}
        onChange={event => onValueChange(parseRupiahInput(event.target.value))}
        placeholder={placeholder}
        className={`w-full pl-10 ${className}`.trim()}
      />
    </div>
  );
}
