export type PortalRole = 'owner' | 'manager' | 'cashier' | 'viewer';

export type PermissionId =
  | 'viewInfo'
  | 'manageInfo'
  | 'viewProducts'
  | 'manageProducts'
  | 'viewCosting'
  | 'manageCosting'
  | 'viewInventory'
  | 'manageInventory'
  | 'viewOrders'
  | 'manageOrders'
  | 'viewFinance'
  | 'manageFinance'
  | 'viewChannels'
  | 'manageChannels'
  | 'viewReports'
  | 'viewOperations'
  | 'manageOperations'
  | 'viewTeam'
  | 'inviteMembers'
  | 'manageRoles'
  | 'viewBuyerPage'
  | 'openBusiness'
  | 'manageSecurity';

export type PortalSection =
  | 'home'
  | 'info'
  | 'locations'
  | 'products'
  | 'inventory'
  | 'orders'
  | 'finance'
  | 'channels'
  | 'reports'
  | 'operations'
  | 'team'
  | 'buyerPage'
  | 'security';

export type BusinessLocationType = 'physical' | 'service_area' | 'online';

export type BusinessLocation = {
  id: string;
  name: string;
  locationType: BusinessLocationType | string;
  address: string;
  city: string;
  province: string;
  district: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  whatsapp: string;
  timezone: string;
  businessHours: Record<string, unknown>;
  status: string;
  isPrimary: boolean;
  publicVisibility: boolean;
};

export type ProductStatus = 'live' | 'draft';
export type ProductSourceType = 'owned' | 'consignment';
export type ProductStockMode = 'manual' | 'estimated';
export type ProductStockHealth = 'aman' | 'tipis' | 'habis' | 'perlu-cocokkan';
export type OrderStatus = 'baru' | 'diproses' | 'siap kirim' | 'selesai';
export type InviteStatus = 'pending' | 'accepted' | 'declined';
export type MemberStatus = 'active' | 'inactive';
export type ReservationStatus = 'menunggu' | 'terkonfirmasi' | 'selesai';

export type RoleSummary = { label: string; shortLabel: string; description: string; can: string[]; cannot: string[] };
export type SecurityEvent = { id: string; title: string; description: string; time: string };
export type TeamMember = { id: string; name: string; phone: string; role: PortalRole; status: MemberStatus; area: string; lastSeen: string };
export type BusinessInvite = { id: string; name: string; phone: string; role: PortalRole; status: InviteStatus; sentAt: string };
export type ProductRecord = {
  id: string; name: string; priceLabel: string; stockLabel: string; category: string; status: ProductStatus;
  sourceType?: ProductSourceType; ownerLabel?: string; stockCount?: number | null; stockUnit?: string;
  minStockAlert?: number | null; stockMode?: ProductStockMode; stockHealth?: ProductStockHealth;
  stockUpdatedAt?: string; consignmentTerms?: string; lastSoldAt?: string; notes?: string;
};
export type OrderRecord = { id: string; buyer: string; itemSummary: string; amountLabel: string; status: OrderStatus; channel: string };
export type ReservationRecord = { id: string; guest: string; schedule: string; pax: string; status: ReservationStatus };
export type ProgressStep = { id: string; label: string; hint: string; done: boolean };

export type BusinessRecord = {
  id: string;
  version?: number;
  capabilityKey?: string;
  slug: string;
  name: string;
  /** Additive during migration so old local fixtures remain type-compatible. */
  organizationId?: string | null;
  currentRole: PortalRole;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  locationQuery: string;
  googleMapsUrl: string;
  category: string;
  phone: string;
  description: string;
  schedule: string;
  infoComplete: boolean;
  productsCount: number;
  ownedProductsCount?: number;
  consignmentProductsCount?: number;
  lowStockProductsCount?: number;
  stockCheckCount?: number;
  isOpen: boolean;
  buyerPageReady: boolean;
  activeOrders: number;
  reservationsCount: number;
  teamMembers: TeamMember[];
  invites: BusinessInvite[];
  products: ProductRecord[];
  orders: OrderRecord[];
  reservations: ReservationRecord[];
  /** Real backend records always provide this; optional only for legacy fixtures. */
  locations?: BusinessLocation[];
  permissions: PermissionId[];
  publicUrl: string;
  securityEvents: SecurityEvent[];
};
