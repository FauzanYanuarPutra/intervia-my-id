import type {
  ListUmkmStoreMembersOptions,
  ListUmkmReservationsOptions,
  ListUmkmOrdersOptions,
  ListUmkmProductsOptions,
  ListUmkmStoresOptions,
  UmkmChannel,
  UmkmOrder,
  UmkmOrderItem,
  UmkmProduct,
  UmkmQrToken,
  UmkmReservation,
  UmkmStoreMember,
  UmkmStore,
  UmkmTable,
} from './umkm-commerce.types';
import { getUmkmRuntimeState, resetUmkmRuntimeState } from './umkm-commerce.runtime';
import { normInt, openOrder, slugify } from './umkm-commerce.utils';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function flattenSearchValue(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'number') return [String(value)];
  if (Array.isArray(value)) return value.flatMap(flattenSearchValue);
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(flattenSearchValue);
  }
  return [];
}

function tokenizeSearch(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function buildStoreSearchText(store: UmkmStore): string {
  const metadataText = flattenSearchValue(asRecord(store.metadata)).join(' ');
  return `${store.name} ${store.slug} ${store.description || ''} ${store.city} ${store.address} ${metadataText}`
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getStoreQueryScore(haystack: string, tokens: string[]): number {
  return tokens.reduce((score, token) => {
    if (!haystack.includes(token)) return score;
    if (haystack.startsWith(token)) return score + 6;
    return score + 3;
  }, 0);
}

export function resetUmkmCommerceRepository(): void {
  resetUmkmRuntimeState();
}

export function listStoreRecords(options?: ListUmkmStoresOptions): UmkmStore[] {
  const runtime = getUmkmRuntimeState();
  const query = options?.query?.trim().toLowerCase() || '';
  const queryTokens = tokenizeSearch(query);
  const city = options?.city?.trim().toLowerCase() || '';
  const slug = options?.slug?.trim().toLowerCase() || '';
  const ownerUserId = options?.ownerUserId?.trim() || '';
  const activeOnly = options?.activeOnly !== false;
  const limit = normInt(options?.limit ?? 80, 1, 500);

  return runtime.stores
    .map((store) => ({
      store,
      haystack: buildStoreSearchText(store),
    }))
    .filter(({ store }) => (activeOnly ? store.is_active : true))
    .filter(({ store }) => (slug ? store.slug === slug : true))
    .filter(({ store }) => (ownerUserId ? store.owner_user_id === ownerUserId : true))
    .filter(({ store }) => (city ? store.city.toLowerCase().includes(city) : true))
    .filter(({ haystack }) => (queryTokens.length > 0 ? queryTokens.every((token) => haystack.includes(token)) : true))
    .sort((left, right) => {
      if (queryTokens.length > 0) {
        const scoreDiff = getStoreQueryScore(right.haystack, queryTokens) - getStoreQueryScore(left.haystack, queryTokens);
        if (scoreDiff !== 0) return scoreDiff;
      }
      return right.store.updated_at.localeCompare(left.store.updated_at);
    })
    .slice(0, limit)
    .map(({ store }) => store);
}

export function findStoreRecordById(storeId: string): UmkmStore | undefined {
  return getUmkmRuntimeState().stores.find((store) => store.id === storeId);
}

export function findStoreRecordBySlug(slug: string): UmkmStore | undefined {
  const normalized = slugify(slug);
  return getUmkmRuntimeState().stores.find((store) => store.slug === normalized);
}

export function hasStoreSlug(slug: string): boolean {
  return getUmkmRuntimeState().stores.some((store) => store.slug === slug);
}

export function insertStoreRecord(store: UmkmStore): void {
  getUmkmRuntimeState().stores.unshift(store);
}

export function listProductRecords(options: ListUmkmProductsOptions): UmkmProduct[] {
  const limit = normInt(options.limit ?? 300, 1, 1000);

  return getUmkmRuntimeState().products
    .filter((product) => product.store_id === options.storeId)
    .filter((product) => (options.includeUnavailable ? true : product.is_available))
    .filter((product) => {
      if (!options.channel) return true;
      const channels = Array.isArray(product.metadata.channel) ? product.metadata.channel : null;
      if (!channels) return true;
      return channels.includes(options.channel);
    })
    .sort((left, right) =>
      left.category === right.category
        ? left.name.localeCompare(right.name)
        : left.category.localeCompare(right.category),
    )
    .slice(0, limit);
}

export function hasProductSlug(storeId: string, slug: string): boolean {
  return getUmkmRuntimeState().products.some(
    (product) => product.store_id === storeId && product.slug === slug,
  );
}

export function insertProductRecord(product: UmkmProduct): void {
  getUmkmRuntimeState().products.unshift(product);
}

export function listTableRecords(storeId: string): UmkmTable[] {
  return getUmkmRuntimeState().tables
    .filter((table) => table.store_id === storeId)
    .sort((left, right) => left.table_code.localeCompare(right.table_code));
}

export function findTableRecordById(tableId: string): UmkmTable | undefined {
  return getUmkmRuntimeState().tables.find((table) => table.id === tableId);
}

export function findTableRecordByStoreAndCode(storeId: string, tableCode: string): UmkmTable | undefined {
  const normalized = tableCode.trim().toUpperCase();
  return getUmkmRuntimeState().tables.find(
    (table) => table.store_id === storeId && table.table_code === normalized,
  );
}

export function insertTableRecord(table: UmkmTable): void {
  getUmkmRuntimeState().tables.push(table);
}

export function listQrTokenRecords(storeId: string): UmkmQrToken[] {
  return getUmkmRuntimeState().qrTokens
    .filter((qrToken) => qrToken.store_id === storeId)
    .sort((left, right) => left.token.localeCompare(right.token));
}

export function findActiveQrTokenRecord(input: {
  storeId: string;
  mode: UmkmChannel;
  tableId?: string | null;
}): UmkmQrToken | undefined {
  return getUmkmRuntimeState().qrTokens.find(
    (qrToken) =>
      qrToken.store_id === input.storeId &&
      qrToken.mode === input.mode &&
      (input.mode === 'online' ? qrToken.table_id === null : qrToken.table_id === input.tableId) &&
      qrToken.is_active,
  );
}

export function findResolvableQrTokenRecord(token: string): UmkmQrToken | undefined {
  return getUmkmRuntimeState().qrTokens.find(
    (qrToken) =>
      qrToken.token === token &&
      qrToken.is_active &&
      (!qrToken.expires_at || new Date(qrToken.expires_at).getTime() > Date.now()),
  );
}

export function insertQrTokenRecord(qrToken: UmkmQrToken): void {
  getUmkmRuntimeState().qrTokens.unshift(qrToken);
}

export function findReservationRecordById(reservationId: string): UmkmReservation | undefined {
  return getUmkmRuntimeState().reservations.find((reservation) => reservation.id === reservationId);
}

export function listReservationRecordsByStore(
  options: ListUmkmReservationsOptions,
): UmkmReservation[] {
  const limit = normInt(options.limit ?? 100, 1, 500);

  return getUmkmRuntimeState().reservations
    .filter((reservation) => reservation.store_id === options.storeId)
    .filter((reservation) => (options.status ? reservation.status === options.status : true))
    .sort((left, right) => left.reserved_for.localeCompare(right.reserved_for))
    .slice(0, limit);
}

export function insertReservationRecord(reservation: UmkmReservation): void {
  getUmkmRuntimeState().reservations.unshift(reservation);
}

export function findOrderRecordById(orderId: string): UmkmOrder | undefined {
  return getUmkmRuntimeState().orders.find((order) => order.id === orderId);
}

export function listOrderRecordsByStore(options: ListUmkmOrdersOptions): UmkmOrder[] {
  const limit = normInt(options.limit ?? 100, 1, 500);

  return getUmkmRuntimeState().orders
    .filter((order) => order.store_id === options.storeId)
    .filter((order) => (options.status ? order.status === options.status : true))
    .filter((order) => (options.paymentStatus ? order.payment_status === options.paymentStatus : true))
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, limit);
}

export function findOpenOrderRecordForTable(tableId: string): UmkmOrder | undefined {
  return getUmkmRuntimeState().orders.find(
    (order) => order.table_id === tableId && openOrder(order),
  );
}

export function hasOpenOrderForTable(tableId: string, excludeOrderId?: string): boolean {
  return getUmkmRuntimeState().orders.some(
    (order) => order.table_id === tableId && order.id !== excludeOrderId && openOrder(order),
  );
}

export function insertOrderRecord(order: UmkmOrder): void {
  getUmkmRuntimeState().orders.unshift(order);
}

export function listOrderItemRecordsByOrderId(orderId: string): UmkmOrderItem[] {
  return getUmkmRuntimeState().orderItems
    .filter((item) => item.order_id === orderId)
    .sort((left, right) => left.created_at.localeCompare(right.created_at));
}

export function insertOrderItemRecords(items: UmkmOrderItem[]): void {
  getUmkmRuntimeState().orderItems.push(...items);
}

export function listStoreMemberRecords(options: ListUmkmStoreMembersOptions): UmkmStoreMember[] {
  const limit = normInt(options.limit ?? 100, 1, 500);

  return getUmkmRuntimeState().members
    .filter((member) => member.store_id === options.storeId)
    .filter((member) => (options.status ? member.status === options.status : true))
    .sort((left, right) => left.created_at.localeCompare(right.created_at))
    .slice(0, limit);
}

export function findStoreMemberRecordById(memberId: string): UmkmStoreMember | undefined {
  return getUmkmRuntimeState().members.find((member) => member.id === memberId);
}

export function findStoreMemberRecordByActor(input: {
  storeId: string;
  userId?: string | null;
  email?: string | null;
}): UmkmStoreMember | undefined {
  const normalizedEmail = input.email?.trim().toLowerCase() || '';
  return getUmkmRuntimeState().members.find((member) => {
    if (member.store_id !== input.storeId) return false;
    if (member.status !== 'active') return false;
    if (input.userId && member.user_id && member.user_id === input.userId) return true;
    if (normalizedEmail && member.email && member.email.toLowerCase() === normalizedEmail) return true;
    return false;
  });
}

export function listStoreMemberRecordsByActor(input: {
  userId?: string | null;
  email?: string | null;
}): UmkmStoreMember[] {
  const normalizedEmail = input.email?.trim().toLowerCase() || '';
  return getUmkmRuntimeState().members.filter((member) => {
    if (member.status !== 'active') return false;
    if (input.userId && member.user_id && member.user_id === input.userId) return true;
    if (normalizedEmail && member.email && member.email.toLowerCase() === normalizedEmail) return true;
    return false;
  });
}

export function insertStoreMemberRecord(member: UmkmStoreMember): void {
  getUmkmRuntimeState().members.unshift(member);
}
