const DEFAULT_STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

type AuthFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

type IcePayload = {
  ice_servers?: unknown[];
  ice_transport_policy?: unknown;
  relay_configured?: unknown;
  development_fallback?: unknown;
};

export class CallConfigurationError extends Error {
  constructor() {
    super('Secure call relay is temporarily unavailable.');
    this.name = 'CallConfigurationError';
  }
}

function permitsDevelopmentFallback() {
  const appEnvironment = (
    process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || ''
  ).toLowerCase();
  return appEnvironment === 'development' || appEnvironment === 'test';
}

function isAllowedIceUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 500 &&
    /^(stun|stuns|turn|turns):[^\s]+$/i.test(value)
  );
}

function normalizeIceServer(value: unknown): RTCIceServer | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const urls = Array.isArray(record.urls)
    ? record.urls.filter(isAllowedIceUrl).slice(0, 8)
    : isAllowedIceUrl(record.urls)
      ? record.urls
      : [];
  if ((Array.isArray(urls) && urls.length === 0) || urls === '') return null;

  const server: RTCIceServer = { urls };
  if (
    typeof record.username === 'string' &&
    record.username.length <= 300 &&
    typeof record.credential === 'string' &&
    record.credential.length <= 500
  ) {
    server.username = record.username;
    server.credential = record.credential;
  }
  return server;
}

/**
 * Loads short-lived TURN credentials through the authenticated BFF. Static
 * NEXT_PUBLIC TURN passwords are intentionally unsupported because every
 * browser visitor could reuse them outside Lajukan and consume relay quota.
 */
export async function getIceConfiguration(
  authFetch: AuthFetch,
): Promise<RTCConfiguration> {
  try {
    const response = await authFetch('/api/chat/calls/ice', {
      cache: 'no-store',
    });
    if (!response.ok) throw new CallConfigurationError();
    const payload = (await response.json().catch(() => null)) as {
      data?: IcePayload;
    } | null;
    const servers = (payload?.data?.ice_servers || [])
      .map(normalizeIceServer)
      .filter((item): item is RTCIceServer => Boolean(item));
    const relayOnly = payload?.data?.ice_transport_policy === 'relay';
    const developmentFallbackAllowed =
      permitsDevelopmentFallback() ||
      payload?.data?.development_fallback === true;
    const hasAuthenticatedTurn = servers.some(server => {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      return (
        urls.some(url => /^turns?:/i.test(url)) &&
        typeof server.username === 'string' &&
        typeof server.credential === 'string'
      );
    });

    if (
      (!developmentFallbackAllowed && !relayOnly) ||
      (relayOnly &&
        (payload?.data?.relay_configured !== true || !hasAuthenticatedTurn))
    ) {
      throw new CallConfigurationError();
    }

    if (servers.length === 0) throw new CallConfigurationError();
    return {
      iceServers: servers,
      iceTransportPolicy: relayOnly ? 'relay' : 'all',
    };
  } catch (error) {
    if (!permitsDevelopmentFallback()) {
      throw error instanceof CallConfigurationError
        ? error
        : new CallConfigurationError();
    }
    return { iceServers: DEFAULT_STUN_SERVERS, iceTransportPolicy: 'all' };
  }
}
