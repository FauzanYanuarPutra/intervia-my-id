import type { CrmNavItem, PageId } from './types';

export const PRIMARY_CRM_PAGES = [
  'dashboard', 'pipeline', 'users', 'businesses', 'listings', 'news', 'transactions', 'chat', 'disputes',
] as const satisfies readonly PageId[];

export const SECONDARY_CRM_PAGES = [
  'analytics', 'settings', 'guide',
] as const satisfies readonly PageId[];

export const CRM_NAV_ITEMS: readonly CrmNavItem[] = [
  { id: 'dashboard', label: 'Hari ini', hint: 'Prioritas hari ini', icon: 'dashboard' },
  { id: 'pipeline', label: 'Pipeline', hint: 'Lead dan follow-up', icon: 'pipeline' },
  { id: 'users', label: 'User', hint: 'Profil & trust', icon: 'users' },
  { id: 'businesses', label: 'Usaha', hint: 'Verifikasi & penayangan usaha', icon: 'listings' },
  { id: 'listings', label: 'Listing', hint: 'Report & moderasi', icon: 'listings' },
  { id: 'news', label: 'News', hint: 'Review & publish', icon: 'news' },
  { id: 'transactions', label: 'Transaksi', hint: 'Order & escrow', icon: 'transactions' },
  { id: 'chat', label: 'Percakapan', hint: 'Inbox prospek & support', icon: 'chat' },
  { id: 'disputes', label: 'Support & Risiko', hint: 'Support & dispute', icon: 'disputes' },
  { id: 'analytics', label: 'Analitik', hint: 'GMV & konversi', icon: 'analytics' },
  { id: 'settings', label: 'Tim & Akses', hint: 'Role & governance', icon: 'settings' },
  { id: 'guide', label: 'Panduan', hint: 'Cara kerja CRM', icon: 'guide' },
];
