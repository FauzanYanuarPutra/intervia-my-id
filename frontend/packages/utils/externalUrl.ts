function parseIpv4(host: string): [number, number, number, number] | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map(part => {
    if (!/^\d{1,3}$/.test(part)) return Number.NaN;
    return Number(part);
  });
  if (octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) {
    return null;
  }
  return octets as [number, number, number, number];
}

function isNonPublicIpv4(host: string): boolean {
  const octets = parseIpv4(host);
  if (!octets) return false;
  const [a, b, c] = octets;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function isNonPublicIpv6(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (!normalized || normalized.includes('%')) return true;
  if (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('::') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith('ff') ||
    normalized.startsWith('2001:db8:') ||
    normalized === '2001:db8' ||
    normalized.startsWith('64:ff9b:')
  ) {
    return true;
  }

  const dottedTail = normalized.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
  return dottedTail ? isNonPublicIpv4(dottedTail) : false;
}

export function isSafeExternalHttpUrl(value: string): boolean {
  if (!value || value.length > 2_048) return false;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      return false;
    }
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (
      !host ||
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local')
    ) {
      return false;
    }
    if (host.includes(':')) return !isNonPublicIpv6(host);
    const ipv4 = parseIpv4(host);
    return ipv4 ? !isNonPublicIpv4(host) : true;
  } catch {
    return false;
  }
}

export function normalizeSafeExternalHttpUrl(value: string): string | null {
  const clean = value.trim();
  if (!isSafeExternalHttpUrl(clean)) return null;
  try {
    return new URL(clean).toString();
  } catch {
    return null;
  }
}
