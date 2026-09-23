import type { SelectHTMLAttributes } from 'react';

export type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement>;

export function SelectField({
  className = '',
  children,
  ...props
}: SelectFieldProps) {
  return (
    <select
      {...props}
      className={[
        'min-h-11 touch-manipulation outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </select>
  );
}
