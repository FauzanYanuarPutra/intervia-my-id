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
export type UmkmStoreMemberRole = 'owner' | 'manager' | 'cashier' | 'stock' | 'ops' | 'finance';
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
  discount_cents: number;
  service_fee_cents: number;
  shipping_fee_cents: number;
  tax_cents: number;
  total_cents: number;
  checked_out_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type UmkmOrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type UmkmStoreMember = {
  id: string;
  store_id: string;
  user_id: string | null;
  email: string | null;
  name: string;
  role: UmkmStoreMemberRole;
  status: UmkmStoreMemberStatus;
  permissions: UmkmStorePermission[];
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type UmkmOrderSelection = {
  product_id: string;
  quantity: number;
  notes?: string | null;
};

export type UmkmOrderBundle = {
  order: UmkmOrder;
  items: UmkmOrderItem[];
  mutation?: UmkmOrderMutation;
};

export type RuntimeState = {
  stores: UmkmStore[];
  products: UmkmProduct[];
  tables: UmkmTable[];
  qrTokens: UmkmQrToken[];
  reservations: UmkmReservation[];
  orders: UmkmOrder[];
  orderItems: UmkmOrderItem[];
  members: UmkmStoreMember[];
};

export type ListUmkmStoresOptions = {
  query?: string;
  city?: string;
  slug?: string;
  ownerUserId?: string;
  activeOnly?: boolean;
  backendOnly?: boolean;
  limit?: number;
  bounds?: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  viewer?: {
    lat: number;
    lng: number;
  };
};

export type CreateUmkmStoreInput = {
  ownerUserId: string;
  name: string;
  slug?: string;
  description?: string | null;
  city: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string | null;
  onlineOrderEnabled?: boolean;
  offlineOrderEnabled?: boolean;
  metadata?: Record<string, unknown>;
};

export type ListUmkmProductsOptions = {
  storeId: string;
  channel?: UmkmChannel;
  includeUnavailable?: boolean;
  limit?: number;
};

export type CreateUmkmProductInput = {
  storeId: string;
  name: string;
  slug?: string;
  description?: string | null;
  category?: string;
  priceCents: number;
  stockQty?: number;
  isAvailable?: boolean;
  imageUrl?: string | null;
  metadata?: Record<string, unknown>;
};

export type UpsertUmkmTablesInput = {
  storeId: string;
  tables: Array<{
    table_code: string;
    capacity?: number;
    status?: UmkmTableStatus;
    metadata?: Record<string, unknown>;
  }>;
};

export type EnsureUmkmQrTokenInput = {
  storeId: string;
  mode: UmkmChannel;
  tableId?: string | null;
  forceNew?: boolean;
};

export type ResolveUmkmQrTokenResult = {
  token: UmkmQrToken;
  store: UmkmStore;
  table: UmkmTable | null;
  redirect_path: string;
};

export type CreateUmkmOrderInput = {
  storeId: string;
  channel: UmkmChannel;
  tableId?: string | null;
  tableCode?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  items: UmkmOrderSelection[];
  metadata?: Record<string, unknown>;
  mergeIntoOpenOfflineOrder?: boolean;
  paymentMethod?: UmkmPaymentMethod;
  paymentTiming?: UmkmPaymentTiming;
  fulfillmentMode?: UmkmOrderFulfillmentMode;
  shippingFeeCents?: number;
};

export type CreateUmkmReservationInput = {
  storeId: string;
  tableId?: string | null;
  tableCode?: string | null;
  customerName: string;
  customerPhone: string;
  guestCount: number;
  reservedFor: string;
  durationMinutes?: number;
  notes?: string | null;
  metadata?: Record<string, unknown>;
};

export type ListUmkmOrdersOptions = {
  storeId: string;
  status?: UmkmOrderStatus;
  paymentStatus?: UmkmPaymentStatus;
  limit?: number;
};

export type ListUmkmReservationsOptions = {
  storeId: string;
  status?: UmkmReservationStatus;
  limit?: number;
};

export type CheckoutUmkmOrderInput = {
  orderId: string;
  paymentMetadata?: Record<string, unknown>;
  paymentMethod?: UmkmPaymentMethod;
};

export type UpdateUmkmOrderStatusInput = {
  orderId: string;
  status: UmkmOrderStatus;
  metadataPatch?: Record<string, unknown>;
};

export type MoveUmkmOrderTableInput = {
  orderId: string;
  toTableId: string;
};

export type ConfirmUmkmOrderBillInput = {
  orderId: string;
  metadataPatch?: Record<string, unknown>;
};

export type UpdateUmkmReservationStatusInput = {
  reservationId: string;
  status: UmkmReservationStatus;
  metadataPatch?: Record<string, unknown>;
};

export type ListUmkmStoreMembersOptions = {
  storeId: string;
  status?: UmkmStoreMemberStatus;
  limit?: number;
};

export type CreateUmkmStoreMemberInput = {
  storeId: string;
  userId?: string | null;
  email?: string | null;
  name: string;
  role: UmkmStoreMemberRole;
  status?: UmkmStoreMemberStatus;
  notes?: string | null;
  metadata?: Record<string, unknown>;
};

export type UpdateUmkmStoreMemberInput = {
  memberId: string;
  userId?: string | null;
  email?: string | null;
  name?: string | null;
  role?: UmkmStoreMemberRole;
  status?: UmkmStoreMemberStatus;
  notes?: string | null;
  metadataPatch?: Record<string, unknown>;
};
