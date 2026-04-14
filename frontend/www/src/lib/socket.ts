import { LongPoll, Socket } from 'phoenix';

function uniqueUrls(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = String(value || '').trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function normalizeSocketUrl(raw: string, forceLongPoll: boolean): string {
  const value = String(raw || '').trim();
  if (!value) return value;

  if (/^https?:\/\//i.test(value) || /^wss?:\/\//i.test(value)) {
    if (forceLongPoll) {
      return value
        .replace(/^ws:\/\//i, 'http://')
        .replace(/^wss:\/\//i, 'https://');
    }
    return value
      .replace(/^http:\/\//i, 'ws://')
      .replace(/^https:\/\//i, 'wss://');
  }

  if (value.startsWith('//')) {
    if (typeof window === 'undefined') {
      return `${forceLongPoll ? 'http:' : 'ws:'}${value}`;
    }
    const scheme = forceLongPoll
      ? window.location.protocol
      : window.location.protocol === 'https:'
        ? 'wss:'
        : 'ws:';
    return `${scheme}${value}`;
  }

  return value;
}

function shouldForceLongPoll(host: string): boolean {
  if (process.env.NEXT_PUBLIC_CHAT_FORCE_LONGPOLL === 'true') return true;
  const normalizedHost = String(host || '').trim().toLowerCase();
  return normalizedHost === 'www.lajukan.com' || normalizedHost === 'lajukan.com';
}

function resolveSocketUrls(): string[] {
  const envUrlRaw =
    process.env.NEXT_PUBLIC_CHAT_SOCKET_URL ||
    process.env.NEXT_PUBLIC_CHAT_WS_URL;

  if (typeof window !== 'undefined') {
    const isHttps = window.location.protocol === 'https:';
    const host = window.location.hostname;
    const forceLongPoll = shouldForceLongPoll(host);
    const socketProto = forceLongPoll
      ? isHttps
        ? 'https'
        : 'http'
      : isHttps
        ? 'wss'
        : 'ws';
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    const sameOriginUrl = `${socketProto}://${window.location.host}/socket`;
    const localHostCandidates = uniqueUrls([
      host,
      'localhost',
      '127.0.0.1',
    ]).map((candidate) => `${socketProto}://${candidate}:4000/socket`);
    const hostParts = host.split('.');
    const baseDomain =
      hostParts.length >= 3 && hostParts[0] === 'www'
        ? hostParts.slice(1).join('.')
        : host;
    const chatHostUrl = `${socketProto}://chat.${baseDomain}/socket`;

    if (envUrlRaw) {
      const envUrlNormalized = normalizeSocketUrl(envUrlRaw, forceLongPoll);
      const urls: string[] = [];

      if (isLocal) {
        // Local dev: try direct chat container/service first, then same-origin proxy.
        urls.push(...localHostCandidates);
        urls.push(sameOriginUrl);
      } else if (forceLongPoll) {
        // Production fallback mode: avoid broken chat subdomain/env overrides, use same-origin only.
        return uniqueUrls([sameOriginUrl]);
      } else {
        // Non-local deployments behind reverse proxy/domain.
        urls.push(sameOriginUrl);
        urls.push(chatHostUrl);
      }

      if (!forceLongPoll && isHttps && envUrlNormalized.startsWith('ws://')) {
        urls.push(envUrlNormalized.replace(/^ws:\/\//i, 'wss://'));
      }
      if (forceLongPoll && isHttps && envUrlNormalized.startsWith('http://')) {
        urls.push(envUrlNormalized.replace(/^http:\/\//i, 'https://'));
      }
      urls.push(envUrlNormalized);

      return uniqueUrls(urls);
    }

    if (isLocal) {
      return uniqueUrls([...localHostCandidates, sameOriginUrl]);
    }
    if (forceLongPoll) {
      return uniqueUrls([sameOriginUrl]);
    }

    // Prefer same-origin first (works behind Caddy/Nginx websocket proxy),
    // then dedicated chat subdomain as fallback.
    return uniqueUrls([sameOriginUrl, chatHostUrl]);
  }

  if (envUrlRaw) {
    return uniqueUrls([normalizeSocketUrl(envUrlRaw, false)]);
  }

  return ['ws://localhost:4000/socket'];
}

let socket: Socket | null = null;
let socketToken: string | undefined;
let socketUrl: string | null = null;

function isSocketConnected(s: Socket): boolean {
  if (typeof s.isConnected === 'function') {
    try {
      return s.isConnected();
    } catch {
      // Continue to fallback check.
    }
  }
  const ws = (s as unknown as { conn?: { readyState?: number } }).conn;
  return ws?.readyState === 1;
}

export function connectSocket(token?: string): Socket {
  return connectSocketWithUrl(token);
}

function connectSocketWithUrl(token?: string, preferredUrl?: string): Socket {
  const tokenChanged = token !== undefined && token !== socketToken;
  const candidates = resolveSocketUrls();
  const nextUrl =
    preferredUrl && candidates.includes(preferredUrl) ? preferredUrl : candidates[0];
  const urlChanged = socketUrl !== null && socketUrl !== nextUrl;

  if (!socket || tokenChanged || urlChanged) {
    if (socket) {
      try {
        socket.disconnect();
      } catch {
        // Ignore disconnect errors when rotating token.
      }
    }

    const useLongPoll = /^https?:\/\//i.test(nextUrl);

    socket = new Socket(nextUrl, {
      params: token ? { token } : {},
      timeout: 20000,
      heartbeatIntervalMs: 30000,
      ...(useLongPoll
        ? {
            transport: LongPoll,
            fallbackTransport: LongPoll,
            longPollFallbackMs: 0,
          }
        : {
            longPollFallbackMs: 2500,
          }),
    });
    socketToken = token;
    socketUrl = nextUrl;
  }

  if (!isSocketConnected(socket)) {
    socket.connect();
  }

  return socket;
}

export function ensureSocketConnected(token?: string): Socket {
  return connectSocket(token);
}

export async function getSocketWhenOpen(
  token?: string,
  timeoutMs = 10000
): Promise<Socket> {
  const candidates = resolveSocketUrls();
  if (candidates.length === 0) {
    throw new Error('Socket URL is not configured');
  }

  const perCandidateTimeout = Math.max(
    1500,
    Math.floor(timeoutMs / Math.max(1, candidates.length))
  );

  let lastError: Error | null = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const s = connectSocketWithUrl(token, candidate);

    if (isSocketConnected(s)) return s;

    try {
      await waitForSocketOpen(s, perCandidateTimeout);
      return s;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error('Socket connection timeout');

      // Rotate to next candidate URL.
      if (index < candidates.length - 1) {
        try {
          s.disconnect();
        } catch {
          // Ignore disconnect errors.
        }
        socket = null;
        socketUrl = null;
      }
    }
  }

  throw new Error(
    `[chat] socket open timeout (${candidates.join(' -> ')})${
      lastError ? `: ${lastError.message}` : ''
    }`
  );
}

export function createRoomChannel(room: string) {
  const s = connectSocket();
  return s.channel(`room:${room}`, {});
}

function waitForSocketOpen(s: Socket, timeoutMs: number): Promise<void> {
  if (isSocketConnected(s)) return Promise.resolve();

  const startedAt = Date.now();

  return new Promise<void>((resolve, reject) => {
    const tick = () => {
      if (isSocketConnected(s)) {
        resolve();
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error('Socket connection timeout'));
        return;
      }

      setTimeout(tick, 120);
    };

    tick();
  });
}
