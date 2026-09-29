import Link from 'next/link';
import { ChevronDown, Settings2 } from 'lucide-react';
import {
  desktopPrimaryNavigation,
  portalMenuNavigation,
} from '@/lib/portal-navigation';
import { buildSectionHref } from '@/lib/portal-logic';
import type { BusinessRecord, PortalSection } from '@/lib/portal-types';
import { portalSectionUserLabel } from '@/lib/portal-navigation-labels';
import { portalSectionVisual } from '@/lib/portal-visual';

type SidebarNavProps = {
  business: BusinessRecord | null;
  currentSection: PortalSection;
};

export function SidebarNav({ business, currentSection }: SidebarNavProps) {
  if (!business) return null;
  const activeBusiness = business;
  const primary = desktopPrimaryNavigation(activeBusiness.permissions);
  const primaryIds = new Set(primary.map(item => item.id));
  const secondary = portalMenuNavigation(activeBusiness.permissions).filter(
    item => !primaryIds.has(item.id) && item.id !== 'security',
  );
  const secondaryActive = secondary.some(item => item.id === currentSection);
  const growth = secondary.filter(item => ['growth', 'buyerPage', 'channels', 'reports', 'parties'].includes(item.id));
  const management = secondary.filter(item => !growth.some(groupItem => groupItem.id === item.id));

  function link(item: { id: PortalSection; label: string }, compact = false) {
    const visual = portalSectionVisual[item.id];
    const Icon = visual.icon;
    const active = currentSection === item.id;
    return (
      <Link
        key={item.id}
        href={buildSectionHref(activeBusiness.id, item.id)}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center gap-2.5 rounded-xl px-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20 ${
          compact ? 'min-h-10' : 'min-h-11'
        } ${
          active
            ? visual.activeNavClass
            : 'text-portal-soft hover:bg-[#f4f6f4] hover:text-portal-ink'
        }`}
      >
        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${visual.iconClass}`}>
          <Icon className="h-[17px] w-[17px]" />
        </span>
        <span>{portalSectionUserLabel(item.id)}</span>
      </Link>
    );
  }

  return (
    <nav className="mt-3 space-y-2" aria-label="Navigasi usaha">
      <div className="space-y-1">{primary.map(item => link(item))}</div>
      {secondary.length ? (
        <details className="group border-t border-portal-line/70 pt-2" open={secondaryActive}>
          <summary
            className={`flex min-h-11 cursor-pointer list-none items-center gap-2.5 rounded-xl px-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20 ${
              secondaryActive
                ? 'bg-[#f1f4f2] text-portal-ink'
                : 'text-portal-soft hover:bg-[#f4f6f4] hover:text-portal-ink'
            }`}
          >
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#f1f4f2] text-portal-soft">
              <Settings2 className="h-[17px] w-[17px]" />
            </span>
            <span className="min-w-0 flex-1">Menu usaha</span>
            <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
          </summary>
          <div className="mt-1 space-y-2 pl-2">
            {growth.length ? (
              <section>
                <p className="px-2 pb-1 text-[10px] font-black uppercase tracking-[.11em] text-portal-soft/70">Tumbuh & pelanggan</p>
                <div className="space-y-0.5">{growth.map(item => link(item, true))}</div>
              </section>
            ) : null}
            {management.length ? (
              <section className={growth.length ? 'border-t border-portal-line/70 pt-2' : ''}>
                <p className="px-2 pb-1 text-[10px] font-black uppercase tracking-[.11em] text-portal-soft/70">Atur usaha</p>
                <div className="space-y-0.5">{management.map(item => link(item, true))}</div>
              </section>
            ) : null}
          </div>
        </details>
      ) : null}
    </nav>
  );
}
