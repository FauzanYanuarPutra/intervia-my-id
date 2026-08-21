const MAX_ATTACHMENTS = 10;
const MAX_MEDIA_URL_LENGTH = 2048;
const MAX_STRUCTURED_ATTACHMENT_LENGTH = 32 * 1024;
const MAX_DEPTH = 8;
const MAX_NODES = 320;
const MAX_OBJECT_KEYS = 96;
const MAX_ARRAY_ITEMS = 64;
const MAX_KEY_LENGTH = 96;
const MAX_STRING_LENGTH = 4096;

const MEDIA_TYPES = new Set(['image', 'video', 'audio', 'file']);
const STRUCTURED_TYPES = new Set([
  'location',
  'offer',
  'transaction',
  'application',
  'listing',
  'invite',
  'order',
  'milestone',
  'ride_update',
  'delivery_update',
  'job_update',
]);

const SAFE_MEDIA_PREFIXES = [
  '/api/chat/media/',
  '/api/content/media/',
  '/images/',
  '/uploads/chat/',
  '/uploads/content/',
] as const;

const SAFE_INTERNAL_PREFIXES = [
  '/content/',
  '/profile/',
  '/create/',
  '/id/content/',
  '/en/content/',
  '/id/profile/',
  '/en/profile/',
  '/id/create/',
  '/en/create/',
] as const;

const SAFE_INTERNAL_EXACT = new Set([
  '/transactions',
  '/id/transactions',
  '/en/transactions',
]);

const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const SAFE_MEDIA_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/;

export type ChatAttachmentPolicyOptions = {
  appOrigins?: readonly string[];
  minioPublicUrl?: string | null;
};

export type ChatAttachmentPolicyResult =
  | { ok: true; attachments: string[] }
  | { ok: false; error: 'invalid_attachments' };

type JsonRecord = Record<string, unknown>;
type SanitizeResult = { keep: true; value: unknown } | { keep: false };

function normalizeMessageType(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : 'text';
}

function attachmentList(raw: unknown): string[] | null {
  if (raw == null) return [];
  if (typeof raw === 'string') return [raw];
  if (!Array.isArray(raw) || raw.length > MAX_ATTACHMENTS) return null;
  if (!raw.every(item => typeof item === 'string')) return null;
  return raw as string[];
}

function decodePathSegment(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function pathSegments(pathname: string): string[] | null {
  const rawSegments = pathname.split('/').filter(Boolean);
  const decoded: string[] = [];
  for (const raw of rawSegments) {
    const value = decodePathSegment(raw);
    if (
      value == null ||
      !value ||
      value === '.' ||
      value === '..' ||
      value.length > 180 ||
      /[\\/\0\r\n]/.test(value)
    ) {
      return null;
    }
    decoded.push(value);
  }
  return decoded.length > 0 ? decoded : null;
}

function hasSafePathEnvelope(value: string): boolean {
  return (
    value.length <= MAX_MEDIA_URL_LENGTH &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !/[\\\0\r\n]/.test(value)
  );
}

function safeMediaShape(segments: string[]): boolean {
  if (
    segments.length === 8 &&
    segments[0] === 'api' &&
    segments[1] === 'chat' &&
    segments[2] === 'media' &&
    segments[3] === 'local' &&
    segments[4] === 'uploads' &&
    segments[5] === 'chat'
  ) {
    return segments.slice(3).every(segment => SAFE_MEDIA_SEGMENT.test(segment));
  }

  if (
    segments.length === 7 &&
    segments[0] === 'api' &&
    segments[1] === 'chat' &&
    segments[2] === 'media' &&
    segments[4] === 'chat'
  ) {
    return segments.slice(3).every(segment => SAFE_MEDIA_SEGMENT.test(segment));
  }

  if (
    segments.length === 6 &&
    segments[0] === 'api' &&
    segments[1] === 'content' &&
    segments[2] === 'media' &&
    (segments[4] === 'content' || segments[4] === 'forum')
  ) {
    return segments.slice(3).every(segment => SAFE_MEDIA_SEGMENT.test(segment));
  }

  if (
    segments.length >= 4 &&
    segments[0] === 'uploads' &&
    (segments[1] === 'chat' || segments[1] === 'content')
  ) {
    return segments.slice(1).every(segment => SAFE_MEDIA_SEGMENT.test(segment));
  }

  if (segments.length >= 2 && segments[0] === 'images') {
    return segments.slice(1).every(segment => SAFE_MEDIA_SEGMENT.test(segment));
  }

  return false;
}

function safeMediaPath(value: string): string | null {
  const trimmed = value.trim();
  if (
    !hasSafePathEnvelope(trimmed) ||
    !SAFE_MEDIA_PREFIXES.some(prefix => trimmed.startsWith(prefix))
  ) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, 'https://local.invalid');
    if (parsed.origin !== 'https://local.invalid' || parsed.search || parsed.hash) {
      return null;
    }
    const segments = pathSegments(parsed.pathname);
    return segments && safeMediaShape(segments) ? parsed.pathname : null;
  } catch {
    return null;
  }
}

function safeInternalPath(value: string): string | null {
  const trimmed = value.trim();
  if (!hasSafePathEnvelope(trimmed)) return null;

  try {
    const parsed = new URL(trimmed, 'https://local.invalid');
    if (parsed.origin !== 'https://local.invalid' || parsed.hash) return null;
    if (parsed.search.length > 513) return null;
    const segments = pathSegments(parsed.pathname);
    if (!segments) return null;
    const routeAllowed =
      SAFE_INTERNAL_EXACT.has(parsed.pathname) ||
      SAFE_INTERNAL_PREFIXES.some(prefix => parsed.pathname.startsWith(prefix));
    return routeAllowed ? `${parsed.pathname}${parsed.search}` : null;
  } catch {
    return null;
  }
}

function originOf(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function allowedOrigins(options: ChatAttachmentPolicyOptions): Set<string> {
  const values = [...(options.appOrigins ?? [])];
  if (options.minioPublicUrl) values.push(options.minioPublicUrl);
  const origins = new Set<string>();
  for (const value of values) {
    const origin = originOf(String(value || '').trim());
    if (origin) origins.add(origin);
  }
  return origins;
}

function minioProxyPath(
  absolute: URL,
  minioPublicUrl: string | null | undefined,
): string | null {
  if (!minioPublicUrl) return null;
  try {
    const base = new URL(minioPublicUrl);
    if (absolute.origin !== base.origin || absolute.search || absolute.hash) return null;
    const basePath = base.pathname.replace(/\/$/, '');
    if (
      basePath &&
      absolute.pathname !== basePath &&
      !absolute.pathname.startsWith(`${basePath}/`)
    ) {
      return null;
    }
    const relativePath = basePath
      ? absolute.pathname.slice(basePath.length)
      : absolute.pathname;
    const segments = pathSegments(relativePath);
    if (!segments || segments.length < 3) return null;
    const [bucket, root, ...rest] = segments;
    if (root === 'chat' && rest.length === 2) {
      return safeMediaPath(`/api/chat/media/${[bucket, root, ...rest].join('/')}`);
    }
    if ((root === 'content' || root === 'forum') && rest.length === 1) {
      return safeMediaPath(`/api/content/media/${[bucket, root, ...rest].join('/')}`);
    }
    return null;
  } catch {
    return null;
  }
}

function canonicalizeAbsolute(
  value: string,
  kind: 'media' | 'structured',
  options: ChatAttachmentPolicyOptions,
): string | null {
  try {
    const parsed = new URL(value);
    if (
      !['https:', 'http:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.hash ||
      !allowedOrigins(options).has(parsed.origin)
    ) {
      return null;
    }

    const media = safeMediaPath(parsed.pathname);
    if (media) return media;
    if (kind === 'structured') {
      const internal = safeInternalPath(`${parsed.pathname}${parsed.search}`);
      if (internal) return internal;
    }
    return minioProxyPath(parsed, options.minioPublicUrl);
  } catch {
    return null;
  }
}

export function safeChatMediaReference(
  value: unknown,
  options: ChatAttachmentPolicyOptions = {},
): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_MEDIA_URL_LENGTH) return null;
  return safeMediaPath(trimmed) ?? canonicalizeAbsolute(trimmed, 'media', options);
}

function safeStructuredReference(
  value: string,
  options: ChatAttachmentPolicyOptions,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return (
    safeMediaPath(trimmed) ??
    safeInternalPath(trimmed) ??
    canonicalizeAbsolute(trimmed, 'structured', options)
  );
}

function isUrlKey(key: string | null): boolean {
  if (!key) return false;
  const normalized = key.toLowerCase();
  return (
    ['url', 'uri', 'href', 'link', 'cover_image', 'image', 'avatar'].includes(
      normalized,
    ) ||
    ['_url', '_urls', '_uri', '_uris', '_href', '_link'].some(suffix =>
      normalized.endsWith(suffix),
    )
  );
}

function sanitizeJsonValue(
  value: unknown,
  parentKey: string | null,
  depth: number,
  state: { nodes: number },
  options: ChatAttachmentPolicyOptions,
): SanitizeResult | null {
  if (depth > MAX_DEPTH || state.nodes >= MAX_NODES) return null;
  state.nodes += 1;

  if (typeof value === 'string') {
    if (value.length > MAX_STRING_LENGTH || value.includes('\0')) return null;
    if (!isUrlKey(parentKey)) return { keep: true, value };
    const normalized = safeStructuredReference(value, options);
    return normalized == null ? { keep: false } : { keep: true, value: normalized };
  }

  if (value == null || typeof value === 'boolean') {
    return { keep: true, value };
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? { keep: true, value } : null;
  }

  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_ITEMS) return null;
    const sanitized: unknown[] = [];
    for (const item of value) {
      const result = sanitizeJsonValue(item, parentKey, depth + 1, state, options);
      if (!result) return null;
      if (result.keep) sanitized.push(result.value);
    }
    return { keep: true, value: sanitized };
  }

  if (typeof value === 'object') {
    const record = value as JsonRecord;
    const keys = Object.keys(record).sort();
    if (keys.length > MAX_OBJECT_KEYS) return null;
    const sanitized: JsonRecord = Object.create(null) as JsonRecord;
    for (const key of keys) {
      if (
        !key ||
        key.length > MAX_KEY_LENGTH ||
        UNSAFE_OBJECT_KEYS.has(key.toLowerCase())
      ) {
        return null;
      }
      const result = sanitizeJsonValue(
        record[key],
        key,
        depth + 1,
        state,
        options,
      );
      if (!result) return null;
      if (result.keep) sanitized[key] = result.value;
    }
    return { keep: true, value: sanitized };
  }

  return null;
}

function normalizeStructuredAttachment(
  raw: string,
  options: ChatAttachmentPolicyOptions,
): string | null {
  const value = raw.trim();
  if (!value || value.length > MAX_STRUCTURED_ATTACHMENT_LENGTH) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const result = sanitizeJsonValue(parsed, null, 0, { nodes: 0 }, options);
    if (!result?.keep || !result.value || Array.isArray(result.value)) return null;
    if (Object.keys(result.value as JsonRecord).length === 0) return null;
    const encoded = JSON.stringify(result.value);
    return encoded.length <= MAX_STRUCTURED_ATTACHMENT_LENGTH ? encoded : null;
  } catch {
    return null;
  }
}

export function normalizeChatAttachments(
  messageType: unknown,
  raw: unknown,
  options: ChatAttachmentPolicyOptions = {},
): ChatAttachmentPolicyResult {
  const type = normalizeMessageType(messageType);
  const list = attachmentList(raw);
  if (!list) return { ok: false, error: 'invalid_attachments' };

  if (type === 'sticker') {
    return list.length === 0
      ? { ok: true, attachments: [] }
      : { ok: false, error: 'invalid_attachments' };
  }

  if (MEDIA_TYPES.has(type)) {
    const attachments: string[] = [];
    for (const value of list) {
      const normalized = safeChatMediaReference(value, options);
      if (!normalized) return { ok: false, error: 'invalid_attachments' };
      attachments.push(normalized);
    }
    return { ok: true, attachments };
  }

  if (STRUCTURED_TYPES.has(type)) {
    if (list.length > 1) return { ok: false, error: 'invalid_attachments' };
    if (list.length === 0) return { ok: true, attachments: [] };
    const normalized = normalizeStructuredAttachment(list[0], options);
    return normalized
      ? { ok: true, attachments: [normalized] }
      : { ok: false, error: 'invalid_attachments' };
  }

  return list.length === 0
    ? { ok: true, attachments: [] }
    : { ok: false, error: 'invalid_attachments' };
}

export function safeStoredChatAttachments(
  messageType: unknown,
  raw: unknown,
  options: ChatAttachmentPolicyOptions = {},
): string[] {
  const result = normalizeChatAttachments(messageType, raw, options);
  return result.ok ? result.attachments : [];
}
