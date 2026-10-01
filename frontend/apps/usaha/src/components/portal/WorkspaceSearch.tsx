'use client';

import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ModalSurface } from '@/components/interaction/ModalSurface';
import {
  desktopPrimaryNavigation,
  portalMenuNavigation,
  type PortalNavigationItem,
} from '@/lib/portal-navigation';
import { buildSectionHref } from '@/lib/portal-logic';
import type { BusinessRecord, PortalSection } from '@/lib/portal-types';
import { portalSectionVisual } from '@/lib/portal-visual';

type WorkspaceSearchProps = {
  business: BusinessRecord | null;
};

type SearchItem = PortalNavigationItem & {
  href: string;
  hint: string;
};

const hints: Record<PortalSection, string> = {
  home: 'Ringkasan kondisi usaha dan pekerjaan hari ini',
  orders: 'Kasir, pesanan, transaksi, dan penjualan',
  products: 'Katalog, harga, HPP, dan produk yang dijual',
  inventory: 'Stok barang, bahan, dan penyesuaian persediaan',
  finance: 'Kas, pengeluaran, pemasukan, dan pencatatan uang',
  reports: 'Penjualan, laba kotor, biaya, dan ringkasan usaha',
  channels: 'Kanal jual dan kesiapan harga per kanal',
  info: 'Nama, kontak, profil, dan informasi dasar usaha',
  locations: 'Outlet, alamat, area layanan, dan lokasi utama',
  operations: 'Status buka, jam usaha, dan aturan operasional',
  work: 'Tugas, pekerjaan terbuka, dan pembagian tanggung jawab',
  parties: 'Pelanggan, supplier, mitra, piutang, dan utang',
  growth: 'Etalase, kanal jual, kesiapan promosi, dan saran',
  team: 'Anggota usaha, undangan, dan peran akses',
  buyerPage: 'Tampilan toko publik yang dilihat pelanggan',
  security: 'Sesi, keamanan akun, dan aktivitas akses',
  dataReset: 'Reset data operasional usaha dengan bukti dan perlindungan histori',
};

function uniqueNavigation(items: PortalNavigationItem[]) {
  const seen = new Set<PortalSection>();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function WorkspaceSearch({ business }: WorkspaceSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo<SearchItem[]>(() => {
    if (!business) return [];
    const navigation = uniqueNavigation([
      ...desktopPrimaryNavigation(business.permissions),
      ...portalMenuNavigation(business.permissions),
    ]);
    return navigation.map(item => ({
      ...item,
      href: buildSectionHref(business.id, item.id),
      hint: hints[item.id],
    }));
  }, [business]);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('id-ID');
    if (!needle) return items;
    return items.filter(item =>
      `${item.label} ${item.hint}`.toLocaleLowerCase('id-ID').includes(needle),
    );
  }, [items, query]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    }

    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  if (!business || !items.length) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Cari di usaha"
        title="Cari di usaha (Ctrl K)"
        onClick={() => {
          setQuery('');
          setOpen(true);
        }}
        className="portal-button-ghost min-h-11 px-2.5 sm:px-3"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Cari</span>
        <kbd className="hidden rounded-md border border-portal-line bg-[#f7f9f7] px-1.5 py-0.5 text-[10px] font-bold text-portal-soft lg:inline">Ctrl K</kbd>
      </button>

      <ModalSurface
        open={open}
        onOpenChange={setOpen}
        ariaLabel="Cari di usaha"
        presentation="adaptive"
        size="lg"
        returnFocusRef={triggerRef}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-portal-line px-4 pb-3 pt-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="portal-kicker">Pindah halaman</p>
                <h2 className="mt-1 text-xl font-black tracking-[-.035em] text-portal-ink">Cari area usaha</h2>
              </div>
              <button
                type="button"
                aria-label="Tutup pencarian usaha"
                onClick={() => setOpen(false)}
                className="portal-icon-button text-portal-soft hover:bg-portal-mist hover:text-portal-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="relative mt-3 block">
              <span className="sr-only">Cari halaman usaha</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-portal-soft" />
              <input
                ref={inputRef}
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Ketik produk, stok, uang, pelanggan..."
                className="portal-input w-full pl-10 pr-3"
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            {filteredItems.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {filteredItems.map(item => {
                  const visual = portalSectionVisual[item.id];
                  const Icon = visual.icon;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="group flex min-h-[68px] items-center gap-3 rounded-2xl border border-portal-line bg-white px-3.5 py-3 transition hover:border-portal-forest/30 hover:bg-portal-mist/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20"
                    >
                      <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${visual.iconClass}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black text-portal-ink">{item.label}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-portal-soft">{item.hint}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="grid min-h-44 place-items-center p-6 text-center">
                <div>
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-portal-mist text-portal-forest">
                    <Search className="h-5 w-5" />
                  </span>
                  <p className="mt-3 text-sm font-black text-portal-ink">Belum ada halaman yang cocok</p>
                  <p className="mt-1 text-xs leading-5 text-portal-soft">Coba kata yang lebih umum seperti produk, jual, stok, atau uang.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </ModalSurface>
    </>
  );
}
