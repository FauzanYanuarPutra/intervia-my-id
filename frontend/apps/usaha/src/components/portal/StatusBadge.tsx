import type { ReactNode } from 'react';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

type StatusBadgeProps = {
  children: ReactNode;
  tone?: Tone;
};

const toneClass: Record<Tone, string> = {
  neutral: 'border-portal-line bg-white text-portal-ink',
  success: 'border-portal-success/20 bg-portal-successTint text-portal-success',
  warning: 'border-portal-warning/20 bg-portal-warningTint text-portal-warning',
  danger: 'border-portal-danger/20 bg-portal-dangerTint text-portal-danger',
  info: 'border-portal-info/20 bg-portal-infoTint text-portal-info',
};

export function StatusBadge({ children, tone = 'neutral' }: StatusBadgeProps) {
  return <span className={`inline-flex min-h-8 items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${toneClass[tone]}`}>{children}</span>;
}
