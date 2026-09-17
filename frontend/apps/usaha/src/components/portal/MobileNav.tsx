'use client';

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { ModalSurface } from '@/components/interaction/ModalSurface';
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
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  if (!business) return null;
  const activeBusiness = business;
  const primary = mobilePrimaryNavigation(activeBusiness.permissions);
  const primaryIds = new Set(primary.map(item => item.id));
  const more = portalMenuNavigation(activeBusiness.permissions).filter(item => !primaryIds.has(item.id));
  const management = more.filter(item => ['inventory', 'reports', 'channels', 'buyerPage'].includes(item.id));
  const settings = more.filter(item => !management.some(groupItem => groupItem.id === item.id));

  function menuLink(item: (typeof more)[number]) {
    const visual = portalSectionVisual[item.id];
    const Icon = visual.icon;
    const active = currentSection === item.id;
    return (
      <Link
        key={item.id}
        href={buildSectionHref(activeBusiness.id, item.id)}
        aria-current={active ? 'page' : undefined}
        onClick={() => setMoreOpen(false)}
        className={`flex min-h-12 items-center gap-3 rounded-xl px-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20 ${
          active ? visual.activeNavClass : 'text-portal-ink hover:bg-[#f5f7f4]'
        }`}
      >
        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${visual.iconClass}`}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      </Link>
    );
  }

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-[var(--portal-layer-nav)] border-t border-portal-line/80 bg-white/97 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_30px_-24px_rgba(15,23,42,.45)] backdrop-blur-xl lg:hidden"
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
          <button
            ref={moreButtonRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(true)}
            className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20 ${
              more.some(item => item.id === currentSection)
                ? 'bg-[#f1f4f2] text-portal-ink'
                : 'text-portal-soft hover:bg-[#f5f7f4]'
            }`}
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-[10px] bg-[#f1f4f2] text-portal-soft">
              <Menu className="h-[18px] w-[18px]" />
            </span>
            Lainnya
          </button>
        </div>
      </nav>

      <ModalSurface
        open={moreOpen}
        onOpenChange={setMoreOpen}
        ariaLabel="Menu lainnya"
        presentation="sheet"
        size="sm"
        returnFocusRef={moreButtonRef}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-200" />
        <div className="flex items-start justify-between gap-4 border-b border-portal-line px-4 pb-3 pt-3">
          <div>
            <p className="text-base font-black text-portal-ink">Lainnya</p>
            <p className="mt-0.5 text-xs text-portal-soft">Stok, laporan, toko, dan pengaturan usaha.</p>
          </div>
          <button
            type="button"
            aria-label="Tutup menu lainnya"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-portal-soft transition hover:bg-[#f3f5f2] hover:text-portal-ink"
            onClick={() => setMoreOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
          {management.length ? (
            <section>
              <p className="px-2 pb-1.5 text-[10px] font-black uppercase tracking-[.12em] text-portal-soft/75">Kelola</p>
              <div className="space-y-1">{management.map(menuLink)}</div>
            </section>
          ) : null}
          {settings.length ? (
            <section className={management.length ? 'mt-3 border-t border-portal-line pt-3' : ''}>
              <p className="px-2 pb-1.5 text-[10px] font-black uppercase tracking-[.12em] text-portal-soft/75">Pengaturan</p>
              <div className="space-y-1">{settings.map(menuLink)}</div>
            </section>
          ) : null}
        </div>
      </ModalSurface>
    </>
  );
}
