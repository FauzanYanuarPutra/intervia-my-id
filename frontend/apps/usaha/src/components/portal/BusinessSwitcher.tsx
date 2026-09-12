import Link from 'next/link';
import { Building2, Check, ChevronDown, Plus } from 'lucide-react';
import {
  groupBusinessesByRelationship,
  portalRoleRelationshipLabel,
} from '@/lib/business-collaboration';
import { buildSectionHref } from '@/lib/portal-logic';
import type { BusinessRecord, PortalSection } from '@/lib/portal-types';

type BusinessSwitcherProps = {
  activeBusiness: BusinessRecord | null;
  businesses: BusinessRecord[];
  currentSection: PortalSection;
};

export function BusinessSwitcher({ activeBusiness, businesses, currentSection }: BusinessSwitcherProps) {
  if (!activeBusiness) {
    return (
      <Link href="/businesses/new" className="flex min-h-11 items-center gap-3 rounded-xl border border-dashed border-portal-line bg-[#fafbfa] px-3 text-sm font-semibold text-portal-ink transition hover:bg-portal-mist">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-portal-mist text-portal-forest"><Building2 className="h-4 w-4" /></span>
        {businesses.length ? 'Buat usaha baru' : 'Buat usaha pertama'}
      </Link>
    );
  }

  const groups = groupBusinessesByRelationship(businesses);
  const activeBusinessId = activeBusiness.id;

  function businessLink(business: BusinessRecord) {
    return (
      <Link key={business.id} href={buildSectionHref(business.id, currentSection)} className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm transition hover:bg-portal-mist">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-portal-mist text-portal-forest"><Building2 className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-semibold text-portal-ink">{business.name}</span>
            <span className="shrink-0 rounded-full bg-portal-mist px-2 py-0.5 text-[10px] font-bold text-portal-forest">{portalRoleRelationshipLabel(business.currentRole)}</span>
          </span>
          <span className="block truncate text-[11px] text-portal-soft">{business.city || 'Lokasi belum diatur'} · {business.category}</span>
        </span>
        {business.id === activeBusinessId ? <Check className="h-4 w-4 shrink-0 text-portal-forest" /> : null}
      </Link>
    );
  }

  return (
    <details className="group relative">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl border border-portal-line bg-[#fafbfa] px-3 text-left transition hover:bg-portal-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-portal-mist text-portal-forest"><Building2 className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[10px] font-semibold text-portal-soft">Usaha aktif · {portalRoleRelationshipLabel(activeBusiness.currentRole)}</span>
          <span className="block truncate text-sm font-bold text-portal-ink">{activeBusiness.name}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-portal-soft transition group-open:rotate-180" />
      </summary>
      <div className="absolute left-0 right-0 z-40 mt-2 overflow-hidden rounded-[16px] border border-portal-line bg-white p-2 shadow-[0_20px_60px_-28px_rgba(15,23,42,.45)]">
        <p className="px-2 pb-2 pt-1 text-[11px] font-bold text-portal-soft">Pilih usaha</p>
        <div className="max-h-80 overflow-y-auto">
          {groups.owned.length ? (
            <section>
              <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[.12em] text-portal-soft/70">Milik saya</p>
              <div className="space-y-1">{groups.owned.map(businessLink)}</div>
            </section>
          ) : null}
          {groups.joined.length ? (
            <section className={groups.owned.length ? 'mt-2 border-t border-portal-line pt-2' : ''}>
              <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[.12em] text-portal-soft/70">Saya ikuti</p>
              <div className="space-y-1">{groups.joined.map(businessLink)}</div>
            </section>
          ) : null}
        </div>
        <div className="mt-2 border-t border-portal-line pt-2">
          <Link href="/businesses/new" className="flex min-h-10 items-center gap-2 rounded-xl px-2.5 text-sm font-semibold text-portal-forest transition hover:bg-portal-mist"><Plus className="h-4 w-4" /> Buat usaha baru</Link>
        </div>
      </div>
    </details>
  );
}
