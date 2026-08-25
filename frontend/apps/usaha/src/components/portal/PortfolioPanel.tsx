import Link from 'next/link';
import { ArrowRight, Building2, Plus } from 'lucide-react';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { buildSectionHref, getRoleSummary, getStatusCopy } from '@/lib/portal-logic';
import type { BusinessRecord, PortalSection } from '@/lib/portal-types';

type PortfolioPanelProps = {
  businesses: BusinessRecord[];
  activeBusinessId: string | null;
  currentSection: PortalSection;
};

export function PortfolioPanel({ businesses, activeBusinessId, currentSection }: PortfolioPanelProps) {
  return (
    <div className="space-y-2">
      {businesses.map(business => {
        const role = getRoleSummary(business.currentRole);
        const status = getStatusCopy(business);
        const href = currentSection === 'home' ? `/?business=${business.id}` : buildSectionHref(business.id, currentSection);
        const active = business.id === activeBusinessId;
        return (
          <Link key={business.id} href={href} className={`group flex items-center gap-3 rounded-[15px] border px-3.5 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/25 ${active ? 'border-portal-forest/25 bg-portal-mist' : 'border-portal-line bg-white hover:border-portal-forest/25 hover:bg-[#fafbf9]'}`}>
            <span className="portal-icon-tile shrink-0"><Building2 className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold text-portal-ink">{business.name}</p>{active ? <StatusBadge tone="success">Aktif</StatusBadge> : null}</div>
              <p className="mt-1 truncate text-xs text-portal-soft">{business.city} · {role.shortLabel} · {status.label}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-portal-soft transition group-hover:translate-x-0.5 group-hover:text-portal-forest" />
          </Link>
        );
      })}
      <Link href="/businesses/new" className="flex min-h-11 items-center justify-center gap-2 rounded-[14px] border border-dashed border-portal-line bg-white px-3 text-sm font-semibold text-portal-forest transition hover:bg-portal-mist"><Plus className="h-4 w-4" /> Tambah usaha</Link>
    </div>
  );
}
