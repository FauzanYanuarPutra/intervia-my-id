import 'server-only';

import { businesses as seedBusinesses, permissionMap } from '@/lib/portal-data';
import {
  buildBusinessGoogleMapsUrl,
  buildBusinessLocationQuery,
  buildPublicStorefrontUrl,
  inferBusinessCoordinates,
} from '@/lib/portal-links';
import type {
  BusinessInvite,
  BusinessRecord,
  PortalRole,
  ProductRecord,
  ProductSourceType,
  ProductStockHealth,
  ProductStockMode,
  SecurityEvent,
  TeamMember,
} from '@/lib/portal-types';

type BusinessBaseRecord = Omit<BusinessRecord, 'currentRole' | 'permissions'>;

type PortalAccountMembership = {
  businessId: string;
  role: PortalRole;
};

export type PortalAccount = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  memberships: PortalAccountMembership[];
  createdAt: string;
};

type PortalStore = {
  accounts: Map<string, PortalAccount>;
  businesses: Map<string, BusinessBaseRecord>;
};

type CreateAccountInput = {
  name: string;
  phone: string;
  email?: string;
};

type CreateBusinessInput = {
  name: string;
  category: string;
  city: string;
  address: string;
  phone: string;
  ownerName: string;
  locationQuery?: string;
  latitude?: number | null;
  longitude?: number | null;
};

type UpdateBusinessInfoInput = {
  name: string;
  category: string;
  city: string;
  address: string;
  phone: string;
  description: string;
  schedule: string;
  locationQuery?: string;
  latitude?: number | null;
  longitude?: number | null;
};

type AddProductInput = {
  name: string;
  category: string;
  priceLabel: string;
  stockLabel: string;
  sourceType?: ProductSourceType;
  ownerLabel?: string;
  stockCount?: number | null;
  stockUnit?: string;
  minStockAlert?: number | null;
  stockMode?: ProductStockMode;
  consignmentTerms?: string;
  notes?: string;
};

type UpdateOperationsInput = {
  schedule: string;
  isOpen: boolean;
};

type InviteMemberInput = {
  name: string;
  phone: string;
  role: PortalRole;
};

declare global {
  var __usahaPortalStore: PortalStore | undefined;
}

function normalizePhone(phone: string) {
  return phone.replace(/[^\d]/g, '');
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function nowLabel() {
  const now = new Date();
  return now.toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeCount(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.round(value));
}

function normalizeProductRecord(product: ProductRecord): ProductRecord {
  const sourceType = product.sourceType ?? 'owned';
  const stockMode = product.stockMode ?? 'manual';
  const stockCount = normalizeCount(product.stockCount);
  const minStockAlert = normalizeCount(product.minStockAlert);
  let stockHealth: ProductStockHealth = product.stockHealth ?? 'aman';

  if (stockCount === 0) {
    stockHealth = 'habis';
  } else if (
    stockCount !== null &&
    minStockAlert !== null &&
    stockCount <= minStockAlert
  ) {
    stockHealth = 'tipis';
  } else if (stockMode === 'estimated') {
    stockHealth = 'perlu-cocokkan';
  }

  const ownerLabel =
    sourceType === 'consignment'
      ? product.ownerLabel?.trim() || 'Mitra titip jual'
      : product.ownerLabel?.trim() || 'Stok warung';
  const stockUnit = product.stockUnit?.trim() || 'pcs';
  const stockLabel =
    product.stockLabel.trim() ||
    (stockCount === null ? 'Belum dicatat' : `Sisa ${stockCount} ${stockUnit}`);

  return {
    ...product,
    sourceType,
    ownerLabel,
    stockCount,
    stockUnit,
    minStockAlert,
    stockMode,
    stockHealth,
    stockLabel,
    stockUpdatedAt: product.stockUpdatedAt?.trim() || nowLabel(),
    consignmentTerms: product.consignmentTerms?.trim() || '',
    notes: product.notes?.trim() || '',
  };
}

function buildSeedStore(): PortalStore {
  const accounts = new Map<string, PortalAccount>();
  const businessMap = new Map<string, BusinessBaseRecord>();

  for (const business of seedBusinesses) {
    const { currentRole, permissions, ...baseBusiness } = business;
    void currentRole;
    void permissions;
    businessMap.set(business.id, syncBusinessRecord(baseBusiness));
  }

  const demoAccount: PortalAccount = {
    id: 'account-demo-owner',
    name: 'Nadia Putri',
    phone: normalizePhone('0812-1111-2222'),
    email: 'nadia@lajukan.test',
    memberships: seedBusinesses.map(business => ({
      businessId: business.id,
      role: business.currentRole,
    })),
    createdAt: nowLabel(),
  };

  accounts.set(demoAccount.id, demoAccount);

  const helperAccounts: PortalAccount[] = [
    {
      id: 'account-rian',
      name: 'Rian Saputra',
      phone: normalizePhone('0813-1111-3344'),
      memberships: [{ businessId: 'kopi-santai', role: 'manager' }],
      createdAt: nowLabel(),
    },
    {
      id: 'account-elsa',
      name: 'Elsa Puspita',
      phone: normalizePhone('0812-3311-7788'),
      memberships: [{ businessId: 'gudeg-kilat', role: 'cashier' }],
      createdAt: nowLabel(),
    },
    {
      id: 'account-arya',
      name: 'Arya Putra',
      phone: normalizePhone('0812-8899-6655'),
      memberships: [{ businessId: 'laundry-express', role: 'viewer' }],
      createdAt: nowLabel(),
    },
  ];

  for (const account of helperAccounts) {
    accounts.set(account.id, account);
  }

  return {
    accounts,
    businesses: businessMap,
  };
}

function getStore() {
  if (!globalThis.__usahaPortalStore) {
    globalThis.__usahaPortalStore = buildSeedStore();
  }

  return globalThis.__usahaPortalStore;
}

function syncBusinessRecord(record: BusinessBaseRecord): BusinessBaseRecord {
  const products = record.products.map(normalizeProductRecord);
  const coordinates = inferBusinessCoordinates({
    latitude: record.latitude,
    longitude: record.longitude,
    locationQuery: record.locationQuery,
    googleMapsUrl: record.googleMapsUrl,
  });
  const locationQuery = buildBusinessLocationQuery({
    name: record.name,
    address: record.address,
    city: record.city,
    locationQuery: record.locationQuery,
  });
  const infoComplete = Boolean(
    record.name.trim() &&
      record.category.trim() &&
      record.city.trim() &&
      record.address.trim() &&
      record.phone.trim(),
  );
  const productsCount = products.length;
  const ownedProductsCount = products.filter(product => product.sourceType !== 'consignment').length;
  const consignmentProductsCount = products.filter(
    product => product.sourceType === 'consignment',
  ).length;
  const lowStockProductsCount = products.filter(
    product => product.stockHealth === 'tipis' || product.stockHealth === 'habis',
  ).length;
  const stockCheckCount = products.filter(
    product => product.stockHealth === 'perlu-cocokkan',
  ).length;
  const activeOrders = record.orders.filter(order => order.status !== 'selesai').length;
  const reservationsCount = record.reservations.length;
  const buyerPageReady = infoComplete && productsCount > 0;

  return {
    ...record,
    products,
    latitude: coordinates?.lat ?? null,
    longitude: coordinates?.lng ?? null,
    locationQuery,
    googleMapsUrl:
      buildBusinessGoogleMapsUrl({
        name: record.name,
        address: record.address,
        city: record.city,
        locationQuery,
        latitude: coordinates?.lat ?? null,
        longitude: coordinates?.lng ?? null,
      }) || record.googleMapsUrl,
    infoComplete,
    productsCount,
    ownedProductsCount,
    consignmentProductsCount,
    lowStockProductsCount,
    stockCheckCount,
    activeOrders,
    reservationsCount,
    buyerPageReady,
  };
}

function buildBusinessView(
  business: BusinessBaseRecord,
  role: PortalRole,
): BusinessRecord {
  const syncedBusiness = syncBusinessRecord(business);
  return {
    ...syncedBusiness,
    currentRole: role,
    permissions: permissionMap[role],
  };
}

function getMembershipRole(account: PortalAccount, businessId: string) {
  return account.memberships.find(item => item.businessId === businessId)?.role ?? null;
}

function ensureBusinessPermission(accountId: string, businessId: string, roleCheck: PortalRole[]) {
  const account = getAccountById(accountId);
  if (!account) {
    throw new Error('Akun tidak ditemukan.');
  }

  const role = getMembershipRole(account, businessId);
  if (!role || !roleCheck.includes(role)) {
    throw new Error('Akses tidak diizinkan.');
  }

  return role;
}

function appendSecurityEvent(
  business: BusinessBaseRecord,
  title: string,
  description: string,
) {
  const nextEvent: SecurityEvent = {
    id: `event-${Date.now()}`,
    title,
    description,
    time: nowLabel(),
  };

  business.securityEvents = [nextEvent, ...business.securityEvents].slice(0, 10);
}

function ensureUniqueBusinessId(name: string) {
  const store = getStore();
  const baseSlug = slugify(name) || 'usaha-baru';
  let candidate = baseSlug;
  let counter = 2;

  while (store.businesses.has(candidate)) {
    candidate = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function createOwnerMember(ownerName: string, phone: string): TeamMember {
  return {
    id: `member-${Date.now()}`,
    name: ownerName.trim(),
    phone: phone.trim(),
    role: 'owner',
    status: 'active',
    area: 'Pemilik usaha',
    lastSeen: 'Baru saja aktif',
  };
}

export function listSeedBusinesses() {
  return seedBusinesses;
}

export function getSeedBusinessById(id: string) {
  return seedBusinesses.find(business => business.id === id) ?? null;
}

export function listPublicBusinesses() {
  return Array.from(getStore().businesses.values()).reverse().map(syncBusinessRecord);
}

export function listAccounts() {
  return Array.from(getStore().accounts.values());
}

export function findAccountByPhone(phone: string) {
  const normalizedPhone = normalizePhone(phone);
  return (
    Array.from(getStore().accounts.values()).find(
      account => account.phone === normalizedPhone,
    ) ?? null
  );
}

export function getAccountById(id: string) {
  return getStore().accounts.get(id) ?? null;
}

export function createOrUpdateAccount(input: CreateAccountInput) {
  const store = getStore();
  const normalizedPhone = normalizePhone(input.phone);
  const existingAccount = findAccountByPhone(normalizedPhone);

  if (existingAccount) {
    existingAccount.name = input.name.trim() || existingAccount.name;
    existingAccount.email = input.email?.trim() || existingAccount.email;
    store.accounts.set(existingAccount.id, existingAccount);
    return existingAccount;
  }

  const account: PortalAccount = {
    id: `account-${Date.now()}`,
    name: input.name.trim(),
    phone: normalizedPhone,
    email: input.email?.trim(),
    memberships: [],
    createdAt: nowLabel(),
  };

  store.accounts.set(account.id, account);
  return account;
}

export function listBusinessesForAccount(accountId: string) {
  const account = getAccountById(accountId);
  if (!account) {
    return [];
  }

  const store = getStore();
  return account.memberships
    .map(membership => {
      const business = store.businesses.get(membership.businessId);
      if (!business) {
        return null;
      }

      return buildBusinessView(business, membership.role);
    })
    .filter(Boolean) as BusinessRecord[];
}

export function getBusinessForAccount(accountId: string, businessId: string) {
  return (
    listBusinessesForAccount(accountId).find(business => business.id === businessId) ?? null
  );
}

export function createBusinessForAccount(accountId: string, input: CreateBusinessInput) {
  const store = getStore();
  const account = getAccountById(accountId);

  if (!account) {
    throw new Error('Akun tidak ditemukan.');
  }

  if (input.name.trim().length < 2) {
    throw new Error('Nama usaha belum valid.');
  }

  if (input.city.trim().length < 2) {
    throw new Error('Kota usaha belum valid.');
  }

  if (normalizePhone(input.phone).length < 9) {
    throw new Error('Nomor usaha belum valid.');
  }

  const nextId = ensureUniqueBusinessId(input.name);
  const coordinates = inferBusinessCoordinates({
    latitude: input.latitude,
    longitude: input.longitude,
    locationQuery: input.locationQuery,
  });
  const nextBusiness: BusinessBaseRecord = syncBusinessRecord({
    id: nextId,
    slug: nextId,
    name: input.name.trim(),
    city: input.city.trim(),
    address: input.address.trim(),
    latitude: coordinates?.lat ?? null,
    longitude: coordinates?.lng ?? null,
    locationQuery:
      buildBusinessLocationQuery({
        name: input.name,
        address: input.address,
        city: input.city,
        locationQuery: input.locationQuery,
      }) || `${input.name.trim()}, ${input.city.trim()}`,
    googleMapsUrl: buildBusinessGoogleMapsUrl({
      name: input.name,
      address: input.address,
      city: input.city,
      locationQuery: input.locationQuery,
      latitude: coordinates?.lat ?? null,
      longitude: coordinates?.lng ?? null,
    }),
    category: input.category.trim(),
    phone: input.phone.trim(),
    description: `${input.category.trim()} di ${input.city.trim()}`,
    schedule: '08.00 - 20.00',
    infoComplete: true,
    productsCount: 0,
    isOpen: false,
    buyerPageReady: false,
    activeOrders: 0,
    reservationsCount: 0,
    teamMembers: [createOwnerMember(input.ownerName, input.phone)],
    invites: [],
    products: [],
    orders: [],
    reservations: [],
    publicUrl: buildPublicStorefrontUrl(nextId),
    securityEvents: [
      {
        id: `event-create-${Date.now()}`,
        title: 'Usaha dibuat',
        description: `${input.name.trim()} baru saja dibuat dan siap dilengkapi.`,
        time: nowLabel(),
      },
    ],
  });

  account.memberships.unshift({
    businessId: nextBusiness.id,
    role: 'owner',
  });

  store.accounts.set(account.id, account);
  store.businesses.set(nextBusiness.id, nextBusiness);

  return buildBusinessView(nextBusiness, 'owner');
}

export function updateBusinessInfo(
  accountId: string,
  businessId: string,
  input: UpdateBusinessInfoInput,
) {
  ensureBusinessPermission(accountId, businessId, ['owner', 'manager']);
  const store = getStore();
  const business = store.businesses.get(businessId);

  if (!business) {
    throw new Error('Usaha tidak ditemukan.');
  }

  if (input.name.trim().length < 2) {
    throw new Error('Nama usaha belum valid.');
  }

  if (input.city.trim().length < 2) {
    throw new Error('Kota usaha belum valid.');
  }

  if (normalizePhone(input.phone).length < 9) {
    throw new Error('Nomor usaha belum valid.');
  }

  if (input.schedule.trim().length < 5) {
    throw new Error('Jam buka belum valid.');
  }

  business.name = input.name.trim();
  business.category = input.category.trim();
  business.city = input.city.trim();
  business.address = input.address.trim();
  const coordinates = inferBusinessCoordinates({
    latitude: input.latitude,
    longitude: input.longitude,
    locationQuery: input.locationQuery,
    googleMapsUrl: business.googleMapsUrl,
  });
  business.latitude = coordinates?.lat ?? null;
  business.longitude = coordinates?.lng ?? null;
  business.locationQuery =
    buildBusinessLocationQuery({
      name: input.name,
      address: input.address,
      city: input.city,
      locationQuery: input.locationQuery,
    }) || business.locationQuery;
  business.googleMapsUrl = buildBusinessGoogleMapsUrl({
    name: input.name,
    address: input.address,
    city: input.city,
    locationQuery: input.locationQuery,
    latitude: coordinates?.lat ?? null,
    longitude: coordinates?.lng ?? null,
  });
  business.phone = input.phone.trim();
  business.description =
    input.description.trim() || `${input.category.trim()} di ${input.city.trim()}`;
  business.schedule = input.schedule.trim();
  appendSecurityEvent(
    business,
    'Info usaha diperbarui',
    `Perubahan profil usaha dilakukan pada ${business.name}.`,
  );

  store.businesses.set(businessId, syncBusinessRecord(business));
  return getBusinessForAccount(accountId, businessId);
}

export function addProductToBusiness(
  accountId: string,
  businessId: string,
  input: AddProductInput,
) {
  ensureBusinessPermission(accountId, businessId, ['owner', 'manager']);
  const store = getStore();
  const business = store.businesses.get(businessId);

  if (!business) {
    throw new Error('Usaha tidak ditemukan.');
  }

  if (input.name.trim().length < 2) {
    throw new Error('Nama produk belum valid.');
  }

  if (input.priceLabel.trim().length < 2) {
    throw new Error('Harga produk belum valid.');
  }

  if (input.stockLabel.trim().length < 2) {
    throw new Error('Stok produk belum valid.');
  }

  const nextProduct: ProductRecord = {
    id: `product-${Date.now()}`,
    name: input.name.trim(),
    category: input.category.trim(),
    priceLabel: input.priceLabel.trim(),
    stockLabel: input.stockLabel.trim(),
    status: 'live',
    sourceType: input.sourceType ?? 'owned',
    ownerLabel: input.ownerLabel?.trim() || '',
    stockCount: normalizeCount(input.stockCount),
    stockUnit: input.stockUnit?.trim() || 'pcs',
    minStockAlert: normalizeCount(input.minStockAlert),
    stockMode: input.stockMode ?? 'manual',
    stockHealth: input.stockMode === 'estimated' ? 'perlu-cocokkan' : 'aman',
    stockUpdatedAt: nowLabel(),
    consignmentTerms: input.consignmentTerms?.trim() || '',
    notes: input.notes?.trim() || '',
  };

  business.products.unshift(normalizeProductRecord(nextProduct));
  appendSecurityEvent(
    business,
    'Produk ditambahkan',
    `${nextProduct.name} ditambahkan ke katalog usaha.`,
  );

  store.businesses.set(businessId, syncBusinessRecord(business));
  return getBusinessForAccount(accountId, businessId);
}

export function updateBusinessOperations(
  accountId: string,
  businessId: string,
  input: UpdateOperationsInput,
) {
  ensureBusinessPermission(accountId, businessId, ['owner', 'manager']);
  const store = getStore();
  const business = store.businesses.get(businessId);

  if (!business) {
    throw new Error('Usaha tidak ditemukan.');
  }

  if (input.schedule.trim().length < 5) {
    throw new Error('Jam buka belum valid.');
  }

  business.schedule = input.schedule.trim();
  business.isOpen = input.isOpen;
  appendSecurityEvent(
    business,
    input.isOpen ? 'Usaha dibuka' : 'Usaha ditutup',
    `${business.name} sekarang ${input.isOpen ? 'sedang buka' : 'belum buka'}.`,
  );

  store.businesses.set(businessId, syncBusinessRecord(business));
  return getBusinessForAccount(accountId, businessId);
}

export function inviteBusinessMember(
  accountId: string,
  businessId: string,
  input: InviteMemberInput,
) {
  ensureBusinessPermission(accountId, businessId, ['owner', 'manager']);
  const store = getStore();
  const business = store.businesses.get(businessId);

  if (!business) {
    throw new Error('Usaha tidak ditemukan.');
  }

  if (input.name.trim().length < 2) {
    throw new Error('Nama anggota belum valid.');
  }

  if (normalizePhone(input.phone).length < 9) {
    throw new Error('Nomor HP anggota belum valid.');
  }

  const invite: BusinessInvite = {
    id: `invite-${Date.now()}`,
    name: input.name.trim(),
    phone: input.phone.trim(),
    role: input.role,
    status: 'pending',
    sentAt: nowLabel(),
  };

  business.invites.unshift(invite);
  appendSecurityEvent(
    business,
    'Undangan anggota dikirim',
    `${invite.name} diundang sebagai ${invite.role}.`,
  );

  store.businesses.set(businessId, syncBusinessRecord(business));
  return getBusinessForAccount(accountId, businessId);
}
