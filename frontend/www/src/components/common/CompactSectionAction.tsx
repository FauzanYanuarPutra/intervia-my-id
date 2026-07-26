'use client';

import { ArrowRight } from 'lucide-react';
import type { ButtonHTMLAttributes, MouseEventHandler } from 'react';

import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { cn } from '@/lib/utils';

const compactActionClass =
  'inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2.5 text-[11px] font-bold text-[color:var(--app-accent)] shadow-sm transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--app-accent)]';

function compactLabel(isId: boolean) {
  return isId ? 'Semua' : 'All';
}

function fullLabel(isId: boolean) {
  return isId ? 'Lihat semua' : 'View all';
}

type CompactSeeAllLinkProps = {
  href: string;
  isId: boolean;
  className?: string;
  label?: string;
  ariaLabel?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export function CompactSeeAllLink({
  href,
  isId,
  className,
  label,
  ariaLabel,
  onClick,
}: CompactSeeAllLinkProps) {
  const accessibleLabel = ariaLabel ?? fullLabel(isId);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(compactActionClass, className)}
      aria-label={accessibleLabel}
      title={accessibleLabel}
    >
      <span>{label ?? compactLabel(isId)}</span>
      <ArrowRight className="h-3 w-3 shrink-0" />
    </Link>
  );
}

type CompactSeeAllButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isId: boolean;
  label?: string;
};

export function CompactSeeAllButton({
  isId,
  label,
  className,
  type = 'button',
  ...props
}: CompactSeeAllButtonProps) {
  const accessibleLabel =
    typeof props['aria-label'] === 'string'
      ? props['aria-label']
      : fullLabel(isId);

  return (
    <button
      type={type}
      className={cn(compactActionClass, className)}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      {...props}
    >
      <span>{label ?? compactLabel(isId)}</span>
      <ArrowRight className="h-3 w-3 shrink-0" />
    </button>
  );
}
