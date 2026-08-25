import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: ReactNode;
};

export function EmptyState({ title, description, icon: Icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start px-5 py-8 sm:px-6 sm:py-10">
      {Icon ? <span className="portal-icon-tile h-11 w-11"><Icon className="h-5 w-5" /></span> : null}
      <h3 className="mt-4 text-lg font-bold tracking-[-0.03em] text-portal-ink">{title}</h3>
      <p className="mt-2 max-w-xl text-sm leading-6 text-portal-soft">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
