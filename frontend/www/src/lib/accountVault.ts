'use client';

import {
  DEFAULT_AUTH_PHONE_COUNTRY,
  detectPhoneCountryFromValue,
  stripCountryDialCode,
  type PhoneCountryCode,
} from '@/lib/phoneCountry';
import { readProfileAvatarStyle } from '@/lib/profile/avatar';

export const MAX_SAVED_ACCOUNTS = 8;

const STORAGE_KEY = 'lajukan_saved_accounts_v1';

export type SavedAccountIdentifierType = 'phone' | 'email';

export type SavedAccount = {
  id: string;
  displayName: string;
  identifier: string;
  identifierType: SavedAccountIdentifierType;
  avatarUrl?: string | null;
  avatarStyle?: unknown;
  addedAt: number;
  lastUsedAt: number;
};

type AccountSource = Record<string, unknown> & {
  id?: unknown;
  email?: unknown;
  phone?: unknown;
  username?: unknown;
  fullName?: unknown;
  full_name?: unknown;
  avatarUrl?: unknown;
  avatar_url?: unknown;
  metadata?: unknown;
};

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readMetadataString(source: AccountSource, key: string): string | null {
  if (!source.metadata || typeof source.metadata !== 'object') return null;
  return readString((source.metadata as Record<string, unknown>)[key]);
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizePhoneIdentifier(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return value.trim();
  return `+${digits}`;
}

function isSavedAccount(value: unknown): value is SavedAccount {
  if (!value || typeof value !== 'object') return false;
  const account = value as Partial<SavedAccount>;
  return (
    typeof account.id === 'string' &&
    typeof account.displayName === 'string' &&
    typeof account.identifier === 'string' &&
    (account.identifierType === 'phone' || account.identifierType === 'email')
  );
}

function normalizeAccounts(value: unknown): SavedAccount[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();

  return value
    .filter(isSavedAccount)
    .map(account => ({
      ...account,
      addedAt: Number.isFinite(account.addedAt) ? account.addedAt : Date.now(),
      lastUsedAt: Number.isFinite(account.lastUsedAt)
        ? account.lastUsedAt
        : Date.now(),
      avatarUrl: account.avatarUrl || null,
      avatarStyle: account.avatarStyle,
    }))
    .filter(account => {
      if (seen.has(account.id)) return false;
      seen.add(account.id);
      return true;
    })
    .sort((left, right) => right.lastUsedAt - left.lastUsedAt)
    .slice(0, MAX_SAVED_ACCOUNTS);
}

function writeAccounts(accounts: SavedAccount[]): SavedAccount[] {
  const storage = getStorage();
  const normalized = normalizeAccounts(accounts);
  if (!storage) return normalized;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent('lajukan:saved-accounts'));
  } catch {
    // Browsers can block storage in private mode. Account switching still works manually.
  }

  return normalized;
}

export function readSavedAccounts(): SavedAccount[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    return normalizeAccounts(JSON.parse(storage.getItem(STORAGE_KEY) || '[]'));
  } catch {
    storage.removeItem(STORAGE_KEY);
    return [];
  }
}

export function buildSavedAccountFromUser(
  source: AccountSource | null | undefined,
): SavedAccount | null {
  if (!source) return null;

  const id = readString(source.id);
  if (!id) return null;

  const phone = readString(source.phone) || readMetadataString(source, 'phone');
  const email =
    readString(source.email)?.toLowerCase() ||
    readMetadataString(source, 'email')?.toLowerCase();
  const identifier = phone ? normalizePhoneIdentifier(phone) : email;
  if (!identifier) return null;

  const displayName =
    readString(source.fullName) ||
    readString(source.full_name) ||
    readString(source.username) ||
    (email ? email.split('@')[0] : null) ||
    identifier;
  const avatarUrl =
    readString(source.avatarUrl) ||
    readString(source.avatar_url) ||
    readMetadataString(source, 'avatar_url');
  const avatarStyle = readProfileAvatarStyle(source);
  const now = Date.now();

  return {
    id,
    displayName,
    identifier,
    identifierType: phone ? 'phone' : 'email',
    avatarUrl,
    avatarStyle,
    addedAt: now,
    lastUsedAt: now,
  };
}

export function saveAccountSnapshot(
  source: AccountSource | null | undefined,
): SavedAccount[] {
  const account = buildSavedAccountFromUser(source);
  if (!account) return readSavedAccounts();

  const existing = readSavedAccounts();
  const previous = existing.find(item => item.id === account.id);
  return writeAccounts([
    {
      ...account,
      addedAt: previous?.addedAt || account.addedAt,
      lastUsedAt: Date.now(),
    },
    ...existing.filter(item => item.id !== account.id),
  ]);
}

export function removeSavedAccount(id: string): SavedAccount[] {
  return writeAccounts(
    readSavedAccounts().filter(account => account.id !== id),
  );
}

export function clearSavedAccounts(): SavedAccount[] {
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('lajukan:saved-accounts'));
    } catch {
      // Ignore storage failures; the caller can still render an empty state.
    }
  }
  return [];
}

export function getSavedAccountById(id: string): SavedAccount | null {
  return readSavedAccounts().find(account => account.id === id) || null;
}

export function formatSavedAccountIdentifier(account: SavedAccount): string {
  if (account.identifierType === 'email') {
    const [name, domain] = account.identifier.split('@');
    if (!domain || name.length <= 2) return account.identifier;
    return `${name.slice(0, 2)}...@${domain}`;
  }

  const digits = account.identifier.replace(/\D/g, '');
  if (digits.length <= 7) return account.identifier;
  return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ... ${digits.slice(-4)}`;
}

export function getSavedAccountPhoneDraft(
  account: SavedAccount,
): { phone: string; countryCode: PhoneCountryCode } | null {
  if (account.identifierType !== 'phone') return null;

  const phoneValue = account.identifier.startsWith('+')
    ? account.identifier
    : `+${account.identifier.replace(/\D/g, '')}`;
  const countryCode =
    detectPhoneCountryFromValue(phoneValue) || DEFAULT_AUTH_PHONE_COUNTRY;

  return {
    countryCode,
    phone: stripCountryDialCode(phoneValue, countryCode),
  };
}
