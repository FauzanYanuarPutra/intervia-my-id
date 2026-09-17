import Link from 'next/link';
import { ArrowRight, Building2, Plus } from 'lucide-react';
import { StatusBadge } from '@/components/portal/StatusBadge';
import {
  groupBusinessesByRelationship,
  portalRoleRelationshipLabel,
} from '@/lib/business-collaboration';
import { buildSectionHref, getStatusCopy } from '@/lib/portal-logic';
import type { BusinessRecord, PortalSection } from '@/lib/portal-types';

type PortfolioPanelProps = {
  businesses: BusinessRecord[];
  activeBusinessId: string | null;
  currentSection: PortalSection;
};

export function PortfolioPanel({ businesses, activeBusinessId, currentSection }: PortfolioPanelProps) {
  const groups = groupBusinessesByRelationship(businesses);

  function businessRow(business: BusinessRecord) {
    const status = getStatusCopy(business);
    const href = currentSection === 'home' ? `/?business=${business.id}` : buildSectionHref(business.id, currentSection);
    const active = business.id === activeBusinessId;
    return (
      <Link
        key={business.id}
        href={href}
        className={`merchant-action-row group transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-portal-forest/25 ${active ? 'bg-portal-mist/70' : 'hover:bg-[#fafbf9]'}`}
      >
        <span className="portal-icon-tile shrink-0"><Building2 className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-black text-portal-ink">{business.name}</p>
            {active ? <StatusBadge tone="success">Aktif</StatusBadge> : null}
            <span className="rounded-full bg-[#f4f6f4] px-2 py-0.5 text-[10px] font-bold text-portal-soft">{portalRoleRelationshipLabel(business.currentRole)}</span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-portal-soft">{business.city || 'Lokasi belum diatur'} · {status.label}</p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-portal-soft transition group-hover:translate-x-0.5 group-hover:text-portal-forest" />
      </Link>
    );
  }

  return (
    <div className="space-y-4">
      {groups.owned.length ? (
        <section>
          <div className="mb-2 flex items-center justify-between px-1"><p className="text-xs font-black text-portal-ink">Milik saya</p><span className="text-[11px] font-bold text-portal-soft">{groups.owned.length}</span></div>
          <div className="merchant-list border border-portal-line/80">{groups.owned.map(businessRow)}</div>
        </section>
      ) : null}

      {groups.joined.length ? (
        <section>
          <div className="mb-2 flex items-center justify-between px-1"><p className="text-xs font-black text-portal-ink">Saya ikuti</p><span className="text-[11px] font-bold text-portal-soft">{groups.joined.length}</span></div>
          <div className="merchant-list border border-portal-line/80">{groups.joined.map(businessRow)}</div>
        </section>
      ) : null}

      {!businesses.length ? (
        <div className="rounded-[18px] border border-dashed border-portal-line bg-white px-4 py-6 text-center">
          <p className="text-sm font-black text-portal-ink">Belum ada usaha</p>
          <p className="mt-1 text-xs leading-5 text-portal-soft">Buat usaha sendiri atau terima undangan dari pemilik usaha lain.</p>
        </div>
      ) : null}

      <Link href="/businesses/new" className="portal-button-secondary w-full border-dashed"><Plus className="h-4 w-4" /> Tambah usaha</Link>
    </div>
  );
}
