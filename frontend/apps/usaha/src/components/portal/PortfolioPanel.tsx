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

  function businessCard(business: BusinessRecord) {
    const status = getStatusCopy(business);
    const href = currentSection === 'home' ? `/?business=${business.id}` : buildSectionHref(business.id, currentSection);
    const active = business.id === activeBusinessId;
    return (
      <Link key={business.id} href={href} className={`group flex items-center gap-3 rounded-[15px] border px-3.5 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/25 ${active ? 'border-portal-forest/25 bg-portal-mist' : 'border-portal-line bg-white hover:border-portal-forest/25 hover:bg-[#fafbf9]'}`}>
        <span className="portal-icon-tile shrink-0"><Building2 className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-bold text-portal-ink">{business.name}</p>
            {active ? <StatusBadge tone="success">Aktif</StatusBadge> : null}
            <span className="rounded-full bg-portal-mist px-2 py-0.5 text-[10px] font-bold text-portal-forest">{portalRoleRelationshipLabel(business.currentRole)}</span>
          </div>
          <p className="mt-1 truncate text-xs text-portal-soft">{business.city || 'Lokasi belum diatur'} · {status.label}</p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-portal-soft transition group-hover:translate-x-0.5 group-hover:text-portal-forest" />
      </Link>
    );
  }

  return (
    <div className="space-y-4">
      {groups.owned.length ? (
        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div><p className="text-xs font-bold text-portal-ink">Milik saya</p><p className="text-[11px] text-portal-soft">Usaha yang kepemilikannya ada di akunmu.</p></div>
            <span className="text-xs font-bold text-portal-soft">{groups.owned.length}</span>
          </div>
          <div className="space-y-2">{groups.owned.map(businessCard)}</div>
        </section>
      ) : null}

      {groups.joined.length ? (
        <section className={groups.owned.length ? 'border-t border-portal-line pt-4' : ''}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div><p className="text-xs font-bold text-portal-ink">Saya ikuti</p><p className="text-[11px] text-portal-soft">Usaha orang lain yang sudah memberimu akses.</p></div>
            <span className="text-xs font-bold text-portal-soft">{groups.joined.length}</span>
          </div>
          <div className="space-y-2">{groups.joined.map(businessCard)}</div>
        </section>
      ) : null}

      {!businesses.length ? (
        <div className="rounded-2xl border border-dashed border-portal-line bg-white p-5 text-center">
          <p className="text-sm font-bold text-portal-ink">Belum ada usaha yang bisa diakses</p>
          <p className="mt-1 text-xs leading-5 text-portal-soft">Buat usaha sendiri atau terima undangan dari pemilik usaha lain.</p>
        </div>
      ) : null}

      <Link href="/businesses/new" className="flex min-h-11 items-center justify-center gap-2 rounded-[14px] border border-dashed border-portal-line bg-white px-3 text-sm font-semibold text-portal-forest transition hover:bg-portal-mist"><Plus className="h-4 w-4" /> Buat usaha baru</Link>
    </div>
  );
}
