import type { Metadata } from 'next';

import { buildPublicPageMetadata } from './publicPageMetadata';

export type StaticPublicPage =
  | 'about'
  | 'support'
  | 'contact'
  | 'trust'
  | 'privacy'
  | 'terms'
  | 'cookie-policy'
  | 'refund-policy';

type Copy = {
  titleId: string;
  titleEn: string;
  descriptionId: string;
  descriptionEn: string;
};

const COPY: Record<StaticPublicPage, Copy> = {
  about: {
    titleId: 'Tentang Lajukan',
    titleEn: 'About Lajukan',
    descriptionId: 'Kenali Lajukan, jaringan untuk menemukan supplier, jasa, mesin, peluang, usaha sekitar, dan kebutuhan bisnis.',
    descriptionEn: 'Meet Lajukan, a network for finding suppliers, services, equipment, opportunities, nearby businesses, and business needs.',
  },
  support: {
    titleId: 'Bantuan Lajukan',
    titleEn: 'Lajukan Support',
    descriptionId: 'Dapatkan bantuan untuk akun, login Google, listing, media, chat, komunitas, dan halaman usaha di Lajukan.',
    descriptionEn: 'Get help with your account, Google sign-in, listings, media, chat, community, and business pages on Lajukan.',
  },
  contact: {
    titleId: 'Hubungi Lajukan',
    titleEn: 'Contact Lajukan',
    descriptionId: 'Hubungi Lajukan untuk bantuan akun, listing, pencarian kebutuhan usaha, keamanan, dan dukungan layanan.',
    descriptionEn: 'Contact Lajukan for account help, listings, business discovery, safety, and service support.',
  },
  trust: {
    titleId: 'Kepercayaan & Keamanan | Lajukan',
    titleEn: 'Trust & Safety | Lajukan',
    descriptionId: 'Pelajari keamanan akun, privasi data, pembayaran, ulasan, pelaporan, dan aturan penting sebelum beraktivitas di Lajukan.',
    descriptionEn: 'Learn about account security, data privacy, payments, reviews, reporting, and important rules before using Lajukan.',
  },
  privacy: {
    titleId: 'Kebijakan Privasi | Lajukan',
    titleEn: 'Privacy Policy | Lajukan',
    descriptionId: 'Pelajari data yang digunakan Lajukan, tujuan pemrosesan, perlindungan data, serta hak akses, ekspor, dan penghapusan data.',
    descriptionEn: 'Learn what data Lajukan uses, why it is processed, how it is protected, and your access, export, and deletion rights.',
  },
  terms: {
    titleId: 'Syarat & Ketentuan | Lajukan',
    titleEn: 'Terms of Service | Lajukan',
    descriptionId: 'Baca aturan penggunaan Lajukan, hak dan kewajiban pengguna, serta ketentuan layanan dan transaksi.',
    descriptionEn: 'Read Lajukan usage rules, user rights and responsibilities, and service and transaction terms.',
  },
  'cookie-policy': {
    titleId: 'Kebijakan Cookie | Lajukan',
    titleEn: 'Cookie Policy | Lajukan',
    descriptionId: 'Pelajari jenis cookie yang digunakan Lajukan, tujuan penggunaannya, serta cara mengontrol preferensi cookie.',
    descriptionEn: 'Learn which cookies Lajukan uses, why they are used, and how to control your cookie preferences.',
  },
  'refund-policy': {
    titleId: 'Kebijakan Refund, Retur & Pembatalan | Lajukan',
    titleEn: 'Refund, Return & Cancellation Policy | Lajukan',
    descriptionId: 'Pelajari alur bantuan Lajukan untuk refund, retur produk, pembatalan, komplain layanan, dan bukti yang perlu disiapkan.',
    descriptionEn: 'Learn Lajukan support flows for refunds, product returns, cancellations, service complaints, and required evidence.',
  },
};

export function buildStaticPublicPageMetadata(page: StaticPublicPage, locale: string): Metadata {
  const copy = COPY[page];
  return buildPublicPageMetadata({
    locale,
    path: `/${page}`,
    ...copy,
  });
}
