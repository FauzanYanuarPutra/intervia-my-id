import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { BusinessRecord, PortalSection } from '@/lib/portal-types';
import { buildSectionHref, getRoleSummary, getStatusCopy } from '@/lib/portal-logic';

type PortfolioPanelProps = {
  businesses: BusinessRecord[];
  activeBusinessId: string | null;
  currentSection: PortalSection;
};

export function PortfolioPanel({
  businesses,
  activeBusinessId,
  currentSection,
}: PortfolioPanelProps) {
  return (
    <div className="grid gap-3">
      {businesses.map(business => {
        const role = getRoleSummary(business.currentRole);
        const status = getStatusCopy(business);
        const href =
          currentSection === 'home'
            ? `/?business=${business.id}`
            : buildSectionHref(business.id, currentSection);

        return (
          <article
            key={business.id}
            className={`rounded-[24px] border p-4 ${
              business.id === activeBusinessId
                ? 'border-portal-forest/35 bg-[linear-gradient(180deg,rgba(29,106,67,0.08),rgba(255,253,248,1))]'
                : 'border-portal-line/70 bg-white'
            }`}
          >
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px] md:items-start">
              <div>
                <h3 className="text-lg font-black tracking-[-0.04em] text-portal-ink">
                  {business.name}
                </h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-[18px] border border-portal-line/70 bg-white/80 px-3 py-3">
                    <p className="portal-label">Kota</p>
                    <p className="mt-1 text-sm font-semibold text-portal-ink">{business.city}</p>
                  </div>
                  <div className="rounded-[18px] border border-portal-line/70 bg-white/80 px-3 py-3">
                    <p className="portal-label">Peran</p>
                    <p className="mt-1 text-sm font-semibold text-portal-ink">{role.label}</p>
                  </div>
                  <div className="rounded-[18px] border border-portal-line/70 bg-white/80 px-3 py-3">
                    <p className="portal-label">Kondisi</p>
                    <p className="mt-1 text-sm font-semibold text-portal-ink">{status.label}</p>
                  </div>
                </div>
              </div>
              <Link href={href} className="portal-button-secondary min-h-11 px-4">
                Buka usaha ini
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>
        );
      })}

      <Link href="/businesses/new" className="inline-flex min-h-12 items-center justify-center rounded-[24px] border border-dashed border-portal-line bg-white/75 px-4 text-sm font-semibold text-portal-forest">
        Buat usaha baru
      </Link>
    </div>
  );
}
