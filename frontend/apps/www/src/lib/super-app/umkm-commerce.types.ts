export type UmkmChannel = 'online' | 'offline';
export type UmkmPublishService = 'food' | 'mart';
export type UmkmOrderStatus = 'pending' | 'preparing' | 'served' | 'paid' | 'cancelled';
export type UmkmPaymentStatus = 'unpaid' | 'paid' | 'refunded';
export type UmkmPaymentMethod = 'wallet' | 'bank_transfer' | 'cash';
export type UmkmPaymentStage = 'awaiting_confirmation' | 'awaiting_prepayment' | 'paid';
export type UmkmPaymentTiming = 'prepay' | 'postpay';
export type UmkmTableStatus = 'available' | 'occupied' | 'disabled';
export type UmkmOrderMutation = 'created' | 'merged' | 'updated';
export type UmkmReservationStatus = 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled';
export type UmkmProductKind = 'physical' | 'digital';
export type UmkmOrderFulfillmentMode = 'courier' | 'pickup' | 'digital' | 'dine_in';
export type UmkmStoreMemberRole = 'owner' | 'manager' | 'cashier' | 'viewer' | 'stock' | 'ops' | 'finance';
export type UmkmStoreMemberStatus = 'active' | 'invited' | 'disabled';
export type UmkmStorePermission =
  | 'store:view'
  | 'store:update'
  | 'store:publish'
  | 'team:manage'
  | 'product:manage'
  | 'table:manage'
  | 'qr:manage'
  | 'order:manage'
  | 'reservation:manage'
  | 'payment:manage';

export type UmkmStore = {
  id: string;
  owner_user_id: string;
  organization_id?: string | null;
  name: string;
  slug: string;
  description: string | null;
  city: string;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  is_active: boolean;
  online_order_enabled: boolean;
  offline_order_enabled: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type UmkmProduct = {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  price_cents: number;
  stock_qty: number;
  is_available: boolean;
  image_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type UmkmTable = {
  id: string;
  store_id: string;
  table_code: string;
  capacity: number;
  status: UmkmTableStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type UmkmQrToken = {
  id: string;
  store_id: string;
  table_id: string | null;
  mode: UmkmChannel;
  token: string;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  table_code: string | null;
};

export type UmkmReservation = {
  id: string;
  reservation_code: string;
  store_id: string;
  table_id: string | null;
  table_code: string | null;
  status: UmkmReservationStatus;
  customer_name: string;
  customer_phone: string;
  guest_count: number;
  reserved_for: string;
  duration_minutes: number;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type UmkmOrder = {
  id: string;
  store_id: string;
  channel: UmkmChannel;
  table_id: string | null;
  table_code: string | null;
  status: UmkmOrderStatus;
  payment_status: UmkmPaymentStatus;
  payment_method: UmkmPaymentMethod;
  payment_stage: UmkmPaymentStage;
  fulfillment_mode: UmkmOrderFulfillmentMode;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  subtotal_cents: number;
  total_cents: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
