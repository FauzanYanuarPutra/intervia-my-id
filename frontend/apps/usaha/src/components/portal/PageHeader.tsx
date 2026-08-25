import type { ReactNode } from 'react';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  meta?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, action, meta }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 max-w-3xl">
        {eyebrow ? <p className="portal-kicker">{eyebrow}</p> : null}
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.045em] text-portal-ink sm:text-[2rem]">{title}</h1>
        {description ? <p className="mt-2 text-sm leading-6 text-portal-soft sm:text-[15px]">{description}</p> : null}
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </header>
  );
}
