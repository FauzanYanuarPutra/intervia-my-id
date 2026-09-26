import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { BusinessRecord, PortalSection } from '@/lib/portal-types';
import { getSetupSteps } from '@/lib/portal-logic';
import { businessHasCapability } from '@/lib/business-templates';

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

function businessKind(business: BusinessRecord) {
  const template = business.templateKey ?? business.profile?.templateKey ?? 'general';
  const category = business.category.trim().toLocaleLowerCase('id-ID');

  switch (template) {
    case 'juice_fnb':
      return 'food';
    case 'mart_retail':
      return 'retail';
    case 'laundry':
    case 'ac_field_service':
      return 'service';
    default:
      if (/jasa|servis|service|konsultan|laundry|teknisi/.test(category)) return 'service';
      if (/makanan|minuman|f&b|kopi|cafe|resto|kuliner/.test(category)) return 'food';
      if (/toko|retail|grosir|distributor|dagang/.test(category)) return 'retail';
      return 'general';
  }
}

function stepsFor(business: BusinessRecord, section: PortalSection): GuideStep[] {
  const id = business.id;
  const kind = businessKind(business);
  const hasInventory = businessHasCapability(
    {
      templateKey: business.templateKey ?? business.profile?.templateKey,
      activeCapabilityKeys: business.activeCapabilityKeys,
      category: business.category,
    },
    'inventory',
  );
  const catalogNoun =
    kind === 'food' ? 'menu' :
    kind === 'service' ? 'layanan' :
    kind === 'retail' ? 'produk' :
    'produk atau layanan';

  switch (section) {
    case 'products':
      return kind === 'service'
        ? [
            { id: 'services', label: 'Tambah layanan', hint: 'Nama + harga dulu.', href: href(id, '/products') },
            { id: 'work', label: 'Atur pekerjaan', hint: 'Gunakan alur kerja saat order masuk.', href: href(id, '/work') },
            { id: 'sell', label: 'Catat transaksi', hint: 'Simpan pembayaran setelah pekerjaan selesai.', href: href(id, '/orders') },
          ]
        : [
            { id: 'products', label: `Tambah ${catalogNoun}`, hint: 'Nama + harga dulu.', href: href(id, '/products') },
            ...(kind === 'food'
              ? [{ id: 'cost', label: 'Hitung modal', hint: 'Lengkapi bahan bila ingin menghitung laba.', href: href(id, '/products/hpp') }]
              : []),
            { id: 'sell', label: 'Mulai jualan', hint: 'Catat transaksi saat pelanggan membeli.', href: href(id, '/orders') },
          ];
    case 'inventory':
      return [
        { id: 'stock', label: 'Cek stok', hint: 'Tangani yang tipis atau habis dulu.', href: href(id, '/inventory') },
        { id: 'purchase', label: 'Tambah stok', hint: 'Catat barang yang baru masuk.', href: href(id, '/inventory?tab=purchase') },
        { id: 'review', label: 'Cocokkan', hint: 'Pastikan jumlah di Lajukan sesuai kondisi nyata.', href: href(id, '/inventory') },
      ];
    case 'orders':
      return kind === 'service'
        ? [
            { id: 'receive', label: 'Terima order', hint: 'Catat kebutuhan pelanggan.', href: href(id, '/orders') },
            { id: 'work', label: 'Kerjakan', hint: 'Pantau pekerjaan dan orang yang menangani.', href: href(id, '/work') },
            { id: 'finish', label: 'Selesaikan & bayar', hint: 'Tutup pekerjaan setelah beres.', href: href(id, '/orders') },
          ]
        : [
            { id: 'open', label: 'Siap jualan', hint: 'Kasir siap dipakai saat transaksi masuk.', href: href(id, '/orders') },
            { id: 'sell', label: 'Catat jualan', hint: `Tap ${catalogNoun}, atur jumlah, lalu bayar.`, href: href(id, '/orders') },
            { id: 'review', label: 'Cek transaksi', hint: 'Pastikan semua jualan hari ini sudah tersimpan.', href: href(id, '/orders?view=transaksi') },
          ];
    case 'finance':
      return [
        { id: 'income', label: 'Uang masuk', hint: 'Jualan yang dicatat akan masuk otomatis.', href: href(id, '/finance') },
        { id: 'expense', label: 'Uang keluar', hint: 'Catat biaya saat benar-benar terjadi.', href: href(id, '/finance') },
        { id: 'review', label: 'Cek hasil', hint: 'Lihat saldo dan angka yang sudah tercatat.', href: href(id, '/reports') },
      ];
    case 'channels':
      return [
        { id: 'choose', label: 'Pilih tempat jual', hint: 'Aktifkan yang benar-benar kamu gunakan.', href: href(id, '/channels') },
        { id: 'price', label: 'Atur harga online', hint: 'Sesuaikan harga dengan potongan kanal.', href: href(id, '/channels') },
        { id: 'test', label: 'Cek hasil', hint: 'Pastikan harga dan hasilnya masih masuk akal.', href: href(id, '/reports') },
      ];
    case 'info':
      return [
        { id: 'identity', label: 'Profil usaha', hint: 'Nama, kategori, dan kontak.', href: href(id, '/info') },
        { id: 'location', label: 'Lokasi', hint: 'Alamat + pin harus tepat.', href: href(id, '/locations') },
        { id: 'store', label: 'Tampilan pelanggan', hint: 'Cek halaman yang dilihat pelanggan.', href: href(id, '/buyer-page') },
      ];
    case 'locations':
      return [
        { id: 'one', label: 'Lokasi utama', hint: 'Pastikan outlet atau area utama sudah benar.', href: href(id, '/locations') },
        { id: 'map', label: 'Pin tepat', hint: 'Geser marker bila perlu.', href: href(id, '/locations') },
        { id: 'store', label: 'Cek publik', hint: 'Pastikan pelanggan mudah menemukan.', href: href(id, '/buyer-page') },
      ];
    case 'operations':
      return [
        { id: 'status', label: 'Buka / tutup', hint: 'Sesuaikan kondisi usaha hari ini.', href: href(id, '/operations') },
        { id: 'schedule', label: 'Jam usaha', hint: 'Tulis jam yang benar-benar berlaku.', href: href(id, '/operations') },
        ...(hasInventory
          ? [{ id: 'stock', label: 'Cek stok', hint: 'Tangani stok yang menghambat jualan.', href: href(id, '/inventory') }]
          : [{ id: 'work', label: 'Cek pekerjaan', hint: 'Pastikan pekerjaan yang berjalan tidak tertinggal.', href: href(id, '/work') }]),
      ];
    case 'team':
      return [
        { id: 'invite', label: 'Undang anggota', hint: 'Tambahkan orang yang membantu usaha.', href: href(id, '/team') },
        { id: 'role', label: 'Pilih peran', hint: 'Atur siapa mengerjakan apa.', href: href(id, '/team') },
        { id: 'access', label: 'Cek akses', hint: 'Pastikan akses sesuai tugas.', href: href(id, '/team') },
      ];
    case 'reports':
      return [
        { id: 'sales', label: 'Penjualan', hint: 'Pastikan transaksi sudah tercatat.', href: href(id, '/orders?view=transaksi') },
        { id: 'cost', label: kind === 'service' ? 'Biaya' : 'Modal', hint: 'Lengkapi data biaya bila ingin melihat hasil yang lebih lengkap.', href: kind === 'food' ? href(id, '/products/hpp') : href(id, '/finance') },
        { id: 'review', label: 'Baca hasil', hint: 'Lihat angka yang benar-benar tercatat.', href: href(id, '/reports') },
      ];
    case 'buyerPage':
      return [
        { id: 'profile', label: 'Profil', hint: 'Nama, kontak, dan deskripsi.', href: href(id, '/info') },
        { id: 'catalog', label: `${catalogNoun[0].toUpperCase()}${catalogNoun.slice(1)}`, hint: 'Pastikan yang ditampilkan sudah benar.', href: href(id, '/products') },
        { id: 'publish', label: 'Buka halaman', hint: 'Bagikan halaman usaha saat sudah siap.', href: business.publicUrl },
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

      if (kind === 'service') {
        return [
          { id: 'profile', label: next?.id === 'products' ? 'Isi layanan' : 'Rapikan dasar', hint: next?.hint ?? 'Profil usaha sudah siap.', href: nextHref },
          { id: 'work', label: 'Siapkan pekerjaan', hint: 'Buat layanan lalu gunakan alur kerja saat order datang.', href: href(id, '/work') },
          { id: 'sell', label: 'Terima transaksi', hint: 'Catat pembayaran setelah pekerjaan selesai.', href: href(id, '/orders') },
        ];
      }

      return [
        { id: 'profile', label: 'Rapikan dasar', hint: next?.label ?? 'Profil usaha sudah siap.', href: nextHref },
        { id: 'catalog', label: kind === 'food' ? 'Isi menu' : kind === 'retail' ? 'Isi produk' : 'Isi katalog', hint: 'Nama + harga sudah cukup untuk mulai.', href: href(id, '/products') },
        ...(hasInventory
          ? [{ id: 'stock', label: 'Cek stok', hint: 'Pastikan yang dijual tersedia.', href: href(id, '/inventory') }]
          : [{ id: 'sell', label: 'Mulai transaksi', hint: 'Catat jualan saat pelanggan membeli.', href: href(id, '/orders') }]),
      ];
    }
  }
}
export function UsahaFlowGuide({ business, currentSection }: UsahaFlowGuideProps) {
  const steps = stepsFor(business, currentSection);

  const expandedByDefault = currentSection === 'home';

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
