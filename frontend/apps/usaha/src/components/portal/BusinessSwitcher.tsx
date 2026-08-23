import Link from 'next/link';
import { Building2, ChevronDown, Check } from 'lucide-react';
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
      <Link href="/businesses/new" className="flex min-h-12 items-center gap-3 rounded-[16px] border border-dashed border-white/20 bg-white/5 px-3 text-sm font-semibold text-white/90 transition hover:bg-white/10">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/10"><Building2 className="h-4 w-4" /></span>
        Buat usaha pertama
      </Link>
    );
  }

  return (
    <details className="group relative">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-[16px] border border-white/10 bg-white/8 px-3 text-left transition hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-white/10 text-white"><Building2 className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-semibold text-white/55">Usaha aktif</span>
          <span className="mt-0.5 block truncate text-sm font-bold text-white">{activeBusiness.name}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-white/55 transition group-open:rotate-180" />
      </summary>
      <div className="absolute left-0 right-0 z-40 mt-2 overflow-hidden rounded-[16px] border border-portal-line bg-white p-2 shadow-[0_20px_60px_-28px_rgba(15,23,42,.45)]">
        <p className="px-2 pb-2 pt-1 text-[11px] font-bold text-portal-soft">Pilih usaha</p>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {businesses.map(business => (
            <Link key={business.id} href={buildSectionHref(business.id, currentSection)} className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm transition hover:bg-portal-mist">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-portal-mist text-portal-forest"><Building2 className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-portal-ink">{business.name}</span>
                <span className="block truncate text-[11px] text-portal-soft">{business.city} · {business.category}</span>
              </span>
              {business.id === activeBusiness.id ? <Check className="h-4 w-4 text-portal-forest" /> : null}
            </Link>
          ))}
        </div>
        <div className="mt-2 border-t border-portal-line pt-2">
          <Link href="/businesses/new" className="flex min-h-10 items-center gap-2 rounded-xl px-2.5 text-sm font-semibold text-portal-forest transition hover:bg-portal-mist"><Building2 className="h-4 w-4" /> Tambah usaha</Link>
        </div>
      </div>
    </details>
  );
}
