import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

type ActionCardProps = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone?: 'default' | 'warning';
};

export function ActionCard({ href, title, description, icon: Icon, tone = 'default' }: ActionCardProps) {
  return (
    <Link href={href} className={`group flex min-h-[112px] items-start gap-3 rounded-[18px] border p-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/30 ${tone === 'warning' ? 'border-amber-200 bg-amber-50/65 hover:border-amber-300' : 'border-portal-line bg-white hover:border-portal-forest/35 hover:shadow-card'}`}>
      <span className="portal-icon-tile shrink-0"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0">
        <p className="font-bold tracking-[-0.015em] text-portal-ink group-hover:text-portal-forest">{title}</p>
        <p className="mt-1 text-xs leading-5 text-portal-soft sm:text-sm">{description}</p>
      </div>
    </Link>
  );
}
