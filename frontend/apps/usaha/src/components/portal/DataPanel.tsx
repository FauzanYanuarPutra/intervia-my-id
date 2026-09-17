import type { ReactNode } from 'react';

type DataPanelProps = {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function DataPanel({ title, description, action, children, className = '' }: DataPanelProps) {
  return (
    <section className={`merchant-surface-bordered overflow-hidden ${className}`}>
      {title || description || action ? (
        <div className="flex flex-col gap-2.5 border-b border-portal-line/70 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div>
            {title ? <h2 className="text-[15px] font-black tracking-[-0.02em] text-portal-ink">{title}</h2> : null}
            {description ? <p className="mt-1 max-w-2xl text-xs leading-5 text-portal-soft">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div>{children}</div>
    </section>
  );
}
