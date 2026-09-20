import type { CrmNavItem, PageId } from './types';

export const PRIMARY_CRM_PAGES = [
  'dashboard', 'pipeline', 'users', 'businesses', 'listings', 'news', 'transactions', 'chat', 'disputes',
] as const satisfies readonly PageId[];

export const SECONDARY_CRM_PAGES = [
  'analytics', 'settings', 'guide',
] as const satisfies readonly PageId[];

export const CRM_NAV_ITEMS: readonly CrmNavItem[] = [
  { id: 'dashboard', label: 'Hari ini', hint: 'Prioritas operasional', icon: 'dashboard' },
  { id: 'pipeline', label: 'Pipeline', hint: 'Lead dan follow-up', icon: 'pipeline' },
  { id: 'users', label: 'Kontak & User', hint: 'Profil, KYC, dan trust', icon: 'users' },
  { id: 'businesses', label: 'Usaha', hint: 'Verifikasi & penayangan usaha', icon: 'listings' },
  { id: 'listings', label: 'Moderasi Listing', hint: 'Report dan listing nakal', icon: 'listings' },
  { id: 'news', label: 'News Editorial', hint: 'Approve & publish berita', icon: 'news' },
  { id: 'transactions', label: 'Transactions', hint: 'Escrow dan order', icon: 'transactions' },
  { id: 'chat', label: 'Percakapan', hint: 'Inbox prospek & support', icon: 'chat' },
  { id: 'disputes', label: 'Support & Risiko', hint: 'Tiket, dispute, dan risiko', icon: 'disputes' },
  { id: 'analytics', label: 'Analytics', hint: 'GMV dan konversi', icon: 'analytics' },
  { id: 'settings', label: 'Administrasi', hint: 'Role, akses & governance', icon: 'settings' },
  { id: 'guide', label: 'Panduan CRM', hint: 'Apa ini, flow & dampaknya', icon: 'guide' },
];
