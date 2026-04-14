import crypto from 'node:crypto';
import { getUmkmSectorFromBusinessCategory, type UmkmBusinessCategoryId } from '@/lib/super-app/umkm-taxonomy';
import type {
  RuntimeState,
  UmkmProduct,
  UmkmQrToken,
  UmkmStore,
  UmkmStoreMember,
  UmkmTable,
} from './umkm-commerce.types';
import { localProductImageForCategory } from '@/lib/media/localSeedMedia';
import { randomToken, slugify, withTime } from './umkm-commerce.utils';

type SeedStoreRow = Omit<UmkmStore, 'created_at' | 'updated_at'>;
type SeedCityHub = {
  city: string;
  area: string;
  road: string;
  lat: number;
  lng: number;
};
type SeedGroupConfig = {
  category: UmkmBusinessCategoryId;
  count: number;
  preferredQr: 'online' | 'offline';
  online: boolean;
  offline: boolean;
  hours: string[];
  variants: Array<{
    title: string;
    focus: string;
    summary: string;
    hint: string;
  }>;
};

const BASE_STORE_COUNT = 10;
const STORE_ID_PREFIX = '50000000-0000-0000-0000-';
const CITY_HUBS: SeedCityHub[] = [
  { city: 'Jakarta', area: 'Tebet', road: 'Jl. Tebet Barat Dalam Raya', lat: -6.23512, lng: 106.84883 },
  { city: 'Bandung', area: 'Braga', road: 'Jl. Braga', lat: -6.91746, lng: 107.60981 },
  { city: 'Surabaya', area: 'Darmo', road: 'Jl. Raya Darmo', lat: -7.29092, lng: 112.73439 },
  { city: 'Yogyakarta', area: 'Malioboro', road: 'Jl. Malioboro', lat: -7.79225, lng: 110.36584 },
  { city: 'Denpasar', area: 'Renon', road: 'Jl. Raya Puputan', lat: -8.67046, lng: 115.21263 },
  { city: 'Makassar', area: 'Panakkukang', road: 'Jl. Boulevard Panakkukang', lat: -5.15709, lng: 119.43273 },
  { city: 'Medan', area: 'Setia Budi', road: 'Jl. Setia Budi', lat: 3.589665, lng: 98.673826 },
  { city: 'Semarang', area: 'Pandanaran', road: 'Jl. Pandanaran', lat: -6.991647, lng: 110.420296 },
  { city: 'Balikpapan', area: 'Klandasan', road: 'Jl. Jenderal Sudirman', lat: -1.265386, lng: 116.8312 },
  { city: 'Mataram', area: 'Senggigi', road: 'Jl. Raya Senggigi', lat: -8.489207, lng: 116.046432 },
  { city: 'Bogor', area: 'Pajajaran', road: 'Jl. Pajajaran', lat: -6.595038, lng: 106.816635 },
  { city: 'Malang', area: 'Ijen', road: 'Jl. Ijen', lat: -7.96662, lng: 112.63263 },
  { city: 'Solo', area: 'Manahan', road: 'Jl. Adi Sucipto', lat: -7.5595, lng: 110.8062 },
  { city: 'Palembang', area: 'Ilir Barat', road: 'Jl. Jenderal Sudirman', lat: -2.976074, lng: 104.77543 },
  { city: 'Pekanbaru', area: 'Harapan Raya', road: 'Jl. Harapan Raya', lat: 0.507068, lng: 101.447777 },
  { city: 'Pontianak', area: 'Gajah Mada', road: 'Jl. Gajah Mada', lat: -0.02633, lng: 109.3425 },
  { city: 'Banjarmasin', area: 'Kayu Tangi', road: 'Jl. A. Yani Km 4', lat: -3.3186, lng: 114.5944 },
  { city: 'Manado', area: 'Boulevard', road: 'Jl. Piere Tendean', lat: 1.4748, lng: 124.8421 },
  { city: 'Bandar Lampung', area: 'Tanjung Karang', road: 'Jl. Kartini', lat: -5.429, lng: 105.261 },
  { city: 'Padang', area: 'Khatib Sulaiman', road: 'Jl. Khatib Sulaiman', lat: -0.9471, lng: 100.3609 },
];
const BASE_META = [
  ['culinary', 'masakan rumahan dan ayam nusantara', 'kuliner nusantara ayam rice bowl soto delivery jakarta', 4.8, 412],
  ['culinary', 'kopi susu dan pastry', 'coffee shop pastry brunch kopi', 4.9, 538],
  ['culinary', 'seafood keluarga', 'seafood keluarga dine-in sambal pesisir', 4.7, 367],
  ['warung_kios', 'jajanan tradisional dan oleh-oleh', 'warung kios jajanan pasar oleh-oleh', 4.6, 294],
  ['culinary', 'healthy bowl dan juice', 'healthy bowl vegan juice fresh food', 4.8, 326],
  ['culinary', 'bakery artisan dan sarapan', 'bakery artisan roti pastry sarapan', 4.7, 281],
  ['culinary', 'soto medan dan teh tarik', 'soto medan teh tarik dine-in keluarga', 4.6, 268],
  ['culinary', 'ayam bakar dan nasi liwet', 'ayam bakar nasi liwet keluarga dine-in', 4.7, 334],
  ['culinary', 'rice bowl seafood dan sambal', 'rice bowl seafood kalimantan sambal', 4.6, 251],
  ['culinary', 'ayam taliwang dan bakaran lombok', 'ayam taliwang bakaran lombok dine-in', 4.8, 389],
] as const;
const EXTRA_GROUPS: SeedGroupConfig[] = [
  { category: 'culinary', count: 5, preferredQr: 'offline', online: true, offline: true, hours: ['06:30-20:00', '07:00-22:00', '08:00-21:00', '10:00-23:00', '24 jam'], variants: [
    { title: 'Dapur Seruni', focus: 'lunch box dan lauk rumahan', summary: 'Paket makan siang cepat dan lauk harian.', hint: 'kuliner lunch box lauk rumahan catering kecil' },
    { title: 'Kopi Pesisir', focus: 'kopi susu dan pastry pagi', summary: 'Kopi susu, roti pagi, dan meja kerja singkat.', hint: 'coffee kopi pastry brunch nongkrong' },
    { title: 'Warung Tumbuk', focus: 'sambal fresh dan nasi ayam', summary: 'Warung cepat saji untuk makan siang dan takeaway.', hint: 'warung ayam sambal takeaway delivery' },
    { title: 'Bakmi Halaman', focus: 'bakmi, pangsit, dan menu malam', summary: 'Bakmi dan porsi rame untuk keluarga malam hari.', hint: 'bakmi pangsit dine-in makan malam' },
    { title: 'Roti Pagi Kota', focus: 'bakery artisan dan kopi pagi', summary: 'Roti artisan, pastry, dan kopi takeaway.', hint: 'bakery pastry kopi pagi sarapan' },
  ] },
  { category: 'grocery_retail', count: 17, preferredQr: 'online', online: true, offline: true, hours: ['07:00-20:00', '08:00-21:00', '09:00-21:00', '10:00-20:30'], variants: [
    { title: 'Toko Restock', focus: 'sembako dan kebutuhan restock outlet', summary: 'Sembako, bahan baku dasar, dan paket restock.', hint: 'retail sembako supplier bahan baku outlet warung' },
    { title: 'Grosir Mitra', focus: 'grosir snack dan minuman', summary: 'Belanja grosir snack dan minuman untuk reseller.', hint: 'grosir snack minuman reseller retail' },
    { title: 'Rumah Cantik', focus: 'beauty dan personal care lokal', summary: 'Skincare lokal dan personal care ready stock.', hint: 'beauty skincare personal care retail' },
    { title: 'Pusat Loka', focus: 'fashion, aksesoris, dan home living', summary: 'Fashion harian dan home living dalam stok cepat.', hint: 'fashion home living retail aksesoris' },
    { title: 'Bahan Baku Niaga', focus: 'kemasan, bahan baku, dan kebutuhan toko', summary: 'Kebutuhan toko dan kemasan untuk usaha harian.', hint: 'supplier kemasan bahan baku kebutuhan toko retail' },
    { title: 'Outlet Saku', focus: 'produk harian dan kemasan praktis', summary: 'Produk daily needs untuk konsumen akhir dan reseller.', hint: 'daily needs retail warung reseller' },
  ] },
  { category: 'services_local', count: 17, preferredQr: 'online', online: true, offline: true, hours: ['08:00-18:00', '09:00-19:00', '10:00-20:00', '07:30-17:30'], variants: [
    { title: 'Studio Tumbuh', focus: 'foto produk dan konten sosial media', summary: 'Produksi foto dan video singkat untuk jualan online.', hint: 'jasa foto produk konten sosial media studio' },
    { title: 'Laundry Kilat', focus: 'laundry kiloan dan express', summary: 'Laundry express untuk rumah tangga dan kost.', hint: 'jasa laundry express kiloan' },
    { title: 'Admin Toko', focus: 'operasional marketplace dan customer chat', summary: 'Bantuan admin toko, upload katalog, dan chat.', hint: 'jasa admin toko marketplace chat operasional' },
    { title: 'Cetak Cepat', focus: 'printing, kemasan, dan banner', summary: 'Cetak stiker, banner, dan kemasan batch kecil.', hint: 'jasa printing kemasan banner' },
    { title: 'Servis Rumah', focus: 'cleaning, AC, dan perawatan ringan', summary: 'Jadwal kunjungan rumah untuk cleaning dan servis.', hint: 'jasa cleaning servis ac kunjungan' },
    { title: 'Kelas Aksi', focus: 'kursus singkat dan pelatihan UMKM', summary: 'Pelatihan singkat dan workshop digital rutin.', hint: 'kelas kursus pelatihan digital umkm' },
  ] },
  { category: 'crafts_souvenirs', count: 17, preferredQr: 'online', online: true, offline: true, hours: ['08:30-18:00', '09:00-18:30', '10:00-19:00'], variants: [
    { title: 'Rumah Kriya', focus: 'souvenir custom dan hampers batch', summary: 'Souvenir custom, hampers acara, dan batch kecil.', hint: 'kriya souvenir hampers custom artisan' },
    { title: 'Anyam Tepi', focus: 'anyaman, rotan, dan dekor artisan', summary: 'Produk anyaman dan craft lokal handmade.', hint: 'anyaman rotan craft artisan dekor' },
    { title: 'Batik Sudut', focus: 'batik, kain, dan merchandise lokal', summary: 'Batik siap pakai dan merchandise oleh-oleh.', hint: 'batik kain merchandise souvenir' },
    { title: 'Rajut Cerita', focus: 'rajut handmade dan gift set', summary: 'Rajut handmade dan gift set untuk order custom.', hint: 'rajut handmade gift set kriya' },
    { title: 'Atelier Oleh-Oleh', focus: 'oleh-oleh lokal dan gift set', summary: 'Gift set lokal dan souvenir premium siap kirim.', hint: 'oleh-oleh gift set souvenir lokal' },
    { title: 'Studio Serat', focus: 'tenun, serat alam, dan aksen rumah', summary: 'Produk tenun dan aksesoris ruang dengan stok terbatas.', hint: 'tenun serat alam home decor craft' },
  ] },
  { category: 'automotive_tools', count: 17, preferredQr: 'online', online: true, offline: true, hours: ['08:00-17:00', '08:30-18:00', '09:00-18:30', '10:00-19:00'], variants: [
    { title: 'Bengkel Roda', focus: 'servis motor dan tune up', summary: 'Servis motor harian dan booking slot pemeriksaan cepat.', hint: 'bengkel motor tune up workshop' },
    { title: 'Workshop Las', focus: 'las ringan dan fabrikasi kecil', summary: 'Jasa las dan fabrikasi ringan skala UMKM.', hint: 'workshop las fabrikasi bengkel teknis' },
    { title: 'Sparepart Siaga', focus: 'sparepart, tools, dan kebutuhan servis', summary: 'Stok sparepart cepat dan paket servis berkala.', hint: 'sparepart tools servis workshop' },
    { title: 'Bubut Prima', focus: 'bubut dan machining ringan', summary: 'Pengerjaan bubut ringan dan komponen sederhana.', hint: 'bubut machining workshop teknis' },
    { title: 'Teknik Jalan', focus: 'servis lapangan dan kunjungan lokasi', summary: 'Tim teknis datang ke lokasi untuk cek dan estimasi.', hint: 'servis lapangan workshop kunjungan' },
    { title: 'Garasi Kerja', focus: 'alat kerja dan perawatan unit', summary: 'Perawatan unit kecil dan alat kerja lapangan.', hint: 'alat kerja perawatan unit workshop' },
  ] },
  { category: 'agri_fishery', count: 17, preferredQr: 'online', online: true, offline: true, hours: ['05:30-16:00', '06:00-17:00', '07:00-18:00', '08:00-17:30'], variants: [
    { title: 'Kebun Segar', focus: 'sayur fresh dan panen mingguan', summary: 'Sayur panen rutin dan supply harian UMKM kuliner.', hint: 'agri sayur fresh panen supplier kuliner' },
    { title: 'Bibit Tumbuh', focus: 'bibit, pupuk, dan alat tanam', summary: 'Bibit siap tanam dan perlengkapan kebun.', hint: 'bibit pupuk alat tanam agri' },
    { title: 'Mina Loka', focus: 'hasil laut dan supply perikanan', summary: 'Supply perikanan dan bahan baku segar.', hint: 'perikanan hasil laut supply agri' },
    { title: 'Pakan Sejahtera', focus: 'pakan ternak dan kebutuhan kandang', summary: 'Pakan ternak dan kebutuhan peternakan kecil.', hint: 'pakan ternak peternakan agri' },
    { title: 'Panen Nusantara', focus: 'buah, sayur, dan hasil kebun', summary: 'Buah, sayur, dan hasil kebun lokal terjadwal.', hint: 'buah sayur hasil kebun panen lokal' },
    { title: 'Agro Mandiri', focus: 'supply agrikultur dan kebutuhan farm', summary: 'Supply agrikultur untuk farm kecil dan hidroponik.', hint: 'agro farm hidroponik supply agrikultur' },
  ] },
];

function seedNumber(prefix: string, value: number): string {
  return `${prefix}${String(value).padStart(12, '0')}`;
}

function seedHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function offsetCoord(base: number, seed: number, delta: number): number {
  return Number((base + ((seed % 5) - 2) * delta).toFixed(6));
}

function enrichSeedStore(store: UmkmStore, index: number): UmkmStore {
  const meta = BASE_META[index];
  const source = asRecord(store.metadata);
  return {
    ...store,
    metadata: {
      ...source,
      tax_bps: 1100,
      umkm_category: meta[0],
      business_type: meta[0],
      segment: meta[2],
      focus_label: meta[1],
      rating_avg: meta[3],
      rating_count: meta[4],
      response_time_minutes: 3 + (index % 4),
      outlet_active: true,
    },
  };
}

function buildExtraStores(): UmkmStore[] {
  const rows: SeedStoreRow[] = [];
  let sequence = BASE_STORE_COUNT + 1;

  EXTRA_GROUPS.forEach((group, groupIndex) => {
    for (let index = 0; index < group.count; index += 1) {
      const hub = CITY_HUBS[(index * 2 + groupIndex * 3) % CITY_HUBS.length];
      const variant = group.variants[index % group.variants.length];
      const rating = Number((4.2 + ((index + groupIndex * 2) % 7) / 10).toFixed(1));
      const reviews = 90 + ((index * 37 + groupIndex * 53) % 460);
      const name = `${variant.title} ${hub.area}`;

      rows.push({
        id: seedNumber(STORE_ID_PREFIX, sequence),
        owner_user_id: seedNumber('00000000-0000-0000-0000-', 1000 + sequence),
        name,
        slug: slugify(`${variant.title}-${hub.city}-${hub.area}-${sequence}`),
        description: `${variant.summary} Fokus ${variant.focus} untuk area ${hub.area} dan ${hub.city}.`,
        city: hub.city,
        address: `${hub.road} No. ${12 + ((sequence * 7) % 78)}, ${hub.area}, ${hub.city}`,
        lat: offsetCoord(hub.lat, sequence + groupIndex, 0.0065),
        lng: offsetCoord(hub.lng, sequence * 2 + groupIndex, 0.0075),
        phone: `+62812${String(70_000_000 + sequence).padStart(8, '0')}`,
        is_active: true,
        online_order_enabled: group.online,
        offline_order_enabled: group.offline,
        metadata: {
          recommended_qr: group.preferredQr,
          open_hours: group.hours[index % group.hours.length],
          tax_bps: 1100,
          umkm_category: group.category,
          business_type: group.category,
          segment: variant.hint,
          focus_label: variant.focus,
          rating_avg: rating,
          rating_count: reviews,
          response_time_minutes: 2 + ((index + groupIndex) % 7),
          outlet_active: true,
        },
      });
      sequence += 1;
    }
  });

  return rows.map((row) => withTime(row) as UmkmStore);
}

function seedStores(): UmkmStore[] {
  const baseStores = [
    withTime({
      id: '50000000-0000-0000-0000-000000000001',
      owner_user_id: '00000000-0000-0000-0000-000000000101',
      name: 'Kedai Nusantara Tebet',
      slug: 'kedai-nusantara-tebet',
      description: 'Masakan rumahan nusantara dengan layanan dine-in dan delivery.',
      city: 'Jakarta',
      address: 'Jl. Tebet Barat Dalam Raya No. 14, Jakarta Selatan',
      lat: -6.23512,
      lng: 106.84883,
      phone: '+628111111001',
      is_active: true,
      online_order_enabled: true,
      offline_order_enabled: true,
      metadata: { recommended_qr: 'offline', open_hours: '09:00-22:00', tax_bps: 1100 },
    }),
    withTime({
      id: '50000000-0000-0000-0000-000000000002',
      owner_user_id: '00000000-0000-0000-0000-000000000102',
      name: 'Kopi Sudut Braga',
      slug: 'kopi-sudut-braga',
      description: 'Coffee shop UMKM dengan menu kopi, pastry, dan brunch.',
      city: 'Bandung',
      address: 'Jl. Braga No. 78, Bandung',
      lat: -6.91746,
      lng: 107.60981,
      phone: '+628111111002',
      is_active: true,
      online_order_enabled: true,
      offline_order_enabled: true,
      metadata: { recommended_qr: 'offline', open_hours: '07:00-23:00', tax_bps: 1100 },
    }),
    withTime({
      id: '50000000-0000-0000-0000-000000000003',
      owner_user_id: '00000000-0000-0000-0000-000000000103',
      name: 'Dapur Pesisir Surabaya',
      slug: 'dapur-pesisir-surabaya',
      description: 'Seafood dan makanan keluarga dengan pemesanan online dan scan meja.',
      city: 'Surabaya',
      address: 'Jl. Raya Darmo No. 110, Surabaya',
      lat: -7.29092,
      lng: 112.73439,
      phone: '+628111111003',
      is_active: true,
      online_order_enabled: true,
      offline_order_enabled: true,
      metadata: { recommended_qr: 'offline', open_hours: '10:00-22:30', tax_bps: 1100 },
    }),
    withTime({
      id: '50000000-0000-0000-0000-000000000004',
      owner_user_id: '00000000-0000-0000-0000-000000000301',
      name: 'Pasar Rasa Malioboro',
      slug: 'pasar-rasa-malioboro',
      description: 'UMKM jajanan tradisional dan oleh-oleh khas Jogja.',
      city: 'Yogyakarta',
      address: 'Jl. Malioboro No. 45, Yogyakarta',
      lat: -7.79225,
      lng: 110.36584,
      phone: '+628111111004',
      is_active: true,
      online_order_enabled: true,
      offline_order_enabled: true,
      metadata: { recommended_qr: 'online', open_hours: '08:00-21:00', tax_bps: 1100 },
    }),
    withTime({
      id: '50000000-0000-0000-0000-000000000005',
      owner_user_id: '00000000-0000-0000-0000-000000000301',
      name: 'Warung Sehat Ubud',
      slug: 'warung-sehat-ubud',
      description: 'Healthy bowls, juice, dan menu vegan lokal.',
      city: 'Bali',
      address: 'Jl. Raya Ubud No. 22, Gianyar',
      lat: -8.5069,
      lng: 115.2625,
      phone: '+628111111005',
      is_active: true,
      online_order_enabled: true,
      offline_order_enabled: true,
      metadata: { recommended_qr: 'online', open_hours: '07:30-20:30', tax_bps: 1100 },
    }),
    withTime({
      id: '50000000-0000-0000-0000-000000000006',
      owner_user_id: '00000000-0000-0000-0000-000000000401',
      name: 'Roti & Rempah Makassar',
      slug: 'roti-rempah-makassar',
      description: 'Bakery artisan dan menu sarapan cepat.',
      city: 'Makassar',
      address: 'Jl. Penghibur No. 19, Makassar',
      lat: -5.14766,
      lng: 119.43273,
      phone: '+628111111006',
      is_active: true,
      online_order_enabled: true,
      offline_order_enabled: true,
      metadata: { recommended_qr: 'offline', open_hours: '06:00-21:00', tax_bps: 1100 },
    }),
    withTime({
      id: '50000000-0000-0000-0000-000000000007',
      owner_user_id: '00000000-0000-0000-0000-000000000402',
      name: 'Soto Melayu Medan',
      slug: 'soto-melayu-medan',
      description: 'Soto khas Medan, teh tarik, dan snack gurih untuk dine-in ramai.',
      city: 'Medan',
      address: 'Jl. Teuku Cik Ditiro No. 11, Medan',
      lat: 3.589665,
      lng: 98.673826,
      phone: '+628111111007',
      is_active: true,
      online_order_enabled: true,
      offline_order_enabled: true,
      metadata: { recommended_qr: 'offline', open_hours: '07:00-22:00', tax_bps: 1100 },
    }),
    withTime({
      id: '50000000-0000-0000-0000-000000000008',
      owner_user_id: '00000000-0000-0000-0000-000000000403',
      name: 'Lesehan Tugu Semarang',
      slug: 'lesehan-tugu-semarang',
      description: 'Ayam bakar, nasi liwet, dan minuman rempah untuk keluarga.',
      city: 'Semarang',
      address: 'Jl. Pandanaran No. 66, Semarang',
      lat: -6.991647,
      lng: 110.420296,
      phone: '+628111111008',
      is_active: true,
      online_order_enabled: true,
      offline_order_enabled: true,
      metadata: { recommended_qr: 'offline', open_hours: '10:00-23:00', tax_bps: 1100 },
    }),
    withTime({
      id: '50000000-0000-0000-0000-000000000009',
      owner_user_id: '00000000-0000-0000-0000-000000000404',
      name: 'Sambal Hutan Balikpapan',
      slug: 'sambal-hutan-balikpapan',
      description: 'Rice bowl Kalimantan, seafood lokal, dan sambal signature.',
      city: 'Balikpapan',
      address: 'Jl. Jenderal Sudirman No. 28, Balikpapan',
      lat: -1.265386,
      lng: 116.8312,
      phone: '+628111111009',
      is_active: true,
      online_order_enabled: true,
      offline_order_enabled: true,
      metadata: { recommended_qr: 'offline', open_hours: '10:30-22:30', tax_bps: 1100 },
    }),
    withTime({
      id: '50000000-0000-0000-0000-000000000010',
      owner_user_id: '00000000-0000-0000-0000-000000000405',
      name: 'Ayam Taliwang Senggigi',
      slug: 'ayam-taliwang-senggigi',
      description: 'Ayam taliwang, plecing kangkung, dan menu bakar khas Lombok.',
      city: 'Lombok',
      address: 'Jl. Raya Senggigi No. 18, Lombok Barat',
      lat: -8.489207,
      lng: 116.046432,
      phone: '+628111111010',
      is_active: true,
      online_order_enabled: true,
      offline_order_enabled: true,
      metadata: { recommended_qr: 'offline', open_hours: '11:00-22:00', tax_bps: 1100 },
    }),
  ];

  return [...baseStores.map(enrichSeedStore), ...buildExtraStores()];
}

function buildExtraProductRows(stores: UmkmStore[]): Array<Omit<UmkmProduct, 'created_at' | 'updated_at'>> {
  const rows: Array<Omit<UmkmProduct, 'created_at' | 'updated_at'>> = [];
  let sequence = 1001;

  stores.slice(BASE_STORE_COUNT).forEach((store) => {
    const metadata = asRecord(store.metadata);
    const sector = getUmkmSectorFromBusinessCategory(metadata.umkm_category || metadata.business_type);
    const focus = typeof metadata.focus_label === 'string' ? metadata.focus_label : store.name;
    const channels = store.offline_order_enabled ? ['online', 'offline'] : ['online'];
    const priceShift = (seedHash(store.slug || store.name) % 6) * 150_000;
    const stockShift = seedHash(store.id) % 70;
    const templates =
      sector === 'food'
        ? [
            [`${focus} Signature`, 'Menu utama paling laris untuk dine-in, takeaway, atau delivery.', 'prepared_food', 3_600_000, 120],
            ['Minuman Rumah', 'Pilihan minuman pendamping untuk produk terlaris.', 'beverage', 1_800_000, 220],
          ]
        : sector === 'mart'
          ? [
              [`${focus} Ready Stock`, 'Produk utama dengan stok cepat untuk kebutuhan harian.', 'daily_needs', 3_900_000, 130],
              ['Paket Restock Harian', 'Bundle produk laris untuk restock cepat dan rutin.', 'household_supply', 4_600_000, 96],
            ]
          : sector === 'service'
            ? [
                [`Paket ${focus}`, 'Paket layanan inti untuk kebutuhan rutin dan proyek ringan.', 'service_package', 5_500_000, 40],
                ['Kunjungan Express', 'Slot cepat untuk inspeksi singkat dan permintaan mendesak.', 'repair_maintenance', 3_900_000, 28],
              ]
            : sector === 'craft'
              ? [
                  [`${focus} Handmade`, 'Produk handmade utama dengan batch produksi kecil.', 'craft_artisan_goods', 4_600_000, 70],
                  ['Souvenir Custom', 'Souvenir untuk acara, hampers, dan kebutuhan gift set.', 'souvenir_gift', 3_800_000, 90],
                ]
              : sector === 'agri'
                ? [
                    [`${focus} Grade A`, 'Produk utama dengan kualitas stabil untuk supply rutin.', 'fresh_produce', 3_400_000, 150],
                    ['Bibit / Supply', 'Bibit, supply, atau kebutuhan pendukung operasional lapangan.', 'seed_feed_fertilizer', 2_900_000, 120],
                  ]
                : [
                    [`Servis ${focus}`, 'Paket servis inti untuk alat kerja atau unit teknis.', 'service_package', 6_200_000, 32],
                    ['Sparepart Ready', 'Kebutuhan sparepart dan tools fast-moving.', 'tools_equipment', 5_100_000, 58],
                  ];

    templates.forEach(([name, description, category, price, stock], index) => {
      const productName = String(name);
      const productDescription = String(description);
      const productCategory = String(category);
      rows.push({
        id: seedNumber('51000000-0000-0000-0000-', sequence),
        store_id: store.id,
        name: productName,
        slug: slugify(`${productName}-${index + 1}`),
        description: productDescription,
        category: productCategory,
        price_cents: Number(price) + priceShift + index * 50_000,
        stock_qty: Number(stock) + stockShift,
        is_available: true,
        image_url: null,
        metadata: { channel: channels, seeded: true },
      });
      sequence += 1;
    });
  });

  return rows;
}

function seedProducts(stores: UmkmStore[]): UmkmProduct[] {
  const rows: Array<Omit<UmkmProduct, 'created_at' | 'updated_at'>> = [
    { id: '51000000-0000-0000-0000-000000000001', store_id: '50000000-0000-0000-0000-000000000001', name: 'Nasi Bakar Ayam Kemangi', slug: 'nasi-bakar-ayam-kemangi', description: 'Nasi bakar ayam suwir dan sambal matah.', category: 'main_course', price_cents: 3_400_000, stock_qty: 180, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
    { id: '51000000-0000-0000-0000-000000000002', store_id: '50000000-0000-0000-0000-000000000001', name: 'Soto Betawi', slug: 'soto-betawi', description: 'Soto betawi kuah santan gurih.', category: 'main_course', price_cents: 3_800_000, stock_qty: 140, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
    { id: '51000000-0000-0000-0000-000000000003', store_id: '50000000-0000-0000-0000-000000000001', name: 'Es Jeruk Peras', slug: 'es-jeruk-peras', description: 'Jeruk peras segar tanpa pemanis tambahan.', category: 'beverage', price_cents: 1_200_000, stock_qty: 250, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
    { id: '51000000-0000-0000-0000-000000000004', store_id: '50000000-0000-0000-0000-000000000002', name: 'Cappuccino House Blend', slug: 'cappuccino-house-blend', description: 'Kopi blend signature dengan foam lembut.', category: 'coffee', price_cents: 3_200_000, stock_qty: 220, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
    { id: '51000000-0000-0000-0000-000000000005', store_id: '50000000-0000-0000-0000-000000000002', name: 'Croissant Butter', slug: 'croissant-butter', description: 'Croissant butter artisan fresh bake.', category: 'pastry', price_cents: 2_600_000, stock_qty: 160, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
    { id: '51000000-0000-0000-0000-000000000006', store_id: '50000000-0000-0000-0000-000000000002', name: 'Chicken Brunch Bowl', slug: 'chicken-brunch-bowl', description: 'Bowl ayam panggang, telur, dan salad.', category: 'main_course', price_cents: 4_100_000, stock_qty: 90, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
    { id: '51000000-0000-0000-0000-000000000007', store_id: '50000000-0000-0000-0000-000000000003', name: 'Ikan Bakar Rica', slug: 'ikan-bakar-rica', description: 'Ikan bakar sambal rica khas pesisir.', category: 'main_course', price_cents: 5_600_000, stock_qty: 120, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
    { id: '51000000-0000-0000-0000-000000000008', store_id: '50000000-0000-0000-0000-000000000003', name: 'Cumi Saus Padang', slug: 'cumi-saus-padang', description: 'Cumi segar saus padang pedas manis.', category: 'main_course', price_cents: 5_200_000, stock_qty: 130, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
    { id: '51000000-0000-0000-0000-000000000009', store_id: '50000000-0000-0000-0000-000000000003', name: 'Kelapa Muda', slug: 'kelapa-muda', description: 'Air kelapa muda dingin.', category: 'beverage', price_cents: 1_500_000, stock_qty: 210, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
    { id: '51000000-0000-0000-0000-000000000010', store_id: '50000000-0000-0000-0000-000000000004', name: 'Bakpia Premium Box', slug: 'bakpia-premium-box', description: 'Bakpia campur premium isi 10 pcs.', category: 'souvenir', price_cents: 3_900_000, stock_qty: 240, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
    { id: '51000000-0000-0000-0000-000000000011', store_id: '50000000-0000-0000-0000-000000000004', name: 'Gudeg Kaleng', slug: 'gudeg-kaleng', description: 'Gudeg kaleng siap bawa untuk oleh-oleh.', category: 'souvenir', price_cents: 6_800_000, stock_qty: 100, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
    { id: '51000000-0000-0000-0000-000000000012', store_id: '50000000-0000-0000-0000-000000000005', name: 'Vegan Green Bowl', slug: 'vegan-green-bowl', description: 'Salad bowl quinoa, tempe, avocado.', category: 'healthy_food', price_cents: 4_700_000, stock_qty: 95, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
    { id: '51000000-0000-0000-0000-000000000013', store_id: '50000000-0000-0000-0000-000000000005', name: 'Cold Pressed Detox', slug: 'cold-pressed-detox', description: 'Jus detox apple-spinach-cucumber.', category: 'beverage', price_cents: 2_900_000, stock_qty: 150, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
    { id: '51000000-0000-0000-0000-000000000014', store_id: '50000000-0000-0000-0000-000000000006', name: 'Sourdough Loaf', slug: 'sourdough-loaf', description: 'Roti sourdough artisan 500gr.', category: 'bakery', price_cents: 3_300_000, stock_qty: 120, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
    { id: '51000000-0000-0000-0000-000000000015', store_id: '50000000-0000-0000-0000-000000000006', name: 'Roti Coklat Keju', slug: 'roti-coklat-keju', description: 'Roti manis coklat keju.', category: 'bakery', price_cents: 1_800_000, stock_qty: 260, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
    { id: '51000000-0000-0000-0000-000000000016', store_id: '50000000-0000-0000-0000-000000000007', name: 'Soto Medan Daging', slug: 'soto-medan-daging', description: 'Soto medan kuah santan rempah.', category: 'main_course', price_cents: 4_500_000, stock_qty: 120, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
    { id: '51000000-0000-0000-0000-000000000017', store_id: '50000000-0000-0000-0000-000000000007', name: 'Teh Tarik Dingin', slug: 'teh-tarik-dingin', description: 'Teh tarik creamy khas Melayu.', category: 'beverage', price_cents: 1_900_000, stock_qty: 180, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
    { id: '51000000-0000-0000-0000-000000000018', store_id: '50000000-0000-0000-0000-000000000007', name: 'Roti Jala Kari', slug: 'roti-jala-kari', description: 'Roti jala lembut dengan kari ayam.', category: 'main_course', price_cents: 3_600_000, stock_qty: 90, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
    { id: '51000000-0000-0000-0000-000000000019', store_id: '50000000-0000-0000-0000-000000000008', name: 'Ayam Bakar Tugu', slug: 'ayam-bakar-tugu', description: 'Ayam bakar kecap dengan sambal terasi.', category: 'main_course', price_cents: 4_800_000, stock_qty: 130, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
    { id: '51000000-0000-0000-0000-000000000020', store_id: '50000000-0000-0000-0000-000000000008', name: 'Nasi Liwet Komplit', slug: 'nasi-liwet-komplit', description: 'Nasi liwet lengkap dengan lauk kampung.', category: 'main_course', price_cents: 4_200_000, stock_qty: 110, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
    { id: '51000000-0000-0000-0000-000000000021', store_id: '50000000-0000-0000-0000-000000000008', name: 'Wedang Uwuh', slug: 'wedang-uwuh', description: 'Minuman rempah hangat khas Jawa.', category: 'beverage', price_cents: 1_700_000, stock_qty: 160, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
    { id: '51000000-0000-0000-0000-000000000022', store_id: '50000000-0000-0000-0000-000000000009', name: 'Rice Bowl Sambal Hutan', slug: 'rice-bowl-sambal-hutan', description: 'Rice bowl ayam asap sambal signature.', category: 'main_course', price_cents: 4_400_000, stock_qty: 150, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
    { id: '51000000-0000-0000-0000-000000000023', store_id: '50000000-0000-0000-0000-000000000009', name: 'Udang Bakar Kalimantan', slug: 'udang-bakar-kalimantan', description: 'Udang bakar dengan glaze manis pedas.', category: 'main_course', price_cents: 6_300_000, stock_qty: 80, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
    { id: '51000000-0000-0000-0000-000000000024', store_id: '50000000-0000-0000-0000-000000000009', name: 'Es Timun Selasih', slug: 'es-timun-selasih', description: 'Minuman segar timun, selasih, dan jeruk.', category: 'beverage', price_cents: 1_600_000, stock_qty: 170, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
    { id: '51000000-0000-0000-0000-000000000025', store_id: '50000000-0000-0000-0000-000000000010', name: 'Ayam Taliwang Bakar', slug: 'ayam-taliwang-bakar', description: 'Ayam taliwang bakar pedas manis.', category: 'main_course', price_cents: 5_200_000, stock_qty: 120, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
    { id: '51000000-0000-0000-0000-000000000026', store_id: '50000000-0000-0000-0000-000000000010', name: 'Plecing Kangkung', slug: 'plecing-kangkung', description: 'Plecing kangkung segar dengan sambal Lombok.', category: 'side_dish', price_cents: 2_200_000, stock_qty: 140, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
    { id: '51000000-0000-0000-0000-000000000027', store_id: '50000000-0000-0000-0000-000000000010', name: 'Es Kelapa Senggigi', slug: 'es-kelapa-senggigi', description: 'Kelapa muda dingin khas pesisir.', category: 'beverage', price_cents: 1_800_000, stock_qty: 180, is_available: true, image_url: null, metadata: { channel: ['online', 'offline'] } },
  ];

  return [...rows, ...buildExtraProductRows(stores)].map((row) =>
    withTime({
      ...row,
      image_url:
        row.image_url ||
        localProductImageForCategory(row.category, `${row.id}-${row.slug}`),
    }) as UmkmProduct,
  );
}

function seedTablesAndQr(stores: UmkmStore[]): Pick<RuntimeState, 'tables' | 'qrTokens'> {
  const tableRows: Array<Omit<UmkmTable, 'created_at' | 'updated_at'>> = [
    { id: '52000000-0000-0000-0000-000000000001', store_id: '50000000-0000-0000-0000-000000000001', table_code: 'T01', capacity: 2, status: 'available', metadata: {} },
    { id: '52000000-0000-0000-0000-000000000002', store_id: '50000000-0000-0000-0000-000000000001', table_code: 'T02', capacity: 4, status: 'available', metadata: {} },
    { id: '52000000-0000-0000-0000-000000000003', store_id: '50000000-0000-0000-0000-000000000001', table_code: 'T03', capacity: 4, status: 'available', metadata: {} },
    { id: '52000000-0000-0000-0000-000000000004', store_id: '50000000-0000-0000-0000-000000000002', table_code: 'A01', capacity: 2, status: 'available', metadata: {} },
    { id: '52000000-0000-0000-0000-000000000005', store_id: '50000000-0000-0000-0000-000000000002', table_code: 'A02', capacity: 2, status: 'available', metadata: {} },
    { id: '52000000-0000-0000-0000-000000000006', store_id: '50000000-0000-0000-0000-000000000002', table_code: 'A03', capacity: 4, status: 'available', metadata: {} },
    { id: '52000000-0000-0000-0000-000000000007', store_id: '50000000-0000-0000-0000-000000000003', table_code: 'S01', capacity: 4, status: 'available', metadata: {} },
    { id: '52000000-0000-0000-0000-000000000008', store_id: '50000000-0000-0000-0000-000000000003', table_code: 'S02', capacity: 6, status: 'available', metadata: {} },
    { id: '52000000-0000-0000-0000-000000000009', store_id: '50000000-0000-0000-0000-000000000006', table_code: 'R01', capacity: 2, status: 'available', metadata: {} },
    { id: '52000000-0000-0000-0000-000000000010', store_id: '50000000-0000-0000-0000-000000000006', table_code: 'R02', capacity: 4, status: 'available', metadata: {} },
    { id: '52000000-0000-0000-0000-000000000011', store_id: '50000000-0000-0000-0000-000000000007', table_code: 'M01', capacity: 4, status: 'available', metadata: {} },
    { id: '52000000-0000-0000-0000-000000000012', store_id: '50000000-0000-0000-0000-000000000007', table_code: 'M02', capacity: 4, status: 'available', metadata: {} },
    { id: '52000000-0000-0000-0000-000000000013', store_id: '50000000-0000-0000-0000-000000000008', table_code: 'G01', capacity: 4, status: 'available', metadata: {} },
    { id: '52000000-0000-0000-0000-000000000014', store_id: '50000000-0000-0000-0000-000000000008', table_code: 'G02', capacity: 6, status: 'available', metadata: {} },
    { id: '52000000-0000-0000-0000-000000000015', store_id: '50000000-0000-0000-0000-000000000009', table_code: 'B01', capacity: 2, status: 'available', metadata: {} },
    { id: '52000000-0000-0000-0000-000000000016', store_id: '50000000-0000-0000-0000-000000000009', table_code: 'B02', capacity: 4, status: 'available', metadata: {} },
    { id: '52000000-0000-0000-0000-000000000017', store_id: '50000000-0000-0000-0000-000000000010', table_code: 'L01', capacity: 4, status: 'available', metadata: {} },
    { id: '52000000-0000-0000-0000-000000000018', store_id: '50000000-0000-0000-0000-000000000010', table_code: 'L02', capacity: 6, status: 'available', metadata: {} },
  ];

  let sequence = 1001;
  stores.slice(BASE_STORE_COUNT).forEach((store, storeIndex) => {
    const metadata = asRecord(store.metadata);
    if (getUmkmSectorFromBusinessCategory(metadata.umkm_category || metadata.business_type) !== 'food') {
      return;
    }
    const tableCount = 2 + (seedHash(store.slug || store.id) % 3);
    for (let tableIndex = 0; tableIndex < tableCount; tableIndex += 1) {
      tableRows.push({
        id: seedNumber('52000000-0000-0000-0000-', sequence),
        store_id: store.id,
        table_code: `T${String(tableIndex + 1).padStart(2, '0')}`,
        capacity: tableIndex === 0 ? 2 : 4 + ((tableIndex + storeIndex) % 2) * 2,
        status: 'available',
        metadata: {},
      });
      sequence += 1;
    }
  });

  const tables = tableRows.map((row) => withTime(row) as UmkmTable);
  const qrTokens = [
    ...stores.map(
      (store) =>
        withTime({
          id: crypto.randomUUID(),
          store_id: store.id,
          table_id: null,
          mode: 'online' as const,
          token: `UMKM-ONLINE-${slugify(store.name).toUpperCase().replace(/-/g, '')}-${randomToken(4)}`,
          is_active: true,
          metadata: { label: 'Online Storefront QR' },
          expires_at: null,
          table_code: null,
        }) as UmkmQrToken,
    ),
    ...tables.map(
      (table) =>
        withTime({
          id: crypto.randomUUID(),
          store_id: table.store_id,
          table_id: table.id,
          mode: 'offline' as const,
          token: `UMKM-OFFLINE-${table.table_code}-${randomToken(4)}`,
          is_active: true,
          metadata: { label: `Table QR ${table.table_code}` },
          expires_at: null,
          table_code: table.table_code,
        }) as UmkmQrToken,
    ),
  ];

  return { tables, qrTokens };
}

function seedMembers(stores: UmkmStore[]): UmkmStoreMember[] {
  const ownerMembers = stores.map(
    (store) =>
      withTime({
        id: crypto.randomUUID(),
        store_id: store.id,
        user_id: store.owner_user_id,
        email: null,
        name: `${store.name} Owner`,
        role: 'owner' as const,
        status: 'active' as const,
        permissions: [
          'store:view',
          'store:update',
          'store:publish',
          'team:manage',
          'product:manage',
          'table:manage',
          'qr:manage',
          'order:manage',
          'reservation:manage',
          'payment:manage',
        ],
        notes: 'Auto-created owner access',
        metadata: { seeded: true, source: 'runtime-owner' },
      }) as UmkmStoreMember,
  );

  const seededStaff: UmkmStoreMember[] = [
    withTime({
      id: crypto.randomUUID(),
      store_id: '50000000-0000-0000-0000-000000000001',
      user_id: null,
      email: 'kasir.tebet@lajukan.local',
      name: 'Rina Kasir Tebet',
      role: 'cashier' as const,
      status: 'active' as const,
      permissions: ['store:view', 'order:manage', 'payment:manage'],
      notes: 'Kasir outlet pagi',
      metadata: { shift: 'morning' },
    }) as UmkmStoreMember,
    withTime({
      id: crypto.randomUUID(),
      store_id: '50000000-0000-0000-0000-000000000001',
      user_id: null,
      email: 'stok.tebet@lajukan.local',
      name: 'Bagas Stock Tebet',
      role: 'stock' as const,
      status: 'active' as const,
      permissions: ['store:view', 'product:manage'],
      notes: 'Pantau stok dan katalog',
      metadata: {},
    }) as UmkmStoreMember,
    withTime({
      id: crypto.randomUUID(),
      store_id: '50000000-0000-0000-0000-000000000002',
      user_id: null,
      email: 'ops.braga@lajukan.local',
      name: 'Naya Ops Braga',
      role: 'ops' as const,
      status: 'active' as const,
      permissions: ['store:view', 'table:manage', 'qr:manage', 'order:manage', 'reservation:manage'],
      notes: 'Koordinator dine-in dan reservasi',
      metadata: {},
    }) as UmkmStoreMember,
    withTime({
      id: crypto.randomUUID(),
      store_id: '50000000-0000-0000-0000-000000000005',
      user_id: null,
      email: 'manager.ubud@lajukan.local',
      name: 'Ayu Manager Ubud',
      role: 'manager' as const,
      status: 'active' as const,
      permissions: [
        'store:view',
        'store:update',
        'store:publish',
        'product:manage',
        'table:manage',
        'qr:manage',
        'order:manage',
        'reservation:manage',
        'payment:manage',
      ],
      notes: 'Manager outlet utama',
      metadata: {},
    }) as UmkmStoreMember,
  ];

  return [...ownerMembers, ...seededStaff];
}

function createSeededRuntimeState(): RuntimeState {
  const stores = seedStores();
  const { tables, qrTokens } = seedTablesAndQr(stores);
  return {
    stores,
    products: seedProducts(stores),
    tables,
    qrTokens,
    reservations: [],
    orders: [],
    orderItems: [],
    members: seedMembers(stores),
  };
}

let runtime: RuntimeState = createSeededRuntimeState();
const runtimeSeedSnapshot: RuntimeState = structuredClone(runtime);

export function getUmkmRuntimeState(): RuntimeState {
  return runtime;
}

export function resetUmkmRuntimeState(): void {
  runtime = structuredClone(runtimeSeedSnapshot);
}
