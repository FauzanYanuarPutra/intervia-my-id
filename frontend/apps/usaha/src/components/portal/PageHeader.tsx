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
    <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 max-w-3xl">
        {eyebrow ? <p className="portal-kicker">{eyebrow}</p> : null}
        <h1 className="mt-0.5 text-[22px] font-black tracking-[-0.045em] text-portal-ink sm:text-[26px]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm leading-6 text-portal-soft">{description}</p> : null}
        {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </header>
  );
}
