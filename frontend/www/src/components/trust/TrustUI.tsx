import { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import {
  pickText,
  type LegalSection,
  type LocalizedText,
} from '@/data/trustCenter';
import { DetailAccordion } from '@/components/ui/DetailAccordion';

export function TrustBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--app-accent)]">
      {label}
    </span>
  );
}

export function InfoChips({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
      {items.map(item => (
        <span
          key={item}
          className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-1"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export function SummaryCard({
  title,
  description,
  meta,
  children,
}: {
  title: string;
  description: string;
  meta?: string;
  children?: ReactNode;
}) {
  return (
    <section className="ui-panel rounded-[24px] p-5">
      {meta ? (
        <p className="inline-flex rounded-full bg-[color:var(--app-accent-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
          {meta}
        </p>
      ) : null}
      <h2 className="mt-2 text-xl font-bold tracking-tight text-[color:var(--app-text)]">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
        {description}
      </p>
      {children ? (
        <div className="mt-4 flex flex-wrap gap-2">{children}</div>
      ) : null}
    </section>
  );
}

export function LegalSummaryCard({
  title,
  summary,
  bullets,
  href,
  cta,
}: {
  title: string;
  summary: string;
  bullets: string[];
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="ui-panel-muted ui-card-hover block rounded-[22px] p-4"
    >
      <h3 className="text-base font-bold text-[color:var(--app-text)]">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
        {summary}
      </p>
      {bullets.length > 0 ? (
        <ul className="mt-3 space-y-1 text-[12px] text-[color:var(--app-text-soft)]">
          {bullets.slice(0, 2).map(item => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--app-accent)]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <span className="mt-4 inline-flex rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--app-accent)]">
        {cta}
      </span>
    </Link>
  );
}

export function LegalSectionView({
  section,
  locale,
  defaultOpen = false,
}: {
  section: LegalSection;
  locale: 'id' | 'en';
  defaultOpen?: boolean;
}) {
  const title = pickText(locale, section.title);
  const body = pickText(locale, section.body);
  const bullets = section.bullets?.map(item => pickText(locale, item)) ?? [];

  return (
    <DetailAccordion title={title} defaultOpen={defaultOpen}>
      <p className="text-sm leading-6">{body}</p>
      {bullets.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm">
          {bullets.map(bullet => (
            <li key={bullet} className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--app-accent)]" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </DetailAccordion>
  );
}

export function AnchorLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-1 text-[11px] font-semibold text-[color:var(--app-text-soft)] hover:text-[color:var(--app-text)]"
    >
      {label}
    </Link>
  );
}

export function LocalizedTextValue({
  locale,
  text,
}: {
  locale: 'id' | 'en';
  text: LocalizedText;
}) {
  return <>{pickText(locale, text)}</>;
}
