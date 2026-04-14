import crypto from 'node:crypto';
import type {
  UmkmOrder,
  UmkmOrderItem,
  UmkmProduct,
  UmkmQrToken,
  UmkmReservation,
  UmkmStoreMember,
  UmkmStore,
  UmkmTable,
} from './umkm-commerce.types';

export const nowIso = () => new Date().toISOString();

export const normText = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

export const normInt = (value: unknown, min = 0, max = 1_000_000) =>
  Math.max(min, Math.min(max, Math.round(typeof value === 'number' ? value : Number(value) || 0)));

export const normMoney = (value: unknown) =>
  Math.max(0, Math.round(typeof value === 'number' ? value : Number(value) || 0));

export const normJson = (value: unknown) =>
  typeof value === 'object' && value && !Array.isArray(value)
    ? ({ ...(value as Record<string, unknown>) })
    : {};

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function randomToken(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let output = '';
  for (let index = 0; index < length; index += 1) {
    output += chars[crypto.randomInt(0, chars.length)];
  }
  return output;
}

export function openOrder(order: UmkmOrder): boolean {
  return ['pending', 'preparing', 'served'].includes(order.status);
}

export function withTime<T extends Record<string, unknown>>(
  row: T,
): T & { created_at: string; updated_at: string } {
  const timestamp = nowIso();
  return {
    ...row,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export function cloneStore(store: UmkmStore): UmkmStore {
  return { ...store, metadata: normJson(store.metadata) };
}

export function cloneProduct(product: UmkmProduct): UmkmProduct {
  return { ...product, metadata: normJson(product.metadata) };
}

export function cloneTable(table: UmkmTable): UmkmTable {
  return { ...table, metadata: normJson(table.metadata) };
}

export function cloneQrToken(qrToken: UmkmQrToken): UmkmQrToken {
  return { ...qrToken, metadata: normJson(qrToken.metadata) };
}

export function cloneReservation(reservation: UmkmReservation): UmkmReservation {
  return { ...reservation, metadata: normJson(reservation.metadata) };
}

export function cloneOrder(order: UmkmOrder): UmkmOrder {
  return { ...order, metadata: normJson(order.metadata) };
}

export function cloneOrderItem(item: UmkmOrderItem): UmkmOrderItem {
  return { ...item, metadata: normJson(item.metadata) };
}

export function cloneStoreMember(member: UmkmStoreMember): UmkmStoreMember {
  return {
    ...member,
    permissions: Array.isArray(member.permissions) ? [...member.permissions] : [],
    metadata: normJson(member.metadata),
  };
}
