const DEFAULT_STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const parseUrls = (raw?: string | null): string[] => {
  if (!raw) return [];
  return raw
    .split(',')
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
};

/**
 * Returns ICE server configuration for WebRTC peers.
 * Allows overriding STUN URLs and adding TURN credentials via env vars.
 */
export function getIceServers(): RTCIceServer[] {
  const customStun = parseUrls(process.env.NEXT_PUBLIC_STUN_URLS);
  const stunServers =
    customStun.length > 0 ? customStun.map((url) => ({ urls: url })) : DEFAULT_STUN_SERVERS;

  let turnUrls = parseUrls(process.env.NEXT_PUBLIC_TURN_URLS);
  if (turnUrls.length === 0) {
    turnUrls = parseUrls(process.env.NEXT_PUBLIC_TURN_URL);
  }
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME?.trim();
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL?.trim();

  const servers: RTCIceServer[] = [...stunServers];

  if (turnUrls.length > 0 && turnUsername && turnCredential) {
    servers.push({
      urls: turnUrls,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return servers;
}
