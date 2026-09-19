import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { BusinessRecord, PortalSection } from '@/lib/portal-types';
import { getSetupSteps } from '@/lib/portal-logic';

type GuideStep = {
  id: string;
  label: string;
  hint: string;
  href?: string;
};

type UsahaFlowGuideProps = {
  business: BusinessRecord;
  currentSection: PortalSection;
};

const href = (businessId: string, path = '') => '/businesses/' + businessId + path;

function stepsFor(business: BusinessRecord, section: PortalSection): GuideStep[] {
  const id = business.id;

  switch (section) {
    case 'products':
      return [
        { id: 'products', label: 'Tambah barang', hint: 'Isi nama + harga.', href: href(id, '/products') },
        { id: 'hpp', label: 'Hitung modal', hint: 'Tambah bahan yang dipakai.', href: href(id, '/products/hpp') },
        { id: 'sell', label: 'Mulai jual', hint: 'Mulai jual setelah siap.', href: href(id, '/orders') },
      ];
    case 'inventory':
      return [
        { id: 'stock', label: 'Cek stok', hint: 'Cek yang tipis atau habis.', href: href(id, '/inventory') },
        { id: 'ingredients', label: 'Rapikan bahan', hint: 'Isi harga beli dan satuan.', href: href(id, '/inventory?tab=ingredients') },
        { id: 'hpp', label: 'Pakai di HPP', hint: 'Siap dipakai di HPP.', href: href(id, '/products/hpp') },
      ];
    case 'orders':
      return [
        { id: 'open', label: 'Buka kas', hint: 'Buka kas bila perlu.', href: href(id, '/orders') },
        { id: 'sell', label: 'Catat jualan', hint: 'Pilih produk, lalu bayar.', href: href(id, '/orders') },
        { id: 'close', label: 'Tutup & cek', hint: 'Cek transaksi dan kas.', href: href(id, '/orders?view=transaksi') },
      ];
    case 'finance':
      return [
        { id: 'income', label: 'Catat uang masuk', hint: 'Penjualan masuk otomatis.', href: href(id, '/finance') },
        { id: 'expense', label: 'Catat uang keluar', hint: 'Catat saat uang keluar.', href: href(id, '/finance') },
        { id: 'review', label: 'Cek saldo', hint: 'Cocokkan dengan saldo nyata.', href: href(id, '/reports') },
      ];
    case 'channels':
      return [
        { id: 'choose', label: 'Pilih kanal', hint: 'Pilih kanal yang dipakai.', href: href(id, '/channels') },
        { id: 'price', label: 'Atur harga online', hint: 'Atur setelah HPP siap.', href: href(id, '/channels') },
        { id: 'test', label: 'Cek hasil', hint: 'Cek hasilnya.', href: href(id, '/reports') },
      ];
    case 'info':
      return [
        { id: 'identity', label: 'Profil usaha', hint: 'Nama, kategori, kontak.', href: href(id, '/info') },
        { id: 'location', label: 'Lokasi', hint: 'Pastikan alamat + pin benar.', href: href(id, '/locations') },
        { id: 'store', label: 'Tampilan toko', hint: 'Lihat tampilan toko.', href: href(id, '/buyer-page') },
      ];
    case 'locations':
      return [
        { id: 'one', label: 'Lokasi utama', hint: 'Pastikan minimal satu outlet utama.', href: href(id, '/locations') },
        { id: 'map', label: 'Pin tepat', hint: 'Geser marker bila perlu.', href: href(id, '/locations') },
        { id: 'store', label: 'Cek publik', hint: 'Pastikan pelanggan mudah menemukan.', href: href(id, '/buyer-page') },
      ];
    case 'operations':
      return [
        { id: 'status', label: 'Status buka/tutup', hint: 'Sesuaikan kondisi hari ini.', href: href(id, '/operations') },
        { id: 'schedule', label: 'Jam usaha', hint: 'Tulis jam yang realistis.', href: href(id, '/operations') },
        { id: 'stock', label: 'Cek gangguan', hint: 'Tangani stok yang menghambat jualan.', href: href(id, '/inventory') },
      ];
    case 'team':
      return [
        { id: 'invite', label: 'Undang anggota', hint: 'Cari akun Lajukan.', href: href(id, '/team') },
        { id: 'role', label: 'Pilih peran', hint: 'Pilih tugas dan akses.', href: href(id, '/team') },
        { id: 'access', label: 'Cek akses', hint: 'Cek akses tiap orang.', href: href(id, '/team') },
      ];
    case 'reports':
      return [
        { id: 'sales', label: 'Penjualan', hint: 'Cek penjualan.', href: href(id, '/orders?view=transaksi') },
        { id: 'cost', label: 'HPP', hint: 'Lengkapi HPP bila perlu.', href: href(id, '/products/hpp') },
        { id: 'review', label: 'Baca hasil', hint: 'Baca hasilnya.', href: href(id, '/reports') },
      ];
    case 'buyerPage':
      return [
        { id: 'profile', label: 'Profil', hint: 'Nama dan info usaha.', href: href(id, '/info') },
        { id: 'products', label: 'Produk', hint: 'Cek produk dan harga.', href: href(id, '/products') },
        { id: 'publish', label: 'Buka toko', hint: 'Bagikan toko saat siap.', href: business.publicUrl },
      ];
    case 'home':
    default: {
      const setup = getSetupSteps(business);
      const next = setup.find(step => !step.done);
      const nextHref =
        next?.id === 'locations'
          ? href(id, '/locations')
          : next?.id === 'products'
            ? href(id, '/products')
            : href(id, '/info');
      return [
        { id: 'profile', label: 'Rapikan dasar', hint: next?.label ?? 'Profil usaha sudah siap.', href: nextHref },
        { id: 'product', label: 'Isi barang', hint: 'Nama + harga sudah cukup untuk mulai.', href: href(id, '/products') },
        { id: 'sell', label: 'Mulai jual', hint: 'Pakai Kasir saat siap.', href: href(id, '/orders') },
      ];
    }
  }
}

export function UsahaFlowGuide({ business, currentSection }: UsahaFlowGuideProps) {
  const steps = stepsFor(business, currentSection);

  return (
    <section className="merchant-surface-bordered overflow-hidden" aria-label="Alur kerja usaha">
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.12em] text-portal-forest">Mulai di sini</p>
          <p className="mt-0.5 text-sm font-black text-portal-ink">Kerjakan yang perlu dulu. Detail bisa belakangan.</p>
        </div>
        <p className="text-xs font-semibold text-portal-soft">3 langkah</p>
      </div>

      <div className="border-t border-portal-line/70 px-3 py-2 sm:px-4">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {steps.map((step, index) => (
            <Link
              key={step.id}
              href={step.href ?? '#'}
              className="group min-w-[205px] flex-1 rounded-xl border border-portal-line/70 bg-white px-3 py-2.5 transition hover:border-portal-forest/25 hover:bg-portal-mist/40"
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-portal-mist text-[10px] font-black text-portal-forest">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-portal-ink">{step.label}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-portal-soft">{step.hint}</p>
                </div>
                <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-portal-soft transition group-hover:translate-x-0.5 group-hover:text-portal-forest" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
