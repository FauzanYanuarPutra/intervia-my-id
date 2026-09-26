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
        { id: 'products', label: 'Tambah barang', hint: 'Nama + harga dulu.', href: href(id, '/products') },
        { id: 'hpp', label: 'Hitung modal', hint: 'Masukkan bahan yang dipakai.', href: href(id, '/products/hpp') },
        { id: 'sell', label: 'Mulai jual', hint: 'Pakai Kasir setelah produk siap.', href: href(id, '/orders') },
      ];
    case 'inventory':
      return [
        { id: 'stock', label: 'Cek stok', hint: 'Tangani yang tipis/habis.', href: href(id, '/inventory') },
        { id: 'ingredients', label: 'Rapikan bahan', hint: 'Harga beli + satuan dipakai untuk HPP.', href: href(id, '/inventory?tab=ingredients') },
        { id: 'hpp', label: 'Pakai di HPP', hint: 'Bahan siap dipilih di resep.', href: href(id, '/products/hpp') },
      ];
    case 'orders':
      return [
        { id: 'open', label: 'Buka kas', hint: 'Pastikan shift siap bila dipakai.', href: href(id, '/orders') },
        { id: 'sell', label: 'Catat jualan', hint: 'Tap produk, atur pesanan, bayar.', href: href(id, '/orders') },
        { id: 'close', label: 'Tutup & cek', hint: 'Pastikan transaksi dan kas cocok.', href: href(id, '/orders?view=transaksi') },
      ];
    case 'finance':
      return [
        { id: 'income', label: 'Catat uang masuk', hint: 'Gunakan penjualan yang sudah tercatat.', href: href(id, '/finance') },
        { id: 'expense', label: 'Catat uang keluar', hint: 'Simpan biaya saat terjadi.', href: href(id, '/finance') },
        { id: 'review', label: 'Cek saldo', hint: 'Bandingkan dengan kas nyata.', href: href(id, '/reports') },
      ];
    case 'channels':
      return [
        { id: 'choose', label: 'Pilih kanal', hint: 'Aktifkan yang benar-benar dipakai.', href: href(id, '/channels') },
        { id: 'price', label: 'Atur harga online', hint: 'Hitung setelah HPP siap.', href: href(id, '/channels') },
        { id: 'test', label: 'Cek hasil', hint: 'Pastikan harga masih masuk akal.', href: href(id, '/reports') },
      ];
    case 'info':
      return [
        { id: 'identity', label: 'Profil usaha', hint: 'Nama, kategori, kontak.', href: href(id, '/info') },
        { id: 'location', label: 'Lokasi', hint: 'Pastikan alamat + pin benar.', href: href(id, '/locations') },
        { id: 'store', label: 'Tampilan toko', hint: 'Cek apa yang dilihat pelanggan.', href: href(id, '/buyer-page') },
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
    case 'work':
      return [
        { id: 'scan', label: 'Lihat pekerjaan', hint: 'Mulai dari tugas yang paling penting atau paling dekat jatuh tempo.', href: href(id, '/work') },
        { id: 'assign', label: 'Bagikan tugas', hint: 'Pilih orang yang tepat saat pekerjaan perlu dikerjakan bersama.', href: href(id, '/work') },
        { id: 'finish', label: 'Selesaikan & pantau', hint: 'Tandai selesai agar kondisi usaha tetap terbarui.', href: href(id, '/work') },
      ];
    case 'parties':
      return [
        { id: 'add', label: 'Simpan kontak', hint: 'Nama + telepon sudah cukup untuk mulai.', href: href(id, '/parties') },
        { id: 'role', label: 'Pilih peran', hint: 'Tandai sebagai pelanggan, supplier, atau keduanya.', href: href(id, '/parties') },
        { id: 'settle', label: 'Pantau saldo', hint: 'Piutang dan utang akan mengikuti transaksi yang terkait.', href: href(id, '/parties') },
      ];
    case 'growth':
      return [
        { id: 'presence', label: 'Siapkan etalase', hint: 'Pastikan profil, produk, dan link publik rapi.', href: href(id, '/growth') },
        { id: 'sell', label: 'Aktifkan kanal', hint: 'Pilih kanal jual yang memang dipakai usaha.', href: href(id, '/growth') },
        { id: 'review', label: 'Baca hasil', hint: 'Gunakan laporan dan saran untuk menentukan tindakan berikutnya.', href: href(id, '/growth') },
      ];
    case 'team':
      return [
        { id: 'invite', label: 'Undang anggota', hint: 'Cari username Lajukan.', href: href(id, '/team') },
        { id: 'role', label: 'Pilih peran', hint: 'Kasir, manager, atau pantau.', href: href(id, '/team') },
        { id: 'access', label: 'Cek akses', hint: 'Pastikan tugas sesuai perannya.', href: href(id, '/team') },
      ];
    case 'reports':
      return [
        { id: 'sales', label: 'Penjualan', hint: 'Pastikan transaksi sudah tercatat.', href: href(id, '/orders?view=transaksi') },
        { id: 'cost', label: 'HPP', hint: 'Lengkapi bahan agar laba tidak kosong.', href: href(id, '/products/hpp') },
        { id: 'review', label: 'Baca hasil', hint: 'Lihat angka yang benar-benar tercatat.', href: href(id, '/reports') },
      ];
    case 'buyerPage':
      return [
        { id: 'profile', label: 'Profil', hint: 'Nama, kontak, dan deskripsi.', href: href(id, '/info') },
        { id: 'products', label: 'Produk', hint: 'Pastikan produk aktif dan harganya benar.', href: href(id, '/products') },
        { id: 'publish', label: 'Buka toko', hint: 'Bagikan storefront setelah siap.', href: business.publicUrl },
      ];
    case 'home':
    default: {
      const setup = getSetupSteps(business);
      const next = setup.find(step => !step.done && !step.optional) ?? setup.find(step => !step.done);
      const nextHref =
        next?.id === 'locations'
          ? href(id, '/locations')
          : next?.id === 'products'
            ? href(id, '/products')
            : next?.id === 'operations'
              ? href(id, '/operations')
              : next?.id === 'buyer-page'
                ? href(id, '/buyer-page')
                : href(id, '/info');
      return [
        { id: 'profile', label: 'Rapikan dasar', hint: next?.label ?? 'Data inti usaha sudah siap.', href: nextHref },
        { id: 'product', label: 'Isi barang', hint: 'Nama + harga sudah cukup untuk mulai.', href: href(id, '/products') },
        { id: 'sell', label: 'Mulai jual', hint: 'Pakai Kasir saat siap.', href: href(id, '/orders') },
      ];
    }
  }
}

export function UsahaFlowGuide({ business, currentSection }: UsahaFlowGuideProps) {
  const steps = stepsFor(business, currentSection);

  const expandedByDefault =
    currentSection === 'home' &&
    getSetupSteps(business).some(step => !step.done && !step.optional);

  return (
    <details
      className="merchant-surface-bordered overflow-hidden group"
      aria-label="Alur kerja usaha"
      open={expandedByDefault}
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.12em] text-portal-forest">Cara kerja</p>
          <p className="mt-0.5 truncate text-sm font-black text-portal-ink">3 langkah untuk halaman ini</p>
        </div>
        <span className="shrink-0 text-xs font-bold text-portal-forest group-open:hidden">Buka</span>
        <span className="hidden shrink-0 text-xs font-bold text-portal-soft group-open:inline">Tutup</span>
      </summary>

      <div className="border-t border-portal-line/70 px-3 py-2 sm:px-4">
        <p className="px-1 pb-2 text-[11px] leading-5 text-portal-soft">
          Kerjakan dari kiri ke kanan. Detail bisa dibuka saat datanya sudah siap.
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {steps.map((step, index) => (
            <Link
              key={step.id}
              href={step.href ?? '#'}
              className="group min-w-[190px] flex-1 rounded-xl border border-portal-line/70 bg-white px-3 py-2.5 transition hover:border-portal-forest/25 hover:bg-portal-mist/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20"
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-portal-mist text-[10px] font-black text-portal-forest">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black text-portal-ink">{step.label}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-portal-soft">{step.hint}</p>
                </div>
                <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-portal-soft transition group-hover:translate-x-0.5 group-hover:text-portal-forest" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </details>
  );
}
