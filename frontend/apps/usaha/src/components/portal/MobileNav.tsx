import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import {
  mobilePrimaryNavigation,
  portalMenuNavigation,
} from '@/lib/portal-navigation';
import { buildSectionHref } from '@/lib/portal-logic';
import type { BusinessRecord, PortalSection } from '@/lib/portal-types';
import { portalSectionVisual } from '@/lib/portal-visual';

type MobileNavProps = {
  business: BusinessRecord | null;
  currentSection: PortalSection;
};

export function MobileNav({ business, currentSection }: MobileNavProps) {
  if (!business) return null;
  const activeBusiness = business;
  const primary = mobilePrimaryNavigation(activeBusiness.permissions);
  const primaryIds = new Set(primary.map(item => item.id));
  const more = portalMenuNavigation(activeBusiness.permissions).filter(item => !primaryIds.has(item.id));

  function menuLink(item: (typeof more)[number]) {
    const visual = portalSectionVisual[item.id];
    const Icon = visual.icon;
    const active = currentSection === item.id;
    return (
      <Link
        key={item.id}
        href={buildSectionHref(activeBusiness.id, item.id)}
        aria-current={active ? 'page' : undefined}
        className={`flex min-h-12 items-center gap-3 rounded-xl px-2 text-sm font-semibold transition ${
          active ? visual.activeNavClass : 'text-portal-ink hover:bg-[#f5f7f4]'
        }`}
      >
        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${visual.iconClass}`}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        {item.label}
      </Link>
    );
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-portal-line/80 bg-white/97 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_30px_-24px_rgba(15,23,42,.45)] backdrop-blur-xl lg:hidden"
      aria-label="Navigasi usaha mobile"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {primary.map(item => {
          const visual = portalSectionVisual[item.id];
          const Icon = visual.icon;
          const active = currentSection === item.id;
          return (
            <Link
              key={item.id}
              href={buildSectionHref(activeBusiness.id, item.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20 ${
                active ? visual.activeNavClass : 'text-portal-soft hover:bg-[#f5f7f4]'
              }`}
            >
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-[10px] ${visual.iconClass}`}>
                <Icon className="h-[18px] w-[18px]" />
              </span>
              {item.label}
            </Link>
          );
        })}
        <details className="group relative">
          <summary
            className={`flex min-h-[54px] cursor-pointer list-none flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20 ${
              more.some(item => item.id === currentSection)
                ? 'bg-[#f1f4f2] text-portal-ink'
                : 'text-portal-soft hover:bg-[#f5f7f4]'
            }`}
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-[10px] bg-[#f1f4f2] text-portal-soft">
              <Menu className="h-[18px] w-[18px] group-open:hidden" />
              <X className="hidden h-[18px] w-[18px] group-open:block" />
            </span>
            Menu
          </summary>
          <div className="absolute bottom-[calc(100%+.55rem)] right-0 max-h-[68vh] w-[300px] overflow-y-auto rounded-[20px] border border-portal-line bg-white p-2 shadow-[0_24px_70px_-24px_rgba(15,23,42,.5)]">
            <div className="flex items-center justify-between px-2 pb-2 pt-1">
              <div>
                <p className="text-sm font-bold text-portal-ink">Menu usaha</p>
                <p className="text-[11px] text-portal-soft">Stok, laporan, dan pengaturan</p>
              </div>
            </div>
            {more.filter(item => item.id !== 'security').map(menuLink)}
            {more.some(item => item.id === 'security') ? (
              <div className="mt-2 border-t border-portal-line pt-2">
                {more.filter(item => item.id === 'security').map(menuLink)}
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </nav>
  );
}
