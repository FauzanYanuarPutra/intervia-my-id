import type { HTMLAttributes } from 'react';

type MoneyValueProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  value: number | null | undefined;
  prefix?: string;
  signed?: boolean;
  compact?: boolean;
};

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export function formatBusinessMoney(value: number | null | undefined, prefix = 'Rp') {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const absolute = money.format(Math.abs(value)).replace('IDR', prefix);
  if (value < 0) return `-${absolute}`;
  return absolute;
}

export function MoneyValue({
  value,
  prefix = 'Rp',
  signed = false,
  compact = false,
  className = '',
  ...props
}: MoneyValueProps) {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const tone =
    value === null || value === undefined || !Number.isFinite(numeric)
      ? 'portal-money-neutral'
      : numeric < 0
        ? 'portal-money-negative'
        : 'portal-money-positive';
  const sign = signed && numeric > 0 ? '+' : '';

  return (
    <span
      {...props}
      className={`portal-money ${tone} ${compact ? 'text-sm' : ''} ${className}`.trim()}
    >
      {value === null || value === undefined || !Number.isFinite(numeric)
        ? '—'
        : `${sign}${formatBusinessMoney(numeric, prefix)}`}
    </span>
  );
}
