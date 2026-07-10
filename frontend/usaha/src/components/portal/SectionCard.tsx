import type { ReactNode } from 'react';

type SectionCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function SectionCard({
  eyebrow,
  title,
  description,
  children,
}: SectionCardProps) {
  return (
    <section className="portal-panel p-5 sm:p-6">
      <p className="portal-kicker">{eyebrow}</p>
      <div className="mt-2 max-w-3xl">
        <h1 className="text-[1.8rem] font-bold tracking-[-0.06em] text-portal-ink sm:text-[2.25rem]">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-7 text-portal-soft">{description}</p>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
