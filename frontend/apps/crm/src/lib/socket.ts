import { Socket } from 'phoenix';

function resolveSocketUrl(): string {
  const envUrl =
    process.env.NEXT_PUBLIC_CHAT_SOCKET_URL ||
    process.env.NEXT_PUBLIC_CHAT_WS_URL;
  if (envUrl) {
    if (typeof window === 'undefined') return envUrl;

    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    const isHttps = window.location.protocol === 'https:';

    if (!isLocal && envUrl.includes('localhost')) {
      const wsProto = isHttps ? 'wss' : 'ws';
      return `${wsProto}://${window.location.host}/socket`;
    }

    if (isHttps && envUrl.startsWith('ws://')) {
      return envUrl.replace(/^ws:\/\//, 'wss://');
    }

    return envUrl;
  }

  if (typeof window !== 'undefined') {
    const isHttps = window.location.protocol === 'https:';
    const wsProto = isHttps ? 'wss' : 'ws';
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';

    if (isLocal) {
      return `${wsProto}://${host}:4000/socket`;
    }

    return `${wsProto}://${window.location.host}/socket`;
  }

  return 'ws://localhost:4000/socket';
}

let socket: Socket | null = null;
let socketToken: string | undefined;
let socketUrl: string | null = null;

function isSocketConnected(s: Socket): boolean {
  const ws = (s as unknown as { conn?: { readyState?: number } }).conn;
  return ws?.readyState === 1;
}

export function connectSocket(token?: string): Socket {
  const tokenChanged = token !== undefined && token !== socketToken;
  const nextUrl = resolveSocketUrl();
  const urlChanged = socketUrl !== null && socketUrl !== nextUrl;

  if (!socket || tokenChanged || urlChanged) {
    if (socket) {
      try {
        socket.disconnect();
      } catch {
        // Ignore disconnect errors when rotating token.
      }
    }

    socket = new Socket(nextUrl, {
      params: token ? { token } : {},
      timeout: 20000,
      heartbeatIntervalMs: 30000,
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
  timeoutMs = 10000,
): Promise<Socket> {
  const s = connectSocket(token);
  if (isSocketConnected(s)) return s;

  const startedAt = Date.now();

  return new Promise<Socket>((resolve, reject) => {
    const tick = () => {
      if (isSocketConnected(s)) {
        resolve(s);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error('Socket connection timeout'));
        return;
      }

      setTimeout(tick, 100);
    };

    tick();
  });
}

export function createRoomChannel(room: string) {
  const s = connectSocket();
  return s.channel(`room:${room}`, {});
}
