'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import {
  mobilePrimaryNavigation,
  portalMenuNavigation,
} from '@/lib/portal-navigation';
import { buildSectionHref } from '@/lib/portal-logic';
import type { BusinessRecord, PortalSection } from '@/lib/portal-types';
import { portalSectionVisual } from '@/lib/portal-visual';
import { PortalDialog } from '@/components/portal/PortalDialog';

type MobileNavProps = {
  business: BusinessRecord | null;
  currentSection: PortalSection;
};

export function MobileNav({ business, currentSection }: MobileNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  if (!business) return null;
  const activeBusiness = business;
  const primary = mobilePrimaryNavigation(activeBusiness.permissions);
  const primaryIds = new Set(primary.map(item => item.id));
  const more = portalMenuNavigation(activeBusiness.permissions).filter(item => !primaryIds.has(item.id));
  const moreActive = more.some(item => item.id === currentSection);

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
        className={`flex min-h-12 items-center gap-3 rounded-xl px-2.5 text-sm font-semibold transition ${
          active ? visual.activeNavClass : 'text-portal-ink hover:bg-[#f5f7f4]'
        }`}
      >
        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${visual.iconClass}`}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">{item.label}</span>
      </Link>
    );
  }

  const businessLinks = more.filter(item => ['inventory', 'reports', 'channels', 'buyerPage'].includes(item.id));
  const settingsLinks = more.filter(item => !businessLinks.includes(item));

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-portal-line/80 bg-white/97 px-2 pt-1.5 shadow-[0_-8px_30px_-24px_rgba(15,23,42,.45)] backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: 'max(.5rem, env(safe-area-inset-bottom))' }}
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
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20 ${
              moreActive || moreOpen ? 'bg-[#f1f4f2] text-portal-ink' : 'text-portal-soft hover:bg-[#f5f7f4]'
            }`}
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-[10px] bg-[#f1f4f2] text-portal-soft">
              <Menu className="h-[18px] w-[18px]" />
            </span>
            Lainnya
          </button>
        </div>
      </nav>

      <PortalDialog
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="Lainnya"
        description="Stok, laporan, toko online, dan pengaturan usaha."
        size="sm"
      >
        <div className="space-y-4">
          {businessLinks.length ? (
            <section>
              <p className="mb-1.5 px-2 text-[10px] font-black uppercase tracking-[.12em] text-portal-soft/75">Kelola usaha</p>
              <div className="space-y-1">{businessLinks.map(menuLink)}</div>
            </section>
          ) : null}
          {settingsLinks.length ? (
            <section className={businessLinks.length ? 'border-t border-portal-line pt-3' : ''}>
              <p className="mb-1.5 px-2 text-[10px] font-black uppercase tracking-[.12em] text-portal-soft/75">Pengaturan</p>
              <div className="space-y-1">{settingsLinks.map(menuLink)}</div>
            </section>
          ) : null}
        </div>
      </PortalDialog>
    </>
  );
}
