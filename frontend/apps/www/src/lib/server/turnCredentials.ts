import { createHash, createHmac } from 'node:crypto';

export type TurnCredentialConfig = {
  turnUrls?: string;
  stunUrls?: string;
  sharedSecret?: string;
  ttlSeconds?: number;
  nowSeconds?: number;
  relayOnly?: boolean;
};

const DEFAULT_STUN_URLS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
];

function parseIceUrls(raw: string | undefined, kinds: Set<string>) {
  return (raw || '')
    .split(',')
    .map(value => value.trim())
    .filter(value => {
      if (!value || value.length > 500 || /\s/.test(value)) return false;
      const scheme = value.split(':', 1)[0]?.toLowerCase() || '';
      return kinds.has(scheme);
    })
    .slice(0, 8);
}

function boundedTtl(value: number | undefined) {
  if (!Number.isFinite(value)) return 3_600;
  return Math.max(300, Math.min(3_600, Math.round(value!)));
}

export function createIceServerPayload(
  userId: string,
  config: TurnCredentialConfig,
) {
  const configuredStun = parseIceUrls(
    config.stunUrls,
    new Set(['stun', 'stuns']),
  );
  const iceServers: Array<{
    urls: string[];
    username?: string;
    credential?: string;
  }> = [];

  if (!config.relayOnly) {
    iceServers.push({
      urls: configuredStun.length > 0 ? configuredStun : DEFAULT_STUN_URLS,
    });
  }

  const turnUrls = parseIceUrls(
    config.turnUrls,
    new Set(['turn', 'turns']),
  );
  const secret = (config.sharedSecret || '').trim();
  const nowSeconds = Math.floor(config.nowSeconds ?? Date.now() / 1_000);
  const expiresAt = nowSeconds + boundedTtl(config.ttlSeconds);

  if (secret && turnUrls.length > 0) {
    const opaqueUser = createHash('sha256')
      .update(userId)
      .digest('hex')
      .slice(0, 20);
    const username = `${expiresAt}:${opaqueUser}`;
    const credential = createHmac('sha1', secret)
      .update(username)
      .digest('base64');
    iceServers.push({ urls: turnUrls, username, credential });
  }

  return {
    ice_servers: iceServers,
    expires_at: expiresAt,
    relay_configured: Boolean(secret && turnUrls.length > 0),
    ice_transport_policy: config.relayOnly ? ('relay' as const) : ('all' as const),
    development_fallback: !config.relayOnly,
  };
}
