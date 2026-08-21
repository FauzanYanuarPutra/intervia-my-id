import { type LocalizedText } from '@/data/trustCenter';

export type EducationTopic = {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  risks: LocalizedText[];
  actions: LocalizedText[];
  safeguards: LocalizedText[];
};

export type LearnPath = {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  level: LocalizedText;
  duration: LocalizedText;
  modules: LocalizedText[];
};

export type LearnTrack = {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  cta: LocalizedText;
};

export const EDUCATION_HERO = {
  title: {
    id: 'Panduan sourcing, operasional, dan trust UMKM',
    en: 'Guides for MSME sourcing, operations, and trust',
  },
  description: {
    id: 'Belajar cari supplier yang aman, membangun storefront UMKM, mengatur fulfillment, dan menjaga transaksi tetap rapi.',
    en: 'Learn how to source safely, build an MSME storefront, run fulfillment, and keep transactions clean.',
  },
  chips: [
    { id: 'Supplier aman', en: 'Trusted suppliers' },
    { id: 'Storefront siap pakai', en: 'Ready storefronts' },
    { id: 'Fulfillment rapi', en: 'Clean fulfillment' },
    { id: 'Repeat order', en: 'Repeat orders' },
  ],
};

export const EDUCATION_TOPICS: EducationTopic[] = [
  {
    id: 'supplier-sourcing',
    title: { id: 'Supplier & Distributor', en: 'Suppliers and Distributors' },
    summary: {
      id: 'Cari vendor yang responsif, harga jelas, dan bisa diajak tumbuh bersama.',
      en: 'Find vendors that respond, price clearly, and can scale with you.',
    },
    risks: [
      { id: 'Harga partai tidak transparan.', en: 'Bulk pricing is not transparent.' },
      { id: 'Supplier lambat respon atau hilang setelah deal.', en: 'Suppliers respond slowly or disappear after a deal.' },
      { id: 'Barang contoh bagus, batch berikutnya turun kualitas.', en: 'Sample quality is good but later batches decline.' },
    ],
    actions: [
      { id: 'Mulai dari batch kecil dan catat performa supplier.', en: 'Start with smaller batches and track supplier performance.' },
      { id: 'Gunakan chat, bukti transaksi, dan ringkasan scope pesanan.', en: 'Use chat, transaction proof, and a clear order summary.' },
      { id: 'Bandingkan minimal dua vendor sebelum commit besar.', en: 'Compare at least two vendors before making a larger commitment.' },
    ],
    safeguards: [
      { id: 'Verifikasi vendor dan jejak transaksi.', en: 'Vendor verification and transaction history.' },
      { id: 'Escrow untuk deal bernilai lebih tinggi.', en: 'Escrow for higher-value deals.' },
      { id: 'Audit trail untuk bukti negosiasi dan serah terima.', en: 'Audit trails for negotiation and handoff proof.' },
    ],
  },
  {
    id: 'reseller-stock',
    title: { id: 'Stok Jualan & Reseller', en: 'Resale Stock' },
    summary: {
      id: 'Validasi produk yang mau dijual ulang sebelum terlalu cepat menambah stok.',
      en: 'Validate resale products before scaling inventory too quickly.',
    },
    risks: [
      { id: 'Produk ikut tren tapi repeat order rendah.', en: 'The product trends but repeat orders stay low.' },
      { id: 'Margin habis di ongkir, bonus, atau retur.', en: 'Margin is lost to delivery, giveaways, or returns.' },
      { id: 'Ketergantungan pada satu produk terlalu tinggi.', en: 'The business relies too heavily on one product.' },
    ],
    actions: [
      { id: 'Tes produk kecil dulu dan lihat repeat order.', en: 'Test products in small batches and watch repeat orders.' },
      { id: 'Hitung margin setelah ongkir, fee, dan promo.', en: 'Calculate margin after delivery, fees, and promos.' },
      { id: 'Simpan shortlist produk yang paling cepat muter.', en: 'Maintain a shortlist of the fastest-moving products.' },
    ],
    safeguards: [
      { id: 'Riwayat order dan feedback pembeli.', en: 'Order history and buyer feedback.' },
      { id: 'Template kalkulasi margin dan biaya operasional.', en: 'Margin and operating-cost templates.' },
      { id: 'Jalur cepat ke supplier pengganti bila stok putus.', en: 'Fast access to backup suppliers when stock breaks.' },
    ],
  },
  {
    id: 'service-freelancer',
    title: { id: 'Jasa Operasional & Freelancer', en: 'Operational Services and Freelancers' },
    summary: {
      id: 'Pakai jasa dan freelancer untuk mempercepat eksekusi, bukan menambah ribet koordinasi.',
      en: 'Use services and freelancers to accelerate execution, not add coordination overhead.',
    },
    risks: [
      { id: 'Scope kerja tidak jelas sejak awal.', en: 'The work scope is unclear from the start.' },
      { id: 'Freelancer bagus tapi tidak cocok dengan ritme UMKM.', en: 'The freelancer is good but mismatched to an MSME rhythm.' },
      { id: 'Revisi terlalu banyak karena brief lemah.', en: 'Too many revisions happen because the brief is weak.' },
    ],
    actions: [
      { id: 'Gunakan brief ringkas dengan output dan deadline jelas.', en: 'Use a concise brief with clear outputs and deadlines.' },
      { id: 'Mulai dari paket jasa atau sprint kecil.', en: 'Start with service packages or smaller sprints.' },
      { id: 'Simpan provider yang paling mudah diajak repeat.', en: 'Keep the providers that are easiest to repeat with.' },
    ],
    safeguards: [
      { id: 'Trust badge, review, dan reputasi provider.', en: 'Trust badges, reviews, and provider reputation.' },
      { id: 'Escrow dan dispute untuk kerja yang sedang berjalan.', en: 'Escrow and disputes for in-progress work.' },
      { id: 'Audit trail chat dan deliverable.', en: 'Audit trails for chat and deliverables.' },
    ],
  },
  {
    id: 'fulfillment-logistics',
    title: { id: 'Fulfillment & Pengiriman', en: 'Fulfillment and Delivery' },
    summary: {
      id: 'Order bagus tetap gagal kalau pengiriman berantakan. Fulfillment harus dianggap inti, bukan pelengkap.',
      en: 'A good sale still fails when delivery is messy. Fulfillment must be treated as core, not optional.',
    },
    risks: [
      { id: 'Alamat, penerima, atau catatan barang tidak jelas.', en: 'Address, receiver, or package notes are unclear.' },
      { id: 'Tidak ada bukti pickup atau serah terima.', en: 'There is no pickup or handoff proof.' },
      { id: 'Order terlambat tapi tim tidak cepat tahu.', en: 'Orders are delayed but the team learns too late.' },
    ],
    actions: [
      { id: 'Tuliskan detail pickup, dropoff, dan isi paket.', en: 'Write pickup, dropoff, and package details clearly.' },
      { id: 'Gunakan jalur pengiriman yang sesuai nilai order.', en: 'Choose the right delivery flow for the order value.' },
      { id: 'Pantau order aktif dan tindak lanjuti yang mulai telat.', en: 'Track active orders and follow up on delays early.' },
    ],
    safeguards: [
      { id: 'Tracking, status, dan bukti serah terima.', en: 'Tracking, status updates, and proof of delivery.' },
      { id: 'Riwayat order untuk evaluasi SLA.', en: 'Order history for SLA review.' },
      { id: 'Support escalation jika ada mismatch.', en: 'Support escalation when mismatches happen.' },
    ],
  },
  {
    id: 'umkm-growth',
    title: { id: 'Storefront & Growth UMKM', en: 'MSME Storefront and Growth' },
    summary: {
      id: 'UMKM yang tumbuh biasanya bukan yang paling viral, tapi yang paling rapi ritme bisnisnya.',
      en: 'Growing MSMEs are often not the most viral, but the ones with the cleanest business rhythm.',
    },
    risks: [
      { id: 'Profil usaha kosong atau tidak meyakinkan.', en: 'The business profile feels incomplete or weak.' },
      { id: 'Katalog tidak jelas dan sulit dipercaya.', en: 'The catalog feels unclear and hard to trust.' },
      { id: 'Tidak ada jalur repeat order dan follow-up.', en: 'There is no repeat-order or follow-up path.' },
    ],
    actions: [
      { id: 'Bangun halaman UMKM yang punya produk, jasa, dan trust signal.', en: 'Build a UMKM page with products, services, and trust signals.' },
      { id: 'Rapikan jalur order, pembayaran, dan pengiriman.', en: 'Clean up the order, payment, and delivery flow.' },
      { id: 'Ukur repeat order, channel terbaik, dan ritme restock.', en: 'Measure repeat orders, top channels, and restocking rhythm.' },
    ],
    safeguards: [
      { id: 'Storefront publik, QR, dan order log.', en: 'Public storefronts, QR, and order logs.' },
      { id: 'Verifikasi usaha dan reputasi layanan.', en: 'Business verification and service reputation.' },
      { id: 'Data transaksi untuk evaluasi pertumbuhan.', en: 'Transaction data for growth reviews.' },
    ],
  },
];

export const LEARN_PATHS: LearnPath[] = [
  {
    id: 'source-first',
    title: { id: 'Mulai dari Sourcing', en: 'Start with Sourcing' },
    summary: {
      id: 'Belajar cari supplier, distributor, dan batch awal yang paling aman.',
      en: 'Learn how to find suppliers, distributors, and the safest initial batches.',
    },
    level: { id: 'Pemula', en: 'Beginner' },
    duration: { id: '18 menit', en: '18 min' },
    modules: [
      { id: 'Cara shortlist supplier', en: 'How to shortlist suppliers' },
      { id: 'Tes batch kecil yang benar', en: 'How to test small batches correctly' },
      { id: 'Hitung margin dasar', en: 'Basic margin calculations' },
    ],
  },
  {
    id: 'ops-stack',
    title: { id: 'Stack Operasional UMKM', en: 'MSME Operations Stack' },
    summary: {
      id: 'Pahami kombinasi storefront, jasa, freelancer, dan fulfillment yang bikin kerja lebih ringan.',
      en: 'Understand the storefront, services, freelancers, and fulfillment stack that makes work lighter.',
    },
    level: { id: 'Menengah', en: 'Intermediate' },
    duration: { id: '24 menit', en: '24 min' },
    modules: [
      { id: 'Pilih jasa dan freelancer yang tepat', en: 'Choose the right services and freelancers' },
      { id: 'Bangun jalur order yang sederhana', en: 'Build a simpler order flow' },
      { id: 'Fulfillment dan repeat order', en: 'Fulfillment and repeat orders' },
    ],
  },
  {
    id: 'trust-growth',
    title: { id: 'Trust & Pertumbuhan', en: 'Trust and Growth' },
    summary: {
      id: 'Gunakan trust signal, escrow, dan data transaksi untuk tumbuh lebih stabil.',
      en: 'Use trust signals, escrow, and transaction data to grow more steadily.',
    },
    level: { id: 'Menengah', en: 'Intermediate' },
    duration: { id: '22 menit', en: '22 min' },
    modules: [
      { id: 'Trust signal yang benar-benar penting', en: 'Trust signals that actually matter' },
      { id: 'Kapan pakai escrow', en: 'When to use escrow' },
      { id: 'Review ritme bisnis mingguan', en: 'Review weekly business rhythm' },
    ],
  },
];

export const LEARN_TRACKS: LearnTrack[] = [
  {
    id: 'margin-tips',
    title: { id: 'Tips Margin Harian', en: 'Daily Margin Tips' },
    summary: {
      id: 'Tips singkat soal pricing, restock, dan channel penjualan.',
      en: 'Short tips on pricing, restocking, and sales channels.',
    },
    cta: { id: 'Buka Tips', en: 'Open Tips' },
  },
  {
    id: 'checklists',
    title: { id: 'Checklist Operasional', en: 'Operational Checklists' },
    summary: {
      id: 'Checklist praktis untuk supplier, storefront, dan fulfillment.',
      en: 'Practical checklists for suppliers, storefronts, and fulfillment.',
    },
    cta: { id: 'Lihat Checklist', en: 'View Checklists' },
  },
  {
    id: 'stories',
    title: { id: 'Cerita UMKM Bertumbuh', en: 'Growing MSME Stories' },
    summary: {
      id: 'Kisah UMKM yang rapi sourcing, operasional, dan repeat order-nya.',
      en: 'Stories of MSMEs with cleaner sourcing, operations, and repeat orders.',
    },
    cta: { id: 'Lihat Cerita', en: 'See Stories' },
  },
];
