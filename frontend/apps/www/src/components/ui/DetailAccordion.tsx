import { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type DetailAccordionProps = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
};

export function DetailAccordion({
  title,
  description,
  defaultOpen = false,
  className,
  children,
}: DetailAccordionProps) {
  return (
    <details
      className={cn(
        'group rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4 transition',
        className,
      )}
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[color:var(--app-text)]">{title}</p>
          {description ? (
            <p className="mt-1 text-[12px] text-[color:var(--app-text-soft)]">{description}</p>
          ) : null}
        </div>
        <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--app-border)] text-[color:var(--app-text-soft)] transition group-open:rotate-180">
          <ChevronDown className="h-4 w-4" />
        </span>
      </summary>
      <div className="mt-3 text-sm text-[color:var(--app-text-soft)]">{children}</div>
    </details>
  );
}
