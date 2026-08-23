import type { ReactNode } from 'react';
import { PageHeader } from '@/components/portal/PageHeader';

type SectionCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
};

export function SectionCard({ eyebrow, title, description, children, action }: SectionCardProps) {
  return (
    <section className="space-y-5">
      <PageHeader eyebrow={eyebrow} title={title} description={description} action={action} />
      <div>{children}</div>
    </section>
  );
}
