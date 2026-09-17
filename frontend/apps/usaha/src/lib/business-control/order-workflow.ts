import type { OrderStatus } from '@/lib/portal-types';

export type OrderFilter = 'semua' | OrderStatus;

export function nextOrderAction(status: OrderStatus): { label: string; nextStatus: OrderStatus } | null {
  if (status === 'baru') return { label: 'Terima & proses', nextStatus: 'diproses' };
  if (status === 'diproses') return { label: 'Tandai siap', nextStatus: 'siap kirim' };
  if (status === 'siap kirim') return { label: 'Selesaikan', nextStatus: 'selesai' };
  return null;
}

export function orderStatusFilter(status: OrderStatus, filter: OrderFilter) {
  return filter === 'semua' || status === filter;
}
