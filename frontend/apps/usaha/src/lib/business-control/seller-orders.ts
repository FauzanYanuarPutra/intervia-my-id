export type SellerOrderStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'IN_SERVICE'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'REFUNDED';

export type SellerOrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  item_name: string;
  quantity: string | number;
  unit_price: string | number;
  line_total: string | number;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type SellerOrderRecord = {
  id: string;
  order_number: string;
  user_id: string;
  business_id: string;
  category_type: string;
  base_status: SellerOrderStatus;
  payment_status: string;
  currency: string;
  subtotal_amount: string | number;
  total_amount: string | number;
  category_specific_metadata: Record<string, unknown>;
  source_type: string | null;
  source_surface: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export type SellerOrderAggregate = {
  order: SellerOrderRecord;
  items: SellerOrderItem[];
  allowed_next_statuses: SellerOrderStatus[];
  last_transition_reason: string | null;
  last_transition_at: string | null;
};

export type SellerOrderFilter = 'semua' | 'perlu-aksi' | SellerOrderStatus;

export const sellerOrderStatusLabel: Record<SellerOrderStatus, string> = {
  DRAFT: 'Draft',
  PENDING_PAYMENT: 'Menunggu bayar',
  PAID: 'Baru',
  PROCESSING: 'Diproses',
  SHIPPED: 'Dikirim',
  IN_SERVICE: 'Dikerjakan',
  DELIVERED: 'Terkirim',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
  REJECTED: 'Ditolak',
  EXPIRED: 'Kedaluwarsa',
  REFUNDED: 'Refund',
};

export function sellerOrderActionLabel(status: SellerOrderStatus) {
  if (status === 'PAID') return 'Konfirmasi pembayaran';
  if (status === 'REJECTED') return 'Tolak pesanan';
  if (status === 'PROCESSING') return 'Terima & proses';
  if (status === 'SHIPPED') return 'Tandai dikirim';
  if (status === 'IN_SERVICE') return 'Mulai dikerjakan';
  if (status === 'DELIVERED') return 'Tandai diterima';
  if (status === 'COMPLETED') return 'Tutup pesanan';
  if (status === 'CANCELLED') return 'Batalkan';
  return sellerOrderStatusLabel[status];
}

export function sellerOrderMatchesFilter(
  order: SellerOrderAggregate,
  filter: SellerOrderFilter,
) {
  if (filter === 'semua') return true;
  if (filter === 'perlu-aksi') return order.allowed_next_statuses.length > 0;
  return order.order.base_status === filter;
}

export function sellerOrderItemSummary(order: SellerOrderAggregate) {
  return order.items
    .map(item => `${item.item_name} × ${Number(item.quantity).toLocaleString('id-ID')}`)
    .join(', ');
}

export function sellerOrderBuyerLabel(order: SellerOrderAggregate) {
  const suffix = order.order.user_id.replaceAll('-', '').slice(0, 8).toUpperCase();
  return `Pembeli · ${suffix}`;
}
